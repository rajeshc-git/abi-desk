# ---------------------------------------------------------------------------
# Media, attachments and diagnostics smoke check.
#
# Drives the real three-legged upload flow end to end - reserve, PUT to MinIO, confirm -
# so the presigned URL, the magic-byte verification and the storage round trip are all
# genuinely exercised rather than mocked.
#
# The assertions that matter are the refusals. Anyone can make an upload succeed; what
# earns trust is that a text file declared as a PNG gets quarantined, that a size which
# disagrees with storage is rejected, that one tenant cannot fetch another's attachment,
# and that a customer cannot read back the console trace their own widget submitted.
# ---------------------------------------------------------------------------
param([string]$BaseUrl = "http://localhost:4000")

$ErrorActionPreference = "Stop"
# Invoke-WebRequest's progress stream floods the transcript when uploading bytes.
$ProgressPreference = "SilentlyContinue"
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
  if ($body) { $p.ContentType = 'application/json'; $p.Body = ($body | ConvertTo-Json -Compress -Depth 8) }
  return Invoke-RestMethod @p
}

function ExpectFail($session, $method, $path, $expected, $message, $body) {
  try { Api $session $method $path $body | Out-Null; Assert $false "$message (expected $expected, got success)" }
  catch { $s = [int]$_.Exception.Response.StatusCode; Assert ($s -eq $expected) "$message (got $s)" }
}

# A genuinely valid 1x1 PNG. Real bytes, so the server's magic-byte check has something
# truthful to agree with.
$PngBytes = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+AAAAAElFTkSuQmCC')

# Uploads bytes to a presigned URL exactly as a browser would.
function PutBytes($url, $bytes, $contentType) {
  Invoke-WebRequest -Method Put -Uri $url -Body $bytes -ContentType $contentType -UseBasicParsing | Out-Null
}

Write-Host "`n== Sessions =="
$guest  = Login 'june.carter@northwind.example' 'acme'
$guest2 = Login 'felix.brandt@northwind.example' 'acme'
$l1     = Login 'nina.patel@acme.example' 'acme'
$gx     = Login 'support@globex.example' 'globex'
Assert $true 'signed in as two Acme guests, an Acme L1 and a Globex agent'

$ticket = Api $guest 'Post' '/tickets' @{ subject = 'Media: upload flow'; description = 'Attachment fixture.' }
Assert ($ticket.id -ne $null) 'a guest created a ticket to attach media to'

Write-Host "`n== Leg 1: reserve returns a presigned PUT =="
$res = Api $guest 'Post' '/media/uploads' @{
  kind = 'SCREENSHOT'; ticketId = $ticket.id; originalFilename = 'shot.png'
  declaredMimeType = 'image/png'; sizeBytes = $PngBytes.Length
}
Assert ($res.media.status -eq 'PENDING_UPLOAD') 'the asset starts PENDING_UPLOAD'
Assert ($res.upload.url -like 'http*') 'a presigned upload URL was issued'
Assert ($res.upload.method -eq 'PUT') 'it is a PUT'
Assert ($res.media.PSObject.Properties.Name -notcontains 'storageKey') 'the object key is NOT exposed to the client'
Assert ($res.upload.url -notlike '*minio:9000*') 'the URL is signed with a host the client can actually reach, not the internal one'
$mediaId = $res.media.id

Write-Host "`n== Confirm is refused until the bytes exist =="
ExpectFail $guest 'Post' "/media/$mediaId/confirm" 422 'confirming before uploading is refused' @{}

Write-Host "`n== Leg 2 and 3: upload then confirm =="
PutBytes $res.upload.url $PngBytes 'image/png'
$confirmed = Api $guest 'Post' "/media/$mediaId/confirm" @{}
Assert ($confirmed.status -eq 'UPLOADED') 'the asset is UPLOADED after the bytes land'
Assert ($confirmed.mimeType -eq 'image/png') 'the stored type came from the magic bytes'
Assert ($confirmed.sizeBytes -eq $PngBytes.Length) 'the recorded size matches storage'
ExpectFail $guest 'Post' "/media/$mediaId/confirm" 409 'confirming twice is refused' @{}

Write-Host "`n== A lie about content type is quarantined =="
# Declared image/png, actually a text file. This is the stored-XSS vector the check exists
# to stop: served back as image/png it is inert, served as its real type it is not.
$textBytes = [Text.Encoding]::UTF8.GetBytes('<html><script>alert(1)</script></html>')
$liar = Api $guest 'Post' '/media/uploads' @{
  kind = 'ATTACHMENT'; ticketId = $ticket.id; originalFilename = 'evil.png'
  declaredMimeType = 'image/png'; sizeBytes = $textBytes.Length
}
PutBytes $liar.upload.url $textBytes 'image/png'
ExpectFail $guest 'Post' "/media/$($liar.media.id)/confirm" 422 'content that is not the declared type is refused' @{}
ExpectFail $guest 'Post' "/media/$($liar.media.id)/download" 403 'and the quarantined asset cannot be downloaded' @{}

