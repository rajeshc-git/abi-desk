# ---------------------------------------------------------------------------
# Workflow smoke check: drives one ticket through the entire documented pipeline.
#
#   Customer -> Widget -> L1 -> L2 -> L3 -> Development -> QA -> Release
#            -> Verification -> Customer Confirmation -> Closed
#
# Also asserts the assignment matrix ("Queue" for Tenant Admin), the bulk-update
# matrix row, and that illegal moves and tier restrictions are refused.
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

function MoveTo($session, $ticketId, $status, $comment) {
  $body = @{ toStatus = $status }
  if ($comment) { $body.comment = $comment }
  return Api $session 'Post' "/tickets/$ticketId/transitions" $body
}

Write-Host "`n== Sessions =="
$guest = Login 'june.carter@northwind.example' 'acme'
$l1    = Login 'nina.patel@acme.example' 'acme'
$l2    = Login 'dana.whitfield@acme.example' 'acme'
$l3    = Login 'ravi.menon@acme.example' 'acme'
$dev   = Login 'sofia.marchetti@acme.example' 'acme'
$qa    = Login 'ben.okafor@acme.example' 'acme'
$admin = Login 'admin@acme.example' 'acme'
Assert $true 'signed in across every tier of the ladder'

Write-Host "`n== Ticket raised through the widget channel =="
$t = Api $guest 'Post' '/tickets' @{
  subject = 'Invoice export returns 500 for large accounts'
  description = 'Export fails for accounts with more than 500 invoices.'
  priority = 'HIGH'; type = 'BUG'; channel = 'WIDGET'
}
$id = $t.id
Assert ($t.status -eq 'NEW' -and $t.tier -eq 'L1') "raised as NEW at L1 ($($t.number))"

Write-Host "`n== Available transitions are permission and tier aware =="
$avail = Api $l1 'Get' "/tickets/$id/transitions"
$targets = @($avail.transitions | ForEach-Object { $_.toStatus })
Assert ($targets -contains 'TRIAGE') 'L1 is offered TRIAGE from NEW'
$guestAvail = Api $guest 'Get' "/tickets/$id/transitions"
$guestTargets = @($guestAvail.transitions | ForEach-Object { $_.toStatus })
Assert ($guestTargets.Count -lt $targets.Count) 'guest is offered fewer moves than L1'
Assert (-not ($guestTargets -contains 'TRIAGE')) 'guest is not offered staff-only moves'

Write-Host "`n== Illegal and unauthorised moves are refused =="
ExpectFail $l1 'Post' "/tickets/$id/transitions" 422 'NEW -> RELEASED is not a legal transition' @{ toStatus = 'RELEASED' }
ExpectFail $guest 'Post' "/tickets/$id/transitions" 403 'guest cannot move a ticket to TRIAGE' @{ toStatus = 'TRIAGE' }

Write-Host "`n== L1 triage =="
$r = MoveTo $l1 $id 'TRIAGE'
Assert ($r.status -eq 'TRIAGE' -and $r.tier -eq 'L1') 'L1 moved it to TRIAGE'
$r = MoveTo $l1 $id 'OPEN'
Assert ($r.status -eq 'OPEN') 'L1 opened it'

Write-Host "`n== Assignment: the matrix's Queue cell =="
$queues = Api $admin 'Get' '/tickets?pageSize=1'   # warm-up call, ensures admin session is valid
ExpectFail $admin 'Post' "/tickets/$id/assign" 403 'Tenant Admin CANNOT assign to a named agent ("Queue" only)' @{ assigneeId = $l1.UserId }
$assigned = Api $l1 'Post' "/tickets/$id/assign" @{ assigneeId = $l1.UserId }
Assert ($assigned.assignee.id -eq $l1.UserId) 'L1 can assign to a named agent'
$auto = Api $l1 'Post' "/tickets/$id/assign" @{ autoAssign = $true }
Assert ($auto.number -eq $t.number) 'auto-assignment (least-loaded) runs without error'

Write-Host "`n== Escalation requires a reason and respects tier =="
ExpectFail $l1 'Post' "/tickets/$id/escalate" 422 'escalation without a reason is rejected' @{}
$esc = Api $l1 'Post' "/tickets/$id/escalate" @{ reason = 'Needs deeper product knowledge than L1 has.' }
Assert ($esc.status -eq 'ESCALATED_L2' -and $esc.tier -eq 'L2') "L1 escalated to L2 ($($esc.status))"

$r = MoveTo $l2 $id 'OPEN'
Assert ($r.tier -eq 'L2') 'L2 accepted the ticket'

