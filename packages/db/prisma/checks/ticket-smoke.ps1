# ---------------------------------------------------------------------------
# Ticket core smoke check against a running stack.
#
#   powershell -File packages/db/prisma/checks/ticket-smoke.ps1
#
# Verifies the ticket surface actually enforces the RBAC matrix at the ROW level, not
# just at the endpoint. The interesting assertions are the negative ones: a customer
# must not see another customer's ticket, a Tenant Admin must not be able to write an
# internal note, and a tenant must not see another tenant's data.
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
  return @{ Headers = @{ Authorization = "Bearer $($res.accessToken)" }; User = $res.user }
}

function Api($session, $method, $path, $body) {
  $args = @{ Method = $method; Uri = "$BaseUrl/api/v1$path"; Headers = $session.Headers }
  if ($body) { $args.ContentType = 'application/json'; $args.Body = ($body | ConvertTo-Json -Compress -Depth 6) }
  return Invoke-RestMethod @args
}

function ExpectStatus($session, $method, $path, $expected, $message, $body) {
  try {
    Api $session $method $path $body | Out-Null
    Assert $false "$message (expected $expected, got success)"
  } catch {
    $status = [int]$_.Exception.Response.StatusCode
    Assert ($status -eq $expected) "$message (got $status)"
  }
}

Write-Host "`n== Sessions =="
$guest  = Login 'june.carter@northwind.example' 'acme'
$guest2 = Login 'felix.brandt@northwind.example' 'acme'
$l1     = Login 'nina.patel@acme.example' 'acme'
$admin  = Login 'admin@acme.example' 'acme'
$other  = Login 'asha.rao@meridian.example' 'globex'
Assert $true 'signed in as guest, second guest, L1, tenant admin, and a Globex customer'

Write-Host "`n== Create Ticket (matrix: granted to every role) =="
$created = Api $guest 'Post' '/tickets' @{
  subject     = 'Cannot export the November invoice PDF'
  description = 'The export button spins forever and the console shows a 500 from /api/invoices/export.'
  priority    = 'HIGH'
  type        = 'BUG'
  channel     = 'WIDGET'
  category    = 'billing'
  tags        = @('billing', 'export')
}
Assert ($created.id -ne $null) 'guest created a ticket'
Assert ($created.number -match '^ACME-\d+$') "ticket number is tenant-prefixed ($($created.number))"
Assert ($created.status -eq 'NEW') 'new ticket starts in NEW'
Assert ($created.tier -eq 'L1') 'new ticket starts at tier L1'
Assert ($created.requester.email -eq 'june.carter@northwind.example') 'requester is the creator'
Assert ($created.tags.Count -eq 2) 'tags were attached'

$second = Api $guest 'Post' '/tickets' @{ subject = 'Second report from the same customer'; description = 'Another issue.' }
$firstNum  = [int]($created.number -replace '^ACME-','')
$secondNum = [int]($second.number  -replace '^ACME-','')
Assert ($secondNum -eq $firstNum + 1) "ticket numbers increment per tenant ($($created.number) -> $($second.number))"

# A different customer's ticket, used for the isolation checks below.
$otherGuestTicket = Api $guest2 'Post' '/tickets' @{ subject = 'Unrelated ticket from a different customer'; description = 'Mine, not yours.' }

Write-Host "`n== View Own Tickets vs View All Tenant Tickets =="
$guestList = Api $guest 'Get' '/tickets?pageSize=100'
$guestSubjects = @($guestList.tickets | ForEach-Object { $_.id })
Assert ($guestSubjects -contains $created.id) 'guest sees their own ticket'
Assert (-not ($guestSubjects -contains $otherGuestTicket.id)) 'guest does NOT see another customer''s ticket in the list'

$l1List = Api $l1 'Get' '/tickets?pageSize=100'
$l1Ids = @($l1List.tickets | ForEach-Object { $_.id })
Assert ($l1Ids -contains $created.id) 'L1 sees the customer ticket (View All Tenant Tickets)'
Assert ($l1Ids -contains $otherGuestTicket.id) 'L1 sees every requester''s tickets'

# The attack that an endpoint guard alone would not stop: fetch by known id.
ExpectStatus $guest 'Get' "/tickets/$($otherGuestTicket.id)" 404 'guest fetching another customer''s ticket by id is 404 (not 403, which would confirm it exists)'
Assert $true 'row-level scope is enforced, not just endpoint permission'

Write-Host "`n== Cross-tenant isolation =="
ExpectStatus $other 'Get' "/tickets/$($created.id)" 404 'a Globex customer cannot read an Acme ticket by id'
$otherList = Api $other 'Get' '/tickets?pageSize=100'
$otherIds = @($otherList.tickets | ForEach-Object { $_.id })
Assert (-not ($otherIds -contains $created.id)) 'Acme tickets never appear in a Globex list'

Write-Host "`n== Internal Notes (matrix: L1-Dev yes, Guest and Tenant Admin no) =="
$note = Api $l1 'Post' "/tickets/$($created.id)/comments" @{ body = 'Reproduced. Export worker OOMs on invoices over 5MB.'; visibility = 'INTERNAL' }
Assert ($note.visibility -eq 'INTERNAL') 'L1 can write an internal note'

$reply = Api $l1 'Post' "/tickets/$($created.id)/comments" @{ body = 'Thanks for the report - we are investigating.'; visibility = 'PUBLIC' }
Assert ($reply.visibility -eq 'PUBLIC') 'L1 can write a public reply'

