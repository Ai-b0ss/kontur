[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Timestamp,
    [string]$BackupDirectory = 'backups\pre-restore',
    [string]$ProxyUrl = $env:HTTPS_PROXY,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkerDir = Join-Path $ProjectRoot 'apps\worker'
$StatePath = Join-Path $ProjectRoot '.env.cloudflare.local'

function Resolve-Pnpm {
    $command = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $fallback = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    throw 'pnpm не найден. Откройте проект через Codex или установите pnpm.'
}

function Invoke-WranglerCapture {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $text = (& $script:Pnpm -F '@kontur/worker' exec wrangler @Arguments 2>&1 | Out-String)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) { throw "Wrangler завершился с ошибкой:`n$text" }
    return $text
}

function ConvertFrom-MixedJsonObject([string]$Text) {
    $lastBrace = $Text.LastIndexOf('}')
    if ($lastBrace -lt 0) { throw 'Wrangler не вернул JSON-объект.' }
    foreach ($match in [regex]::Matches($Text, '\{')) {
        $candidate = $Text.Substring($match.Index, $lastBrace - $match.Index + 1)
        try { return $candidate | ConvertFrom-Json -ErrorAction Stop } catch { continue }
    }
    throw 'Не удалось извлечь JSON-объект из вывода Wrangler.'
}

try {
    $target = [DateTimeOffset]::Parse($Timestamp).ToUniversalTime()
} catch {
    throw 'Timestamp должен быть RFC3339, например 2026-08-06T01:30:00Z.'
}
$now = [DateTimeOffset]::UtcNow
if ($target -gt $now.AddMinutes(1)) { throw 'Нельзя восстановиться в будущее.' }
if ($target -lt $now.AddDays(-30)) { throw 'Cloudflare Time Travel принимает точки только за последние 30 дней.' }
$normalizedTimestamp = $target.ToString('o')

$script:Pnpm = Resolve-Pnpm
if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $env:HTTPS_PROXY = $ProxyUrl
    $env:HTTP_PROXY = $ProxyUrl
    if ([string]::IsNullOrWhiteSpace($env:NO_PROXY)) { $env:NO_PROXY = 'localhost,127.0.0.1,::1' }
}

Set-Location -LiteralPath $WorkerDir
$infoText = Invoke-WranglerCapture d1 time-travel info kontur --timestamp $normalizedTimestamp --json
$info = ConvertFrom-MixedJsonObject $infoText
if (-not $info.bookmark) { throw 'Cloudflare не вернул bookmark для выбранной точки.' }

if (-not $Apply) {
    Write-Host 'DRY RUN - production D1 не изменена.' -ForegroundColor Yellow
    Write-Host "Target UTC: $normalizedTimestamp"
    Write-Host 'Bookmark: подтверждён Cloudflare.'
    Write-Host 'При -Apply сначала автоматически создастся полный SQL backup текущей D1.'
    Write-Host 'После проверки повторите ту же команду с -Apply.'
    Set-Location -LiteralPath $ProjectRoot
    return
}

Set-Location -LiteralPath $ProjectRoot
$backupScript = Join-Path $PSScriptRoot 'cloudflare-d1-backup.ps1'
& $backupScript -OutputDirectory $BackupDirectory -ProxyUrl $ProxyUrl | Out-Host

Set-Location -LiteralPath $WorkerDir
$restoreText = Invoke-WranglerCapture d1 time-travel restore kontur --bookmark ([string]$info.bookmark) --json
$restore = ConvertFrom-MixedJsonObject $restoreText

if (Test-Path -LiteralPath $StatePath) {
    $publicUrl = $null
    foreach ($line in Get-Content -LiteralPath $StatePath) {
        if ($line -match '^PUBLIC_URL\s*=\s*(.+)$') { $publicUrl = $matches[1].Trim(); break }
    }
    if ($publicUrl) {
        $webArgs = @{ Uri = "$publicUrl/api/v1/health"; TimeoutSec = 30 }
        if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) { $webArgs.Proxy = $ProxyUrl }
        $health = Invoke-RestMethod @webArgs
        if (-not $health.ok -or $health.driver -ne 'd1') { throw 'Restore завершён, но health-check неожиданен.' }
    }
}

Set-Location -LiteralPath $ProjectRoot
Write-Host 'Production D1 restored by Cloudflare Time Travel.' -ForegroundColor Green
Write-Host "Target UTC: $normalizedTimestamp"
if ($restore.bookmark) { Write-Host 'Post-restore bookmark: received.' }
