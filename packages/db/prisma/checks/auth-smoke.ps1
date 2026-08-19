# ---------------------------------------------------------------------------
# Authentication and RBAC smoke check against a running stack.
#
#   pwsh packages/db/prisma/checks/auth-smoke.ps1
#
# Asserts the parts of the requirements' RBAC matrix that are not simple booleans,
# plus refresh-token rotation and replay detection. Every check prints PASS or FAIL
# and the script exits non-zero if anything failed, so it is usable in CI.
# ---------------------------------------------------------------------------
param([string]$BaseUrl = "http://localhost:4000")

$ErrorActionPreference = "Stop"
$script:Failures = 0

function Assert($condition, $message) {
  if ($condition) {
    Write-Host "  PASS  $message"
  } else {
    Write-Host "  FAIL  $message" -ForegroundColor Red
    $script:Failures++
  }
}

function Login($email, $tenantSlug) {
  $payload = @{ email = $email; password = 'AbiDesk!2026'; tenantSlug = $tenantSlug } | ConvertTo-Json -Compress
  return Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" `
    -ContentType 'application/json' -Body $payload
}

Write-Host "`n== RBAC matrix, enforced from seeded data =="

# --- L1: full support baseline, but Bulk Update is the "Optional" cell (default off)
$l1 = Login 'nina.patel@acme.example' 'acme'
Assert ($l1.roles -contains 'L1_SUPPORT') 'L1 signs in and holds L1_SUPPORT'
Assert ($l1.permissions -contains 'ticket:note:internal') 'L1 has Internal Notes'
Assert ($l1.permissions -contains 'ticket:read:tenant')   'L1 has View All Tenant Tickets'
Assert ($l1.permissions -contains 'ticket:assign:agent')  'L1 has Assign Ticket'
Assert ($l1.permissions -contains 'ticket:escalate')      'L1 has Escalate'
Assert ($l1.permissions -contains 'ticket:close')         'L1 has Close'
Assert (-not ($l1.permissions -contains 'ticket:bulk_update')) 'L1 Bulk Update is OFF (Optional, default off)'

# --- Guest: own tickets only, no internal notes, cannot assign/escalate/close
$guest = Login 'june.carter@northwind.example' 'acme'
Assert ($guest.roles -contains 'GUEST_CUSTOMER') 'Guest signs in and holds GUEST_CUSTOMER'
Assert ($guest.permissions -contains 'ticket:read:own')  'Guest has View Own Tickets'
Assert (-not ($guest.permissions -contains 'ticket:read:tenant'))   'Guest CANNOT View All Tenant Tickets'
Assert (-not ($guest.permissions -contains 'ticket:note:internal')) 'Guest CANNOT use Internal Notes'
Assert (-not ($guest.permissions -contains 'ticket:assign:agent'))  'Guest CANNOT Assign'
Assert (-not ($guest.permissions -contains 'ticket:assign:queue'))  'Guest CANNOT Assign to queue'
Assert (-not ($guest.permissions -contains 'ticket:escalate'))      'Guest CANNOT Escalate'
Assert (-not ($guest.permissions -contains 'ticket:close'))         'Guest CANNOT Close'
Assert ($guest.permissions -contains 'ticket:confirm_resolution')   'Guest CAN confirm a resolution (not the same as Close)'
Assert ($guest.permissions -contains 'capture:screenshot')          'Guest CAN Capture Screenshot'
Assert ($guest.permissions -contains 'capture:screen_recording')    'Guest CAN Screen Record'

# --- Tenant Admin: the "Queue" cell, and Internal Notes explicitly withheld
$admin = Login 'admin@acme.example' 'acme'
Assert ($admin.roles -contains 'TENANT_ADMIN') 'Tenant Admin signs in'
Assert ($admin.permissions -contains 'ticket:assign:queue')          'Admin CAN assign to a queue ("Queue")'
Assert (-not ($admin.permissions -contains 'ticket:assign:agent'))   'Admin CANNOT assign to a named agent ("Queue" only)'
Assert ($admin.permissions -contains 'ticket:escalate')              'Admin Escalate is ON (Optional, default on)'
Assert ($admin.permissions -contains 'ticket:close')                 'Admin Close is ON (Optional, default on)'
Assert (-not ($admin.permissions -contains 'ticket:note:internal'))  'Admin CANNOT use Internal Notes (matrix says no)'
Assert (-not ($admin.permissions -contains 'ticket:bulk_update'))    'Admin CANNOT Bulk Update'
Assert ($admin.permissions -contains 'admin:widget:configure')       'Admin can Configure Widget'
Assert ($admin.permissions -contains 'admin:sso:manage')             'Admin can configure SSO'
Assert ($admin.permissions -contains 'admin:sla:manage')             'Admin can manage SLA policies'
Assert ($admin.permissions -contains 'admin:automation:manage')      'Admin can manage Automation Rules'
Assert ($admin.permissions -contains 'admin:apikey:manage')          'Admin can manage API Keys'
Assert ($admin.permissions -contains 'admin:webhook:manage')         'Admin can manage Webhooks'
Assert ($admin.permissions -contains 'audit:read')                   'Admin can read Audit Logs'

