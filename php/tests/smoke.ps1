$ErrorActionPreference = 'Stop'
$php = 'C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe'
if (!(Test-Path $php)) { $php = (Get-Command php).Source }
$previous = $env:BLOG_DATA_DIR
$env:BLOG_DATA_DIR = Join-Path $env:TEMP ('blog-test-' + [guid]::NewGuid())
$router = Join-Path (Split-Path $PSScriptRoot) 'router.php'
$server = Start-Process $php -ArgumentList @('-S','127.0.0.1:8027',$router) -WindowStyle Hidden -PassThru
$base = 'http://127.0.0.1:8027/api'
function Assert($ok, $message) { if (!$ok) { throw $message } }
function Send($path,$method,$body,$session,$token) {
 Invoke-RestMethod "$base$path" -Method $method -Body ($body | ConvertTo-Json) -ContentType 'application/json' -WebSession $session -Headers @{'X-CSRF-Token'=$token}
}
function Denied($path,$method,$session,$token,$expected) {
 try { Invoke-WebRequest "$base$path" -UseBasicParsing -Method $method -WebSession $session -Headers @{'X-CSRF-Token'=$token} | Out-Null; throw 'Unexpected success' }
 catch { Assert ($_.Exception.Response.StatusCode.value__ -eq $expected) "Expected HTTP $expected for $path" }
}
try {
 Start-Sleep -Seconds 1
 $s=Invoke-RestMethod "$base/session" -SessionVariable a
 $u=Send '/register' 'POST' @{name='Author';email='author@example.com';password='password123';confirmPassword='password123'} $a $s.csrf
 Assert ($u.id -gt 0) 'Registration failed'
 $p=Send '/posts' 'POST' @{title='Test article';content='This is the article content.';published='0'} $a $s.csrf
 $guest=Invoke-RestMethod "$base/session" -SessionVariable b
 Denied "/posts/$($p.id)" GET $b $guest.csrf 404
 Assert ((Invoke-RestMethod "$base/posts" -WebSession $b).Count -eq 0) 'Draft leaked'
 Send '/register' POST @{name='Other';email='other@example.com';password='password123';confirmPassword='password123'} $b $guest.csrf | Out-Null
 Denied "/posts/$($p.id)" DELETE $b $guest.csrf 403
 Denied '/posts' POST $a 'wrong-token' 403
 Send "/posts/$($p.id)" POST @{title='Published article';content='This is the updated article content.';published='1'} $a $s.csrf | Out-Null
 Assert ((Invoke-RestMethod "$base/posts?search=Published" -WebSession $b).Count -eq 1) 'Search failed'
 Send '/contacts' POST @{name='Tester';email='test@example.com';message='Test inquiry'} $b $guest.csrf | Out-Null
 Send '/logout' POST @{} $a $s.csrf | Out-Null
 Denied '/posts?mine=1' GET $a $s.csrf 401
 Send '/login' POST @{email='author@example.com';password='password123'} $a $s.csrf | Out-Null
 Invoke-RestMethod "$base/posts/$($p.id)" -Method Delete -WebSession $a -Headers @{'X-CSRF-Token'=$s.csrf} | Out-Null
 Denied "/posts/$($p.id)" GET $a $s.csrf 404
 Write-Output 'PASS: registration, login, logout, CRUD, search, drafts, ownership, CSRF, contacts'
} finally { Stop-Process -Id $server.Id -ErrorAction SilentlyContinue; $env:BLOG_DATA_DIR = $previous }