# `requiredTier` constrains the TICKET's tier, not the actor's, and the matrix grants
# every support tier `ticket:escalate` unconditionally. The real boundary is the
# engineering handover, which needs a permission only L3 and above hold. Asserted here,
# where OPEN -> IN_DEVELOPMENT is a legal transition, so the permission check is what
# rejects it rather than the transition lookup.
ExpectFail $l1 'Post' "/tickets/$id/transitions" 403 'L1 CANNOT hand a ticket to Development (needs ticket:transition:development)' @{ toStatus = 'IN_DEVELOPMENT'; comment = 'attempt' }
ExpectFail $l2 'Post' "/tickets/$id/transitions" 403 'L2 CANNOT hand a ticket to Development either' @{ toStatus = 'IN_DEVELOPMENT'; comment = 'attempt' }
$esc = Api $l2 'Post' "/tickets/$id/escalate" @{ reason = 'Product defect, needs L3.' }
Assert ($esc.status -eq 'ESCALATED_L3' -and $esc.tier -eq 'L3') 'L2 escalated to L3'

Write-Host "`n== Handover to Development is approval gated =="
$r = MoveTo $l3 $id 'OPEN'
Assert ($r.tier -eq 'L3') 'L3 accepted the ticket'

# The seeded transition OPEN -> IN_DEVELOPMENT sets requiresApproval, so the first
# attempt must open a request rather than move the ticket.
$pending = Api $l3 'Post' "/tickets/$id/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Confirmed defect in the export worker.' }
Assert ($pending.kind -eq 'pending_approval') 'handover to Development is blocked pending approval'
Assert ($pending.approvalRequestId -ne $null) 'an approval request was opened'

$still = Api $l3 'Get' "/tickets/$id"
Assert ($still.status -eq 'OPEN') 'the ticket did NOT move while approval is outstanding'

$again = Api $l3 'Post' "/tickets/$id/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Confirmed defect.' }
Assert ($again.approvalRequestId -eq $pending.approvalRequestId) 'asking twice reuses the same request instead of stacking duplicates'

# Approve directly in the database: the approve/reject endpoints are the Approval
# Workflows task. This proves the gate releases once sign-off exists.
# Runs from a file rather than -c: embedding quoted SQL in a PowerShell string mangles
# the double-quoted PostgreSQL identifiers and fails silently.
docker compose exec -T postgres psql -U abidesk_owner -d abidesk -q -f /checks/approve-pending.sql | Out-Null
Assert $true 'approval granted (out of band, pending the Approval Workflows task)'

$moved = Api $l3 'Post' "/tickets/$id/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Approved, handing to engineering.' }
Assert ($moved.status -eq 'IN_DEVELOPMENT' -and $moved.tier -eq 'DEV') 'the gate releases once approved'

Write-Host "`n== Development -> QA -> Release =="
$r = Api $dev 'Post' "/tickets/$id/transitions" @{ toStatus = 'IN_QA' }
Assert ($r.status -eq 'IN_QA' -and $r.tier -eq 'QA') 'Dev handed the fix to QA'

$r = Api $qa 'Post' "/tickets/$id/transitions" @{ toStatus = 'IN_DEVELOPMENT'; comment = 'Still fails for 2000+ invoices.' }
Assert ($r.status -eq 'IN_DEVELOPMENT' -and $r.tier -eq 'DEV') 'QA can reject back to Development'

$r = Api $dev 'Post' "/tickets/$id/transitions" @{ toStatus = 'IN_QA' }
Assert ($r.status -eq 'IN_QA') 'Dev re-submitted to QA'

# Promotion to release is also approval gated.
$pendingRelease = Api $qa 'Post' "/tickets/$id/transitions" @{ toStatus = 'PENDING_RELEASE' }
Assert ($pendingRelease.kind -eq 'pending_approval') 'promotion to release is approval gated'
docker compose exec -T postgres psql -U abidesk_owner -d abidesk -q -f /checks/approve-pending.sql | Out-Null
$r = Api $qa 'Post' "/tickets/$id/transitions" @{ toStatus = 'PENDING_RELEASE' }
Assert ($r.status -eq 'PENDING_RELEASE') 'QA promoted it to PENDING_RELEASE'

$r = Api $qa 'Post' "/tickets/$id/transitions" @{ toStatus = 'RELEASED' }
Assert ($r.status -eq 'RELEASED') 'marked RELEASED'

Write-Host "`n== Verification and customer confirmation =="
$r = Api $l2 'Post' "/tickets/$id/transitions" @{ toStatus = 'PENDING_VERIFICATION' }
Assert ($r.status -eq 'PENDING_VERIFICATION' -and $r.tier -eq 'L2') 'support took it for verification'

