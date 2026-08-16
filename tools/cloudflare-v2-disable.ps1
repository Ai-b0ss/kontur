[CmdletBinding()]
param(
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

Write-Host 'Target: production Worker kontur-igor'
Write-Host 'Action: set EXPERIENCE_V2_ENABLED=false'

if (-not $Apply) {
    Write-Host 'Production unchanged.'
    Write-Host 'DRY_RUN=PASS'
    Write-Host 'Repeat with -Apply only when rollback is required.'
    exit 0
}

'false' | & $pnpmPath -F '@kontur/worker' exec wrangler secret put EXPERIENCE_V2_ENABLED | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Failed to disable EXPERIENCE_V2_ENABLED' }

Write-Host 'EXPERIENCE_V2_ENABLED=false'
Write-Host 'ROLLBACK=APPLIED'
