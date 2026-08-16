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
Write-Host "Action: set EXPERIENCE_V3_ENABLED=$value"
Write-Host 'Allowlist: unchanged; EXPERIENCE_V3_USER_IDS or exact existing V2 fallback'

if (-not $Apply) {
    Write-Host 'Production unchanged.'
    Write-Host 'DRY_RUN=PASS'
    Write-Host 'Repeat with -Apply only after backup and release gates pass.'
    exit 0
}

$value | & $pnpmPath -F '@kontur/worker' exec wrangler secret put EXPERIENCE_V3_ENABLED | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Failed to update EXPERIENCE_V3_ENABLED' }

Write-Host "EXPERIENCE_V3_ENABLED=$value"
Write-Host "V3_GATE=$($Mode.ToUpperInvariant())D"