Write-Host "`n== A size that disagrees with the signature is refused by storage itself =="
# Content-Length is bound into the presigned signature, so a client physically cannot
# reuse the URL for a different number of bytes than was approved. That is a stronger
# guarantee than checking after the fact, and it is why the server-side size comparison
# in confirmUpload is defence in depth rather than the primary control.
$short = Api $guest 'Post' '/media/uploads' @{
  kind = 'ATTACHMENT'; ticketId = $ticket.id; declaredMimeType = 'image/png'
  sizeBytes = ($PngBytes.Length + 500)
}
$storageRefused = $false
try { PutBytes $short.upload.url $PngBytes 'image/png' } catch { $storageRefused = $true }
Assert $storageRefused 'uploading fewer bytes than were signed for is rejected by storage'
ExpectFail $guest 'Post' "/media/$($short.media.id)/confirm" 422 'so the asset can never be confirmed and stays unusable' @{}

Write-Host "`n== Limits and allow-list are enforced before signing =="
ExpectFail $guest 'Post' '/media/uploads' 422 'an unsupported content type is refused' @{
  kind = 'ATTACHMENT'; ticketId = $ticket.id; declaredMimeType = 'application/x-msdownload'; sizeBytes = 10
}
ExpectFail $guest 'Post' '/media/uploads' 422 'a file above the tenant byte limit is refused' @{
  kind = 'ATTACHMENT'; ticketId = $ticket.id; declaredMimeType = 'image/png'; sizeBytes = 99999999
}

Write-Host "`n== Download and listing respect ticket scope =="
$dl = Api $guest 'Post' "/media/$mediaId/download" @{}
Assert ($dl.url -like 'http*') 'the uploader gets a signed download URL'
$fetched = Invoke-WebRequest -Uri $dl.url -UseBasicParsing
Assert ($fetched.StatusCode -eq 200) 'the signed URL actually serves the bytes'
Assert ($fetched.RawContentLength -eq $PngBytes.Length) 'and serves exactly the bytes that were uploaded'

$listed = Api $l1 'Get' "/tickets/$($ticket.id)/media"
Assert ($listed.Count -ge 1) 'an agent sees the ticket attachments'
Assert (($listed | Where-Object { $_.status -eq 'QUARANTINED' }).Count -eq 0) 'quarantined assets are not listed'

ExpectFail $guest2 'Post' "/media/$mediaId/download" 404 'another customer cannot download it (404, not 403)'
ExpectFail $guest2 'Get' "/tickets/$($ticket.id)/media" 404 'another customer cannot list the attachments'
ExpectFail $gx 'Post' "/media/$mediaId/download" 404 'a different TENANT cannot download it'
ExpectFail $gx 'Get' "/tickets/$($ticket.id)/media" 404 'a different tenant cannot list the attachments'

Write-Host "`n== Unattached uploads are private to their uploader =="
$loose = Api $guest 'Post' '/media/uploads' @{
  kind = 'SCREENSHOT'; declaredMimeType = 'image/png'; sizeBytes = $PngBytes.Length
}
PutBytes $loose.upload.url $PngBytes 'image/png'
Api $guest 'Post' "/media/$($loose.media.id)/confirm" @{} | Out-Null
$looseDl = Api $guest 'Post' "/media/$($loose.media.id)/download" @{}
Assert ($looseDl.url -like 'http*') 'the widget can re-read its own upload before a ticket exists'
ExpectFail $guest2 'Post' "/media/$($loose.media.id)/download" 404 'nobody else can, even in the same tenant'

Write-Host "`n== Deletion drops the bytes and keeps the record =="
Api $guest 'Delete' "/media/$($loose.media.id)" | Out-Null
ExpectFail $guest 'Post' "/media/$($loose.media.id)/download" 404 'a deleted asset is no longer downloadable'