# --- L2 gets Bulk Update outright (matrix tick, not optional)
$l2 = Login 'dana.whitfield@acme.example' 'acme'
Assert ($l2.permissions -contains 'ticket:bulk_update') 'L2 has Bulk Update'

# --- Dev and QA cover the engineering half of the workflow
$dev = Login 'sofia.marchetti@acme.example' 'acme'
Assert ($dev.permissions -contains 'ticket:transition:qa') 'Dev can hand work to QA'
$qa = Login 'ben.okafor@acme.example' 'acme'
Assert ($qa.permissions -contains 'ticket:transition:release') 'QA can promote to Release'

Write-Host "`n== Authenticated identity =="

$headers = @{ Authorization = "Bearer $($l1.accessToken)" }
$me = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/me" -Headers $headers
Assert ($me.user.email -eq 'nina.patel@acme.example') '/auth/me returns the signed-in user'
Assert ($me.tenantId -eq '11111111-1111-1111-1111-111111111111') '/auth/me returns the tenant'
Assert ($me.permissions.Count -gt 20) "/auth/me returns resolved permissions ($($me.permissions.Count))"

try {
  Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/me" | Out-Null
  Assert $false 'unauthenticated /auth/me is rejected'
} catch {
  Assert ([int]$_.Exception.Response.StatusCode -eq 401) 'unauthenticated /auth/me returns 401'
}

Write-Host "`n== Refresh rotation and replay detection =="

$refreshPayload = @{ refreshToken = $l1.refreshToken } | ConvertTo-Json -Compress
$rotated = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/refresh" `
  -ContentType 'application/json' -Body $refreshPayload

Assert ($rotated.accessToken -ne $l1.accessToken)   'refresh issues a new access token'
Assert ($rotated.refreshToken -ne $l1.refreshToken) 'refresh rotates the refresh token'

# Presenting the spent token proves two parties hold the chain -> revoke the family.
try {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/refresh" `
    -ContentType 'application/json' -Body $refreshPayload | Out-Null
  Assert $false 'replayed refresh token is rejected'
} catch {
  $status = [int]$_.Exception.Response.StatusCode
  Assert ($status -eq 401) "replayed refresh token is rejected ($status)"
}

# The whole family is now dead, so even the freshly rotated token must fail.
$rotatedPayload = @{ refreshToken = $rotated.refreshToken } | ConvertTo-Json -Compress
try {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/refresh" `
    -ContentType 'application/json' -Body $rotatedPayload | Out-Null
  Assert $false 'family revocation invalidates the rotated token too'
} catch {
  Assert $true 'replay revoked the entire session family, not just the reused token'
}

Write-Host "`n== Account protection =="

# Wrong password must not reveal whether the account exists.
$badPayload = @{ email = 'nina.patel@acme.example'; password = 'wrong-password'; tenantSlug = 'acme' } | ConvertTo-Json -Compress
try {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -ContentType 'application/json' -Body $badPayload | Out-Null
  Assert $false 'wrong password is rejected'
} catch {
  Assert ([int]$_.Exception.Response.StatusCode -eq 401) 'wrong password returns 401'
}

$unknownPayload = @{ email = 'nobody@nowhere.example'; password = 'AbiDesk!2026'; tenantSlug = 'acme' } | ConvertTo-Json -Compress
try {
  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" -ContentType 'application/json' -Body $unknownPayload | Out-Null
  Assert $false 'unknown account is rejected'
} catch {
  Assert ([int]$_.Exception.Response.StatusCode -eq 401) 'unknown account returns the same 401 (no enumeration)'
}

Write-Host ""
if ($script:Failures -gt 0) {
  Write-Host "$($script:Failures) check(s) FAILED" -ForegroundColor Red
  exit 1
}
Write-Host "All authentication and RBAC checks passed."
