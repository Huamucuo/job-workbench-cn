$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pidFile = Join-Path $projectRoot '.local\server.pid.json'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'No launcher-owned server recorded.'; exit 0 }
$record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
$expectedScript = Join-Path $projectRoot 'scripts\serve.mjs'
if ($record.script -ne $expectedScript) { throw 'Server record does not belong to this project.' }
$running = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$record.pid)
if ($running -and $running.Name -eq 'node.exe' -and $running.CommandLine.Contains($expectedScript)) {
  Stop-Process -Id ([int]$record.pid)
  Write-Output 'Job Workbench stopped. Browser data remains on this computer.'
} else { Write-Output 'Server already stopped or process is not owned by this project.' }
