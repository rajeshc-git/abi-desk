# ---------------------------------------------------------------------------
# Approval workflow smoke check.
#
# Exercises the real approve/reject endpoints against a genuinely gated transition,
# replacing the out-of-band SQL the workflow check used as a stand-in.
#
# The assertions that matter are the refusals: a requester must not be able to approve
# their own handover, a non-approver must not be able to sign off, and a rejection must
# be terminal.
# ---------------------------------------------------------------------------
param([string]$BaseUrl = "http://localhost:4000")

$ErrorActionPreference = "Stop"
$script:Failures = 0

function Assert($condition, $message) {
  if ($condition) { Write-Host "  PASS  $message" }
  else { Write-Host "  FAIL  $message" -ForegroundColor Red; $script:Failures++ }
}

function Login($email, $tenantSlug) {
  $payload = @{ email = $email; password = 'AbiDesk!2026'; tenantSlug = $tenantSlug } | ConvertTo-Json -Compress
  $res = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -ContentType 'application/json' -Body $payload
  return @{ Headers = @{ Authorization = "Bearer $($res.accessToken)" }; UserId = $res.user.id }
}

function Api($session, $method, $path, $body) {
  $p = @{ Method = $method; Uri = "$BaseUrl/api/v1$path"; Headers = $session.Headers }
  if ($body) { $p.ContentType = 'application/json'; $p.Body = ($body | ConvertTo-Json -Compress -Depth 6) }
  return Invoke-RestMethod @p
}

function ExpectFail($session, $method, $path, $expected, $message, $body) {
  try { Api $session $method $path $body | Out-Null; Assert $false "$message (expected $expected, got success)" }
  catch { $s = [int]$_.Exception.Response.StatusCode; Assert ($s -eq $expected) "$message (got $s)" }
}

# Drives a fresh ticket to OPEN at tier L3, where OPEN -> IN_DEVELOPMENT is gated.
function NewGatedTicket($guest, $l1, $l2, $l3, $subject) {
  $t = Api $guest 'Post' '/tickets' @{ subject = $subject; description = 'Gated transition fixture.' }
  Api $l1 'Post' "/tickets/$($t.id)/transitions" @{ toStatus = 'TRIAGE' } | Out-Null
  Api $l1 'Post' "/tickets/$($t.id)/transitions" @{ toStatus = 'OPEN' } | Out-Null
  Api $l1 'Post' "/tickets/$($t.id)/escalate" @{ reason = 'Needs L2.' } | Out-Null
  Api $l2 'Post' "/tickets/$($t.id)/transitions" @{ toStatus = 'OPEN' } | Out-Null
  Api $l2 'Post' "/tickets/$($t.id)/escalate" @{ reason = 'Needs L3.' } | Out-Null
  Api $l3 'Post' "/tickets/$($t.id)/transitions" @{ toStatus = 'OPEN' } | Out-Null
  return $t
}

Write-Host "`n== Sessions =="
$guest = Login 'june.carter@northwind.example' 'acme'
$l1    = Login 'nina.patel@acme.example' 'acme'
$l2    = Login 'dana.whitfield@acme.example' 'acme'
$l3    = Login 'ravi.menon@acme.example' 'acme'
$dev   = Login 'sofia.marchetti@acme.example' 'acme'
$l3b   = Login 'grace.lim@acme.example' 'acme'   # second product specialist: the eligible approver
$qa    = Login 'ben.okafor@acme.example' 'acme'
$admin = Login 'admin@acme.example' 'acme'
Assert $true 'signed in as guest, L1, L2, two L3s, Dev and Tenant Admin'

Write-Host "`n== A gated transition opens a request =="
$t = NewGatedTicket $guest $l1 $l2 $l3 'Approval flow: engineering handover'
$pending = Api $l3 'Post' "/tickets/$($t.id)/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Confirmed product defect.' }
Assert ($pending.kind -eq 'pending_approval') 'the handover is blocked pending approval'
$requestId = $pending.approvalRequestId
Assert ($requestId -ne $null) 'an approval request id was returned'

$detail = Api $l3 'Get' "/approvals/$requestId"
Assert ($detail.status -eq 'PENDING') 'the request is PENDING'
Assert ($detail.fromStatus -eq 'OPEN' -and $detail.toStatus -eq 'IN_DEVELOPMENT') 'it records the gated transition'
Assert ($detail.approverRoleKey -eq 'L3_SUPPORT') 'it records the approver role from the workflow row'
Assert ($detail.requestedById -eq $l3.UserId) 'it records who asked'

Write-Host "`n== Separation of duties =="
# The requester holds L3_SUPPORT and therefore matches the approver role, so only the
# self-approval rule stands between them and signing off on their own request.
ExpectFail $l3 'Post' "/approvals/$requestId/decision" 403 'the requester CANNOT approve their own request' @{ decision = 'APPROVED' }
ExpectFail $dev 'Post' "/approvals/$requestId/decision" 403 'a Dev (not an L3 approver) CANNOT approve it' @{ decision = 'APPROVED' }
ExpectFail $admin 'Post' "/approvals/$requestId/decision" 403 'Tenant Admin holds approval:decide but is NOT the named approver role, so it is still refused' @{ decision = 'APPROVED' }
ExpectFail $l1 'Post' "/approvals/$requestId/decision" 403 'L1 has no approval:decide permission' @{ decision = 'APPROVED' }
ExpectFail $guest 'Get' '/approvals' 403 'a customer cannot see the approvals inbox'