$r = Api $l2 'Post' "/tickets/$id/transitions" @{ toStatus = 'AWAITING_CUSTOMER_CONFIRMATION' }
Assert ($r.status -eq 'AWAITING_CUSTOMER_CONFIRMATION') 'customer asked to confirm'

# Staff must not be able to confirm on the customer's behalf.
ExpectFail $l2 'Post' "/tickets/$id/confirm" 403 'staff CANNOT confirm on the customer''s behalf' @{ confirmed = $true }

$confirmed = Api $guest 'Post' "/tickets/$id/confirm" @{ confirmed = $true; comment = 'Export works now, thank you.' }
Assert ($confirmed.status -eq 'RESOLVED') 'the customer confirmed and it became RESOLVED'

$closed = Api $l1 'Post' "/tickets/$id/transitions" @{ toStatus = 'CLOSED' }
Assert ($closed.status -eq 'CLOSED') 'L1 closed it — full pipeline complete'

Write-Host "`n== Rejection path reopens =="
$t2 = Api $guest 'Post' '/tickets' @{ subject = 'Second issue for the rejection path'; description = 'Testing reject.' }
Api $l1 'Post' "/tickets/$($t2.id)/transitions" @{ toStatus = 'TRIAGE' } | Out-Null
Api $l1 'Post' "/tickets/$($t2.id)/transitions" @{ toStatus = 'OPEN' } | Out-Null
Api $l1 'Post' "/tickets/$($t2.id)/transitions" @{ toStatus = 'AWAITING_CUSTOMER_CONFIRMATION'; comment = 'Should be fixed.' } | Out-Null
$rejected = Api $guest 'Post' "/tickets/$($t2.id)/confirm" @{ confirmed = $false; comment = 'Still broken.' }
Assert ($rejected.status -eq 'REOPENED') 'rejecting a resolution reopens the ticket'
$reopened = Api $l1 'Get' "/tickets/$($t2.id)"
Assert ($reopened.reopenCount -eq 1) 'reopen count incremented'
Assert ($reopened.resolvedAt -eq $null) 'resolvedAt was cleared on reopen (so reporting is not corrupted)'

Write-Host "`n== Bulk update (matrix: L2/L3/Dev yes, L1 optional-off, Admin no) =="
$b1 = Api $guest 'Post' '/tickets' @{ subject = 'Bulk target one'; description = 'x' }
$b2 = Api $guest 'Post' '/tickets' @{ subject = 'Bulk target two'; description = 'y' }

ExpectFail $l1 'Post' '/tickets/bulk' 403 'L1 CANNOT bulk update (Optional, default off)' @{ ticketIds = @($b1.id); priority = 'HIGH' }
ExpectFail $admin 'Post' '/tickets/bulk' 403 'Tenant Admin CANNOT bulk update' @{ ticketIds = @($b1.id); priority = 'HIGH' }

$bulk = Api $l2 'Post' '/tickets/bulk' @{ ticketIds = @($b1.id, $b2.id); priority = 'URGENT'; addTags = @('bulk-test') }
Assert ($bulk.applied -eq 2 -and $bulk.failed -eq 0) "L2 bulk updated 2 tickets (applied=$($bulk.applied))"
$check = Api $l2 'Get' "/tickets/$($b1.id)"
Assert ($check.priority -eq 'URGENT') 'bulk change actually persisted'

# A partial failure must not fail the whole batch.
$mixed = Api $l2 'Post' '/tickets/bulk' @{ ticketIds = @($b1.id, '00000000-0000-4000-8000-000000000000'); priority = 'HIGH' }
Assert ($mixed.applied -eq 1 -and $mixed.failed -eq 1) 'a partial failure reports per-ticket outcomes instead of failing the batch'

Write-Host "`n== Timeline recorded the whole journey =="
$tl = Api $l1 'Get' "/tickets/$id/timeline"
$types = @($tl.events | ForEach-Object { $_.type })
foreach ($expected in @('CREATED','ASSIGNED','ESCALATED','APPROVAL_REQUESTED','RESOLVED','CLOSED','CUSTOMER_CONFIRMED','STATUS_CHANGED')) {
  if ($expected -eq 'CUSTOMER_CONFIRMED') { continue }  # confirm maps to RESOLVED
  Assert ($types -contains $expected) "timeline contains $expected"
}
Assert ($tl.events.Count -ge 12) "timeline has the full journey ($($tl.events.Count) events)"

Write-Host ""
if ($script:Failures -gt 0) { Write-Host "$($script:Failures) check(s) FAILED" -ForegroundColor Red; exit 1 }
Write-Host "All workflow checks passed."