Write-Host "`n== Diagnostics: server-side redaction =="
$diag = Api $guest 'Put' "/tickets/$($ticket.id)/diagnostics" @{
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  pageUrl = 'https://app.northwind.example/billing?api_key=sk_live_9f8a7b6c5d4e3f2a1b'
  pageTitle = 'Billing'
  userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  browserName = 'Chrome'; osName = 'Windows'; deviceType = 'desktop'
  viewportWidth = 1920; viewportHeight = 1080
  consoleEntries = @(
    @{ level = 'error'; message = 'Auth failed for accounts.payable@northwind.example'; timestamp = 1 },
    @{ level = 'error'; message = 'Retry with Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def'; timestamp = 2 },
    @{ level = 'warn';  message = 'Slow response'; timestamp = 3 },
    @{ level = 'info';  message = 'Card 4242424242424242 declined'; timestamp = 4 }
  )
  networkEntries = @(
    @{ method = 'POST'; url = 'https://api.northwind.example/pay'; status = 500; durationMs = 1200; failed = $true; authorization = 'Bearer secret-token-value' },
    @{ method = 'GET';  url = 'https://api.northwind.example/me'; status = 200; durationMs = 90; failed = $false }
  )
  jsErrors = @(@{ message = 'TypeError: undefined'; stack = 'at pay()'; source = 'app.js'; line = 42; column = 7; kind = 'error' })
  performanceMetrics = @{ lcp = 2400; cls = 0.03; ttfb = 180 }
}
Assert ($diag.id -ne $null) 'the bundle was stored'
Assert ($diag.redactionsApplied -contains 'email') 'an email address was redacted'
Assert ($diag.redactionsApplied -contains 'bearer_token') 'a bearer token was redacted'
Assert ($diag.redactionsApplied -contains 'secret_key_value') 'an api_key in the URL was redacted'
Assert ($diag.redactionsApplied -contains 'sensitive_key') 'an authorization key was dropped by name'
Assert ($diag.redactionsApplied -contains 'card_number') 'a Luhn-valid card number was redacted'
Assert ($diag.counts.consoleErrors -eq 2) 'console errors were counted'
Assert ($diag.counts.consoleWarnings -eq 1) 'console warnings were counted'
Assert ($diag.counts.networkFailures -eq 1) 'network failures were counted'
Assert ($diag.counts.jsErrors -eq 1) 'JS errors were counted'

Write-Host "`n== Reading diagnostics back is a separate privilege =="
ExpectFail $guest 'Get' "/tickets/$($ticket.id)/diagnostics" 403 'the customer who SUBMITTED it cannot read the traces back'
$summary = Api $guest 'Get' "/tickets/$($ticket.id)/diagnostics/summary"
Assert ($summary.jsErrorCount -eq 1) 'but the customer can see the counts summary'
Assert ($summary.PSObject.Properties.Name -notcontains 'consoleEntries') 'the summary carries no captured content'

$full = Api $l1 'Get' "/tickets/$($ticket.id)/diagnostics"
Assert ($full.consoleEntries.Count -eq 4) 'an agent reads the full console trace'
$asText = ($full.consoleEntries | ConvertTo-Json -Depth 6)
Assert ($asText -notmatch 'accounts\.payable@northwind\.example') 'the stored console trace contains NO raw email'
Assert ($asText -notmatch 'eyJhbGciOiJIUzI1NiJ9') 'the stored console trace contains NO raw JWT'
Assert ($asText -notmatch '4242424242424242') 'the stored console trace contains NO raw card number'
Assert ($asText -match 'REDACTED') 'it carries the redaction marker instead'
Assert ($full.page.url -notmatch 'sk_live_') 'the stored page URL has no raw api key'
$netText = ($full.networkEntries | ConvertTo-Json -Depth 6)
Assert ($netText -notmatch 'secret-token-value') 'the authorization header value was not stored'
Assert ($full.redactionsApplied.Count -ge 4) 'the applied rules are recorded for audit'

ExpectFail $gx 'Get' "/tickets/$($ticket.id)/diagnostics" 404 'a different tenant cannot read the bundle'
ExpectFail $gx 'Get' "/tickets/$($ticket.id)/diagnostics/summary" 404 'nor the summary'

Write-Host "`n== Re-submitting replaces rather than duplicating =="
$again = Api $guest 'Put' "/tickets/$($ticket.id)/diagnostics" @{
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  pageUrl = 'https://app.northwind.example/billing'
  userAgent = 'Mozilla/5.0'
  consoleEntries = @(@{ level = 'error'; message = 'second capture'; timestamp = 9 })
}
Assert ($again.id -eq $diag.id) 'a retry updates the same bundle (one per ticket)'
Assert ($again.counts.consoleErrors -eq 1) 'and replaces the previous contents'

Write-Host "`n== Oversized captures are truncated, not rejected =="
$many = @(); 1..260 | ForEach-Object { $many += @{ level = 'info'; message = "line $_"; timestamp = $_ } }
$trunc = Api $guest 'Put' "/tickets/$($ticket.id)/diagnostics" @{
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  pageUrl = 'https://app.northwind.example/x'; userAgent = 'Mozilla/5.0'
  consoleEntries = $many
}
Assert ($trunc.counts.consoleEntries -le 200) 'the console buffer was capped at the tenant limit'
Assert ($trunc.truncated.consoleEntries -gt 0) 'and the number dropped is reported'

Write-Host "`n== Diagnostics require a ticket in scope =="
ExpectFail $guest2 'Put' "/tickets/$($ticket.id)/diagnostics" 404 'a customer cannot attach diagnostics to someone else''s ticket' @{
  capturedAt = (Get-Date).ToUniversalTime().ToString('o'); pageUrl = 'https://x.example'; userAgent = 'UA'
}

Write-Host ""
if ($script:Failures -eq 0) { Write-Host "All media and diagnostics checks passed." -ForegroundColor Green }
else { Write-Host "$($script:Failures) check(s) FAILED." -ForegroundColor Red; exit 1 }
