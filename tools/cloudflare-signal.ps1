[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][long]$TelegramId,
    [Parameter(Mandatory = $true)]
    [ValidateSet('cu_event','agency_case','own_project')][string]$Kind,
    [Parameter(Mandatory = $true)][string]$Title,
    [Parameter(Mandatory = $true)][string]$Key,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StatePath = Join-Path $ProjectRoot '.env.cloudflare.local'

if (-not (Test-Path -LiteralPath $StatePath)) {
    throw '.env.cloudflare.local not found. Deploy Cloudflare first.'
}
$state = @{}
foreach ($line in Get-Content -LiteralPath $StatePath) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $state[$matches[1]] = $matches[2].Trim()
    }
}
if (-not $state.PUBLIC_URL -or -not $state.ADMIN_SECRET) {
    throw 'Cloudflare deployment state is incomplete.'
}

$body = @{
    tgId = $TelegramId
    kind = $Kind
    title = $Title
    referenceCode = $Key
    dryRun = -not $Apply
} | ConvertTo-Json -Compress

$result = Invoke-RestMethod -Method Post `
    -Uri "$($state.PUBLIC_URL)/api/v1/admin/signal" `
    -Headers @{ 'X-Kontur-Admin' = $state.ADMIN_SECRET } `
    -ContentType 'application/json; charset=utf-8' `
    -Body ([Text.Encoding]::UTF8.GetBytes($body))

if ($Apply) {
    Write-Host "Applied: created=$($result.created), tg-id=$TelegramId, key=$Key" -ForegroundColor Green
} else {
    Write-Host 'DRY RUN - nothing changed' -ForegroundColor Yellow
    Write-Host "Target: tg-id=$TelegramId, username=$($result.target.username)"
    Write-Host "Would create: $($result.wouldCreate)"
    Write-Host 'Repeat the same command with -Apply after checking the target.'
}
