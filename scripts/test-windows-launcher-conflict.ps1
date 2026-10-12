param([string]$Bundle = '')
$ErrorActionPreference = 'Stop'
$launcherProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $Bundle) { $Bundle = Join-Path $launcherProjectRoot 'release\求职工作台-Beta-0.4.1-rc.1' }
$launcherBundleRoot = [IO.Path]::GetFullPath($Bundle)
$conflictRoot = Join-Path $launcherProjectRoot ('.local\launcher-conflict-' + [Guid]::NewGuid().ToString('N'))
$launcherUrl = 'http://127.0.0.1:47841'
$conflictReport = [ordered]@{checkedAt=(Get-Date).ToString('o');bundle=$launcherBundleRoot;checks=@()}
function Read-ConflictHealth { try { Invoke-RestMethod -Uri ($launcherUrl+'/__health') -TimeoutSec 1 -Proxy $null } catch { $null } }
function Run-QuietLauncher([string]$Path) { $p=Start-Process -FilePath $Path -ArgumentList '/nobrowser' -WindowStyle Hidden -PassThru; if(-not $p.WaitForExit(10000)){throw 'Launcher did not exit'}; return $p.ExitCode }
function Check-Conflict([string]$Name,[bool]$Passed,$Details) { $conflictReport.checks += [ordered]@{name=$Name;passed=$Passed;details=$Details};if(-not $Passed){throw ('Launcher boundary failed: '+$Name)} }
if(Read-ConflictHealth){throw 'Port is already in use; no other service stopped.'}
New-Item -ItemType Directory -Path (Join-Path $conflictRoot '.local') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $launcherBundleRoot '开始使用.exe') -Destination (Join-Path $conflictRoot '开始使用.exe')
Copy-Item -LiteralPath (Join-Path $launcherBundleRoot '停止工作台.exe') -Destination (Join-Path $conflictRoot '停止工作台.exe')
try {
 Check-Conflict 'owned release starts' ((Run-QuietLauncher (Join-Path $launcherBundleRoot '开始使用.exe')) -eq 0) $null
 $originalService=Read-ConflictHealth
 Check-Conflict 'same directory safely reuses the same service' ((Run-QuietLauncher (Join-Path $launcherBundleRoot '开始使用.exe')) -eq 0 -and (Read-ConflictHealth).pid -eq $originalService.pid) $originalService.pid
 $foreignStart=Run-QuietLauncher (Join-Path $conflictRoot '开始使用.exe')
 $conflictMessagePath=Join-Path $conflictRoot '.local\launcher-error.txt'
 $message=if(Test-Path -LiteralPath $conflictMessagePath){Get-Content -LiteralPath $conflictMessagePath -Raw -Encoding UTF8}else{''}
 Check-Conflict 'another directory cannot silently open the wrong Beta copy' ($foreignStart -eq 1 -and $message.Contains('另一份Beta工作台') -and (Read-ConflictHealth).pid -eq $originalService.pid) @{exitCode=$foreignStart;message=$message}
 Copy-Item -LiteralPath (Join-Path $launcherBundleRoot '.local\windows-server.json') -Destination (Join-Path $conflictRoot '.local\windows-server.json')
 Check-Conflict 'copied PID record cannot stop a service from another directory' ((Run-QuietLauncher (Join-Path $conflictRoot '停止工作台.exe')) -eq 1 -and (Read-ConflictHealth).pid -eq $originalService.pid) $originalService.pid
} finally {
 if ((Test-Path -LiteralPath (Join-Path $launcherBundleRoot '.local\windows-server.json')) -and (Read-ConflictHealth)) { Run-QuietLauncher (Join-Path $launcherBundleRoot '停止工作台.exe') | Out-Null }
 $conflictReport.passed=$conflictReport.checks.Count -eq 4 -and @($conflictReport.checks|Where-Object {-not $_.passed}).Count -eq 0
 $conflictReport|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $launcherProjectRoot '.local\windows-launcher-conflict-test.json') -Encoding UTF8
 $conflictReport|ConvertTo-Json -Depth 5
}
