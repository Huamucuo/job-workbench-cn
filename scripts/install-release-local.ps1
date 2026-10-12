param([Parameter(Mandatory=$true)][string]$ProjectRoot)
$ErrorActionPreference='Stop'
$releaseSourceRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\release'))
$releaseProjectRoot=[IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
if(-not(Test-Path -LiteralPath $releaseProjectRoot -PathType Container)){throw 'The explicitly selected project folder does not exist.'}
$releaseDestinationRoot=[IO.Path]::GetFullPath((Join-Path $releaseProjectRoot 'release'))
if(-not $releaseDestinationRoot.StartsWith($releaseProjectRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Destination escaped the selected project.'}
$releaseName='求职工作台-Beta-0.4.0-rc.1'
$releaseInstalledFolder=[IO.Path]::GetFullPath((Join-Path $releaseDestinationRoot $releaseName))
if(-not $releaseInstalledFolder.StartsWith($releaseDestinationRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Installed directory escaped the release folder.'}
if(Test-Path -LiteralPath $releaseInstalledFolder){throw 'This new Beta directory already exists; no version overwritten.'}
$releaseFiles=@(($releaseName+'-Windows.zip'),($releaseName+'-Windows.zip.sha256'),'求职自动填写扩展-0.4.0-rc.1.zip','求职自动填写扩展-0.4.0-rc.1.zip.sha256',($releaseName+'-源码.zip'),($releaseName+'-源码.zip.sha256'),($releaseName+'-完整历史.bundle'),($releaseName+'-完整历史.bundle.sha256'),'Beta交付清单.json')
foreach($releaseFile in $releaseFiles){$from=Join-Path $releaseSourceRoot $releaseFile;$to=Join-Path $releaseDestinationRoot $releaseFile;if(-not(Test-Path -LiteralPath $from -PathType Leaf)){throw ('Missing reviewed artifact: '+$releaseFile)};if(Test-Path -LiteralPath $to){throw ('New artifact already exists; not overwritten: '+$releaseFile)}}
# Extract only the already-reviewed, fixed-prefix Windows ZIP into a fresh directory.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$releaseZip=[IO.Compression.ZipFile]::OpenRead((Join-Path $releaseSourceRoot ($releaseName+'-Windows.zip')))
try{foreach($entry in $releaseZip.Entries){$n=$entry.FullName.Replace('\','/');if(-not $n.StartsWith($releaseName+'/') -or $n.Split('/') -contains '..' -or $n.Contains(':') -or $n.Contains('/.local/') -or $n.Contains('/.git/')){throw ('Unsafe ZIP entry: '+$n)}}}finally{$releaseZip.Dispose()}
New-Item -ItemType Directory -Path $releaseDestinationRoot -Force|Out-Null
foreach($releaseFile in $releaseFiles){Copy-Item -LiteralPath (Join-Path $releaseSourceRoot $releaseFile) -Destination (Join-Path $releaseDestinationRoot $releaseFile)}
Expand-Archive -LiteralPath (Join-Path $releaseSourceRoot ($releaseName+'-Windows.zip')) -DestinationPath $releaseDestinationRoot
$releaseJobsOriginal=Join-Path $releaseProjectRoot 'public\data\jobs.json'
if(Test-Path -LiteralPath $releaseJobsOriginal -PathType Leaf){
 $releasePrivateDir=Join-Path $releaseInstalledFolder '.local';New-Item -ItemType Directory -Path $releasePrivateDir|Out-Null
 Copy-Item -LiteralPath $releaseJobsOriginal -Destination (Join-Path $releasePrivateDir 'jobs.json')
 if((Get-FileHash -LiteralPath $releaseJobsOriginal).Hash -ne (Get-FileHash -LiteralPath (Join-Path $releasePrivateDir 'jobs.json')).Hash){throw 'Original private jobs snapshot copy did not match.'}
}
$releaseReceipt=[ordered]@{installedAt=(Get-Date).ToString('o');directory=$releaseInstalledFolder;extension=Join-Path $releaseInstalledFolder 'extension';originalRootUnchanged=$true;publicPublished=$false;dailyBrowserInstalled=$false;privateJobsSeparateFromZIP=[bool](Test-Path -LiteralPath $releaseJobsOriginal);files=@()}
foreach($releaseFile in $releaseFiles){$sourceHash=(Get-FileHash -LiteralPath (Join-Path $releaseSourceRoot $releaseFile)).Hash;$targetHash=(Get-FileHash -LiteralPath (Join-Path $releaseDestinationRoot $releaseFile)).Hash;if($sourceHash -ne $targetHash){throw ('Copied file hash mismatch: '+$releaseFile)};$releaseReceipt.files+=@{name=$releaseFile;sha256=$targetHash.ToLowerInvariant()}}
$releaseReceipt|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $releaseDestinationRoot 'Beta安装回执.json') -Encoding UTF8
$releaseReceipt|ConvertTo-Json -Depth 5
