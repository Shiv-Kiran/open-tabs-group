$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$releasePath = Join-Path $projectRoot "release"
$zipName = "mindweave-v0.1.1.zip"
$zipPath = Join-Path $releasePath $zipName

if (-not (Test-Path $distPath)) {
  throw "Build output not found at $distPath. Run npm run build first."
}

New-Item -ItemType Directory -Path $releasePath -Force | Out-Null

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $distPath "*") -DestinationPath $zipPath -Force
Write-Output "Created package: $zipPath"
