[CmdletBinding()]
param(
    [ValidateSet('Enable', 'Disable')]
    [string]$Mode = 'Enable',
    [string]$ProxyUrl = $env:HTTPS_PROXY,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
    $fallback = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (-not (Test-Path -LiteralPath $fallback)) { throw 'pnpm not found' }
    $pnpmPath = $fallback
} else {
    $pnpmPath = $pnpm.Source
}

if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $env:HTTPS_PROXY = $ProxyUrl
    $env:HTTP_PROXY = $ProxyUrl
}

$value = if ($Mode -eq 'Enable') { 'true' } else { 'false' }
Write-Host 'Target: production Worker kontur-igor'
Write-Host "Action: set ZERO_SEASON_ENABLED=$value"
Write-Host 'Scope: V4 only; V1, V2 and V3 remain unchanged.'

if (-not $Apply) {
    Write-Host 'Production unchanged.'
    Write-Host 'DRY_RUN=PASS'
    Write-Host 'Repeat with -Apply only after backup and release gates pass.'
    exit 0
}

$value | & $pnpmPath -F '@kontur/worker' exec wrangler secret put ZERO_SEASON_ENABLED | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Failed to update ZERO_SEASON_ENABLED' }

Write-Host "ZERO_SEASON_ENABLED=$value"
Write-Host "V4_GATE=$($Mode.ToUpperInvariant())D"
