# install-profile.ps1 — local install of Kidai Plugin Market Hub (纪代插件市场
# Hub, npm package kidai-plugin-market-hub) into a DSH profile.
#
# Copies this package into <profileDir>/node_modules, records it as a
# dependency, and appends it to dsh.profile.bundles (the plugin's
# cordis.patch.yml is then applied on next launch). Equivalent to
#   dsh plugin --profile <name> add file:.<path>
# but without needing pnpm on PATH.
#
# Also migrates away from the previous package name: if the profile still
# references `dsh-plugin-market` (dependency, bundle layer, or directory),
# it is removed and replaced by the new name.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/install-profile.ps1
#         powershell -ExecutionPolicy Bypass -File scripts/install-profile.ps1 -Profile web -DshHome C:\Users\you\.dsh

param(
    [string]$Profile = "desktop",
    [string]$DshHome = ""
)

$ErrorActionPreference = "Stop"

if ($DshHome -eq "") {
    $DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME ".dsh" }
}
$profileDir = Join-Path $DshHome (Join-Path "profiles" $Profile)
$manifestPath = Join-Path $profileDir "package.json"

if (-not (Test-Path $manifestPath)) {
    Write-Error "Profile not found: $profileDir (run 'dsh plugin --profile $Profile add <pkg>' first, or pick another -Profile)"
}

$packageDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageName = "kidai-plugin-market-hub"
$legacyName = "dsh-plugin-market"

# 0. drop the legacy package name from the profile (dependency, bundles, dir)
$legacyTarget = Join-Path $profileDir (Join-Path "node_modules" $legacyName)
if (Test-Path $legacyTarget) { Remove-Item -Recurse -Force $legacyTarget }

# 1. copy package into the profile's node_modules (exclude node_modules/.git)
$target = Join-Path $profileDir (Join-Path "node_modules" $packageName)
New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
robocopy $packageDir $target /E /XD node_modules .git /XF *.map | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Error "robocopy failed with exit $LASTEXITCODE" }

# 2. record the dependency and the bundle layer (write BOM-less UTF-8 JSON)
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if (-not $manifest.dependencies) { $manifest | Add-Member -NotePropertyName dependencies -NotePropertyValue ([ordered]@{}) }
$deps = $manifest.dependencies
if ($deps.PSObject.Properties[$legacyName]) { $deps.PSObject.Properties.Remove($legacyName) }
if (-not $deps.PSObject.Properties[$packageName]) {
    # External file: spec pointing at this package's real source directory.
    # A self-reference like "file:./node_modules/$packageName" is circular
    # (that path does not exist at reinstall time) and can brick the profile.
    $deps | Add-Member -NotePropertyName $packageName -NotePropertyValue ("file:" + ($packageDir -replace "\\", "/"))
}
if (-not $manifest.dsh) { $manifest | Add-Member -NotePropertyName dsh -NotePropertyValue ([ordered]@{}) }
if (-not $manifest.dsh.profile) { $manifest.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([ordered]@{}) }
$bundles = $manifest.dsh.profile.bundles
if (-not $bundles) {
    $bundles = @()
    $manifest.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue $bundles
}
$bundles = @($bundles | Where-Object { $_ -ne $legacyName })
if ($bundles -notcontains $packageName) {
    $bundles += $packageName
    $manifest.dsh.profile.bundles = $bundles
}

$json = $manifest | ConvertTo-Json -Depth 12
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, $json + "`n", $utf8NoBom)

Write-Host "Installed $packageName into $profileDir"
Write-Host "Restart DSH, then open Settings -> Plugins -> 插件市场 (Plugin marketplace)."