Write-Host "`n== Rejection requires a reason and is terminal =="
$t2 = NewGatedTicket $guest $l1 $l2 $l3 'Approval flow: rejected handover'
$p2 = Api $l3 'Post' "/tickets/$($t2.id)/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Please take this.' }
ExpectFail $l3b 'Post' "/approvals/$($p2.approvalRequestId)/decision" 422 'rejecting without a comment is refused' @{ decision = 'REJECTED' }

$rejected = Api $l3b 'Post' "/approvals/$($p2.approvalRequestId)/decision" @{ decision = 'REJECTED'; comment = 'Not a defect - configuration issue, send it back to L2.' }
Assert ($rejected.status -eq 'REJECTED') 'the second L3 rejected it'

ExpectFail $l3b 'Post' "/approvals/$($p2.approvalRequestId)/decision" 409 'a decided request cannot be decided again' @{ decision = 'APPROVED'; comment = 'changed my mind' }

$blocked = Api $l3 'Post' "/tickets/$($t2.id)/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'retry after rejection' }
Assert ($blocked.kind -eq 'pending_approval') 'after rejection the transition is still gated (a new request is opened)'
Assert ($blocked.approvalRequestId -ne $p2.approvalRequestId) 'retrying opens a NEW request rather than reusing the rejected one'

Write-Host "`n== Approval releases the gate =="
$approved = Api $l3b 'Post' "/approvals/$requestId/decision" @{ decision = 'APPROVED'; comment = 'Agreed, hand it to engineering.' }
Assert ($approved.status -eq 'APPROVED') 'the second L3 approved it'
Assert ($approved.satisfied -eq $true) 'ANY mode is satisfied by a single approval'

$moved = Api $l3 'Post' "/tickets/$($t.id)/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Approved.' }
Assert ($moved.status -eq 'IN_DEVELOPMENT' -and $moved.tier -eq 'DEV') 'the transition now applies'

Write-Host "`n== The consumed approval is spent, and QA owns the send-back =="
$again = Api $dev 'Post' "/tickets/$($t.id)/transitions" @{ toStatus = 'IN_QA' }
Assert ($again.status -eq 'IN_QA') 'Dev handed the fix to QA'

# Sending work back to engineering needs ticket:transition:development, which DEV_TEAM
# does not hold - QA_TEAM and L3 do. So the reject-back is QA's action, not Dev's.
ExpectFail $dev 'Post' "/tickets/$($t.id)/transitions" 403 'Dev CANNOT send its own work back to development' @{ toStatus = 'IN_DEVELOPMENT'; comment = 'self send-back' }
$back = Api $qa 'Post' "/tickets/$($t.id)/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Still failing for large accounts.' }
Assert ($back.status -eq 'IN_DEVELOPMENT') 'QA sent it back to development'

# The approval that released the earlier handover is resolved and cannot be reused.
$spent = Api $l3 'Get' "/approvals/$requestId"
Assert ($spent.status -eq 'APPROVED' -and $spent.resolvedAt -ne $null) 'the consumed approval is resolved, not reusable'

Write-Host "`n== Inbox =="
$t3 = NewGatedTicket $guest $l1 $l2 $l3 'Approval flow: inbox visibility'
$p3 = Api $l3 'Post' "/tickets/$($t3.id)/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Third one.' }

$adminInbox = Api $l3b 'Get' '/approvals?status=PENDING'
$adminIds = @($adminInbox.approvals | ForEach-Object { $_.id })
Assert ($adminIds -contains $p3.approvalRequestId) 'the pending request appears in an approver''s inbox'

$l3Inbox = Api $l3 'Get' '/approvals?status=PENDING'
$l3Ids = @($l3Inbox.approvals | ForEach-Object { $_.id })
Assert (-not ($l3Ids -contains $p3.approvalRequestId)) 'it does NOT appear in the requester''s own inbox'

$all = Api $l3 'Get' '/approvals?mine=false&status=PENDING'
$allIds = @($all.approvals | ForEach-Object { $_.id })
Assert ($allIds -contains $p3.approvalRequestId) 'mine=false shows the tenant-wide view'

Write-Host "`n== Cancellation =="
$cancelTicket = NewGatedTicket $guest $l1 $l2 $l3 'Approval flow: cancelled request'
$p4 = Api $l3 'Post' "/tickets/$($cancelTicket.id)/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Will withdraw.' }
ExpectFail $dev 'Delete' "/approvals/$($p4.approvalRequestId)" 403 'someone else cannot cancel another user''s request'
Api $l3 'Delete' "/approvals/$($p4.approvalRequestId)" | Out-Null
$cancelled = Api $l3 'Get' "/approvals/$($p4.approvalRequestId)"
Assert ($cancelled.status -eq 'CANCELLED') 'the requester cancelled their own request'

Write-Host "`n== Timeline records the decisions =="
$tl = Api $l3 'Get' "/tickets/$($t.id)/timeline"
$types = @($tl.events | ForEach-Object { $_.type })
Assert ($types -contains 'APPROVAL_REQUESTED') 'timeline records APPROVAL_REQUESTED'
Assert ($types -contains 'APPROVAL_GRANTED') 'timeline records APPROVAL_GRANTED'

$tl2 = Api $l3 'Get' "/tickets/$($t2.id)/timeline"
$types2 = @($tl2.events | ForEach-Object { $_.type })
Assert ($types2 -contains 'APPROVAL_REJECTED') 'timeline records APPROVAL_REJECTED'

Write-Host ""
if ($script:Failures -gt 0) { Write-Host "$($script:Failures) check(s) FAILED" -ForegroundColor Red; exit 1 }
Write-Host "All approval workflow checks passed."