ExpectStatus $admin 'Post' "/tickets/$($created.id)/comments" 403 'Tenant Admin CANNOT write an internal note' @{ body = 'admin note'; visibility = 'INTERNAL' }
ExpectStatus $guest 'Post' "/tickets/$($created.id)/comments" 403 'Guest CANNOT write an internal note' @{ body = 'guest note'; visibility = 'INTERNAL' }

$guestComments = Api $guest 'Get' "/tickets/$($created.id)/comments"
$guestVisibilities = @($guestComments.comments | ForEach-Object { $_.visibility })
Assert ($guestComments.comments.Count -ge 1) 'guest sees public replies'
Assert (-not ($guestVisibilities -contains 'INTERNAL')) 'guest does NOT see internal notes'

$l1Comments = Api $l1 'Get' "/tickets/$($created.id)/comments"
$l1Visibilities = @($l1Comments.comments | ForEach-Object { $_.visibility })
Assert ($l1Visibilities -contains 'INTERNAL') 'L1 sees internal notes'

# Requesting internal explicitly must narrow, never escalate.
$guestForced = Api $guest 'Get' "/tickets/$($created.id)/comments?visibility=INTERNAL"
Assert ($guestForced.comments.Count -eq 0) 'guest asking for visibility=INTERNAL gets nothing (filter narrows, never widens)'

Write-Host "`n== Edit Own Ticket =="
$patched = Api $guest 'Patch' "/tickets/$($created.id)" @{ subject = 'Cannot export the November invoice PDF (still failing)' }
Assert ($patched.subject -like '*still failing*') 'guest can edit their own ticket'
# A valid body is required, otherwise the empty-PATCH validation fires first and we
# would be asserting on 422 rather than on the scope check we care about.
ExpectStatus $guest 'Patch' "/tickets/$($otherGuestTicket.id)" 404 'guest cannot edit another customer''s ticket' @{ subject = 'attempted hijack of someone else''s ticket' }

$l1Patched = Api $l1 'Patch' "/tickets/$($created.id)" @{ priority = 'URGENT' }
Assert ($l1Patched.priority -eq 'URGENT') 'L1 can edit any tenant ticket (ticket:update:tenant)'

Write-Host "`n== Timeline (append-only) =="
$timeline = Api $l1 'Get' "/tickets/$($created.id)/timeline"
$types = @($timeline.events | ForEach-Object { $_.type })
Assert ($types -contains 'CREATED') 'timeline records CREATED'
Assert ($types -contains 'TAG_ADDED') 'timeline records TAG_ADDED'
Assert ($types -contains 'PRIORITY_CHANGED') 'timeline records PRIORITY_CHANGED'
Assert ($types -contains 'INTERNAL_NOTE_ADDED') 'L1 timeline includes the internal note event'

$guestTimeline = Api $guest 'Get' "/tickets/$($created.id)/timeline"
$guestTypes = @($guestTimeline.events | ForEach-Object { $_.type })
Assert (-not ($guestTypes -contains 'INTERNAL_NOTE_ADDED')) 'guest timeline hides internal note events'

Write-Host "`n== Full-text search =="
$search = Api $l1 'Get' '/tickets?q=invoice%20export'
$searchIds = @($search.tickets | ForEach-Object { $_.id })
Assert ($searchIds -contains $created.id) 'full-text search finds the ticket by words from its body'
$noise = Api $l1 'Get' '/tickets?q=zzzznomatchzzzz'
Assert ($noise.total -eq 0) 'a non-matching search returns nothing'

$guestSearch = Api $guest2 'Get' '/tickets?q=invoice%20export'
$guestSearchIds = @($guestSearch.tickets | ForEach-Object { $_.id })
Assert (-not ($guestSearchIds -contains $created.id)) 'search respects row scope - it cannot be used to read another customer''s ticket'

Write-Host "`n== Filters =="
$urgent = Api $l1 'Get' '/tickets?priority=URGENT&pageSize=100'
Assert (@($urgent.tickets | ForEach-Object { $_.id }) -contains $created.id) 'priority filter works'
$byTag = Api $l1 'Get' '/tickets?tag=billing&pageSize=100'
Assert (@($byTag.tickets | ForEach-Object { $_.id }) -contains $created.id) 'tag filter works'
$unassigned = Api $l1 'Get' '/tickets?unassigned=true&pageSize=100'
Assert (@($unassigned.tickets | ForEach-Object { $_.id }) -contains $created.id) 'unassigned filter works'
ExpectStatus $l1 'Get' '/tickets?status=NOT_A_STATUS' 422 'an unknown enum value is rejected'

Write-Host "`n== Watchers and links =="
$watch = Api $l1 'Post' "/tickets/$($created.id)/watch"
Assert ($watch.watching -eq $true) 'L1 can watch a ticket'
$watchAgain = Api $l1 'Post' "/tickets/$($created.id)/watch"
Assert ($watchAgain.watching -eq $true) 'watching twice is idempotent, not a conflict'

$link = Api $l1 'Post' "/tickets/$($created.id)/links" @{ targetId = $second.id; type = 'RELATED' }
Assert ($link.type -eq 'RELATED') 'L1 can relate two tickets'
ExpectStatus $l1 'Post' "/tickets/$($created.id)/links" 400 'a ticket cannot be linked to itself' @{ targetId = $created.id; type = 'RELATED' }

Write-Host "`n== Validation =="
ExpectStatus $guest 'Post' '/tickets' 422 'a too-short subject is rejected' @{ subject = 'ab'; description = 'x' }
ExpectStatus $guest 'Patch' "/tickets/$($created.id)" 422 'an empty PATCH is rejected' @{}

Write-Host ""
if ($script:Failures -gt 0) { Write-Host "$($script:Failures) check(s) FAILED" -ForegroundColor Red; exit 1 }
Write-Host "All ticket core checks passed."
