param([string]$Bundle = '', [switch]$ShowBrowser)
$ErrorActionPreference = 'Stop'
$launcherProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $Bundle) { $Bundle = Join-Path $launcherProjectRoot 'release\求职工作台-Beta-0.4.0-rc.1' }
$launcherBundleRoot = [IO.Path]::GetFullPath($Bundle)
$launcherUrl = 'http://127.0.0.1:47841'
$launcherReport = [ordered]@{ checkedAt=(Get-Date).ToString('o'); bundle=$launcherBundleRoot; checks=@(); startupMs=$null; browserOpeningRequested=[bool]$ShowBrowser; startupWasMeasuredHuman=$false }
function Add-LauncherCheck([string]$Name, [bool]$Pass, $Details) {
 $launcherReport.checks += [ordered]@{name=$Name;passed=$Pass;details=$Details}
 if (-not $Pass) { throw ('Windows launcher check failed: ' + $Name) }
}
function Read-LauncherHealth {
 try { return Invoke-RestMethod -Uri ($launcherUrl + '/__health') -TimeoutSec 1 -Proxy $null } catch { return $null }
}
if (Read-LauncherHealth) { throw '47841 already has a service; no process stopped. Run after its owner closes it.' }
$launcherProcess = $null
try {
 $launcherTimer = [Diagnostics.Stopwatch]::StartNew()
 if ($ShowBrowser) { $launcherProcess = Start-Process -FilePath (Join-Path $launcherBundleRoot '开始使用.exe') -WindowStyle Hidden -PassThru }
 else { $launcherProcess = Start-Process -FilePath (Join-Path $launcherBundleRoot '开始使用.exe') -ArgumentList '/nobrowser' -WindowStyle Hidden -PassThru }
 if (-not $launcherProcess.WaitForExit(10000)) { throw 'Launcher itself did not exit within 10 seconds; no unrelated process stopped.' }
 $launcherTimer.Stop(); $launcherReport.startupMs = [math]::Round($launcherTimer.Elapsed.TotalMilliseconds,1)
 Add-LauncherCheck 'compiled executable exits successfully' ($launcherProcess.ExitCode -eq 0) $launcherProcess.ExitCode
 $launcherHealth = Read-LauncherHealth
 Add-LauncherCheck 'actual loopback service has expected Beta version' ($launcherHealth.app -eq 'job-workbench-cn' -and $launcherHealth.version -eq '0.4.0-beta.1') $launcherHealth
 $launcherRuntime = [Diagnostics.Process]::GetProcessById([int]$launcherHealth.pid)
 Add-LauncherCheck 'service uses the runtime bundled in this directory' ($launcherRuntime.MainModule.FileName -eq (Join-Path $launcherBundleRoot 'runtime\node.exe')) $launcherRuntime.MainModule.FileName
 $launcherListening = @(netstat.exe -ano -p TCP | Select-String ('^\s*TCP\s+\S+:47841\s+\S+\s+LISTENING\s+' + $launcherHealth.pid + '\s*$') | ForEach-Object { $_.Line.Trim() })
 Add-LauncherCheck 'service only listens on IPv4 loopback' ($launcherListening.Count -eq 1 -and $launcherListening[0] -match '^TCP\s+127\.0\.0\.1:47841\s') $launcherListening
 $launcherInstallation = Invoke-RestMethod -Uri ($launcherUrl + '/__installation') -TimeoutSec 2 -Proxy $null
 Add-LauncherCheck 'installation guide returns exact live extension directory' ($launcherInstallation.extensionDir -eq (Join-Path $launcherBundleRoot 'extension')) $launcherInstallation
 $launcherHome = Invoke-WebRequest -Uri ($launcherUrl + '/') -TimeoutSec 2 -Proxy $null -UseBasicParsing
 Add-LauncherCheck 'real homepage has import profile autofill and search entries' ($launcherHome.StatusCode -eq 200 -and $launcherHome.Content.Contains('导入简历') -and $launcherHome.Content.Contains('我的档案') -and $launcherHome.Content.Contains('自动填写') -and $launcherHome.Content.Contains('招聘搜索')) $launcherHome.StatusCode
 $launcherNodeHash = (Get-FileHash -LiteralPath (Join-Path $launcherBundleRoot 'runtime\node.exe') -Algorithm SHA256).Hash
 $launcherReport.runtimeSHA256=$launcherNodeHash.ToLowerInvariant()
 $launcherReport.launcherSHA256=(Get-FileHash -LiteralPath (Join-Path $launcherBundleRoot '开始使用.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
} finally {
 # This executable checks PID, binary path and start time before stopping its own service.
 if ((Test-Path -LiteralPath (Join-Path $launcherBundleRoot '.local\windows-server.json')) -and (Read-LauncherHealth)) {
  $launcherStopProcess=Start-Process -FilePath (Join-Path $launcherBundleRoot '停止工作台.exe') -ArgumentList '/nobrowser' -WindowStyle Hidden -PassThru
  $launcherStopProcess.WaitForExit(10000) | Out-Null
  Add-LauncherCheck 'stop executable exits successfully' ($launcherStopProcess.ExitCode -eq 0) $launcherStopProcess.ExitCode
  Add-LauncherCheck 'only the owned local service stopped' (-not (Read-LauncherHealth)) $null
 }
 $launcherReport.passed=$launcherReport.checks.Count -eq 8 -and @($launcherReport.checks | Where-Object { -not $_.passed }).Count -eq 0
 $launcherOutputDir=Join-Path $launcherProjectRoot '.local'
 New-Item -ItemType Directory -Path $launcherOutputDir -Force | Out-Null
 $launcherReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $launcherOutputDir 'windows-launcher-test.json') -Encoding utf8
 $launcherReport | ConvertTo-Json -Depth 4
}
