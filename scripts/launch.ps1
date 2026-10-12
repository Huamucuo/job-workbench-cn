param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$url = 'http://127.0.0.1:47831'
try {
  $health = Invoke-RestMethod -Uri "$url/__health" -TimeoutSec 2 -Proxy $null
  if ($health.app -eq 'job-workbench-cn') { if (-not $NoBrowser) { Start-Process $url }; exit 0 }
  throw 'Port 47831 is used by another app.'
} catch {
  if ($_.Exception.Message -eq 'Port 47831 is used by another app.') { throw }
}
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js 24+ is required. Install it free from https://nodejs.org/ and retry.' }
$nodeMajor = [int]((& $nodeCommand.Source --version).Trim().TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24) { throw 'Please update Node.js to version 24 or later: https://nodejs.org/' }
$localDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $localDir -Force | Out-Null
$serverScript = Join-Path $projectRoot 'scripts\serve.mjs'
$proc = Start-Process -FilePath $nodeCommand.Source -ArgumentList @(('"' + $serverScript + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localDir 'server.log') -RedirectStandardError (Join-Path $localDir 'server-error.log') -PassThru
$started = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 200
  try { $health = Invoke-RestMethod -Uri "$url/__health" -TimeoutSec 1 -Proxy $null; if ($health.app -eq 'job-workbench-cn') { $started = $true; break } } catch { }
  if ($proc.HasExited) { break }
}
if (-not $started) { throw 'Could not start. Please read .local/server-error.log.' }
@{pid=$health.pid;script=$serverScript;startedAt=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $localDir 'server.pid.json') -Encoding utf8
if (-not $NoBrowser) { Start-Process $url }
Write-Output "Job Workbench ready: $url"
