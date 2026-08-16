[CmdletBinding()]
param(
    [string]$EnvFile = '.env.telegram-test.local',
    [string]$ProxyUrl = $env:HTTPS_PROXY,
    [switch]$SkipCheck,
    [switch]$ImportLocalData
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkerDir = Join-Path $ProjectRoot 'apps\worker'
$ConfigPath = Join-Path $WorkerDir 'wrangler.jsonc'
$StatePath = Join-Path $ProjectRoot '.env.cloudflare.local'
$WebProxyArgs = @{}
if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $env:HTTPS_PROXY = $ProxyUrl
    $env:HTTP_PROXY = $ProxyUrl
    if ([string]::IsNullOrWhiteSpace($env:NO_PROXY)) {
        $env:NO_PROXY = 'localhost,127.0.0.1,::1'
    }
    $WebProxyArgs.Proxy = $ProxyUrl
}

function Resolve-Pnpm {
    $command = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $fallback = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    throw 'pnpm не найден. Откройте проект через Codex или установите pnpm.'
}

function Read-EnvFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Не найден файл окружения: $Path" }
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $value = $matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$matches[1]] = $value
        }
    }
    return $values
}

function New-Secret {
    $bytes = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

function ConvertFrom-MixedJsonArray([string]$Text) {
    $lastBracket = $Text.LastIndexOf(']')
    if ($lastBracket -lt 0) { throw 'Wrangler не вернул JSON-массив.' }
    foreach ($match in [regex]::Matches($Text, '\[')) {
        $candidate = $Text.Substring($match.Index, $lastBracket - $match.Index + 1)
        try {
            return $candidate | ConvertFrom-Json -ErrorAction Stop
        } catch {
            continue
        }
    }
    throw 'Не удалось извлечь JSON-массив из вывода Wrangler.'
}

function Invoke-Wrangler {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $script:Pnpm -F '@kontur/worker' exec wrangler @Arguments
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) { throw "Wrangler завершился с кодом $exitCode" }
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

function Set-WorkerSecret([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { throw "Секрет $Name пуст" }
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $Value | & $script:Pnpm -F '@kontur/worker' exec wrangler secret put $Name | Out-Host
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) { throw "Не удалось установить секрет $Name" }
}

Set-Location -LiteralPath $ProjectRoot
$script:Pnpm = Resolve-Pnpm
$resolvedEnv = if ([IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $ProjectRoot $EnvFile }
$source = Read-EnvFile $resolvedEnv

if (($source.BOT_TOKEN -as [string]) -notmatch '^\d+:[A-Za-z0-9_-]{20,}$') {
    throw 'В файле окружения нет корректного BOT_TOKEN.'
}
if (($source.MAIN_CHAT_ID -as [string]) -notmatch '^-?\d+$') {
    throw 'В файле окружения нет числового MAIN_CHAT_ID.'
}
if ([string]::IsNullOrWhiteSpace($source.JWT_SECRET)) {
    $source.JWT_SECRET = New-Secret
}

$who = Invoke-WranglerCapture whoami
if ($who -match 'not authenticated') {
    throw 'Cloudflare ещё не авторизован. Выполните один раз: pnpm -F @kontur/worker exec wrangler login'
}
Write-Host 'Cloudflare: авторизация подтверждена.' -ForegroundColor Green

if (-not $SkipCheck) {
    & $script:Pnpm check
    if ($LASTEXITCODE -ne 0) { throw 'Общий gate не прошёл; deploy остановлен.' }
}

$config = Get-Content -Raw -Encoding UTF8 -LiteralPath $ConfigPath
$databaseId = [regex]::Match($config, '"database_id"\s*:\s*"([0-9a-f-]{36})"').Groups[1].Value
if (-not $databaseId -or $databaseId -eq '00000000-0000-0000-0000-000000000000') {
    $listText = Invoke-WranglerCapture d1 list --json
    $databases = ConvertFrom-MixedJsonArray $listText
    $existing = $databases | Where-Object { $_.name -eq 'kontur' } | Select-Object -First 1
    if ($existing) {
        $databaseId = [string]$existing.uuid
        if (-not $databaseId) { $databaseId = [string]$existing.id }
    } else {
        $created = Invoke-WranglerCapture d1 create kontur --location eeur
        $match = [regex]::Match($created, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        if (-not $match.Success) { throw "D1 создана, но её ID не распознан:`n$created" }
        $databaseId = $match.Value
    }
    $config = [regex]::Replace(
        $config,
        '"database_id"\s*:\s*"[0-9a-f-]{36}"',
        '"database_id": "' + $databaseId + '"',
        1
    )
    Set-Content -LiteralPath $ConfigPath -Value $config -Encoding utf8
    Write-Host 'D1: конфигурация привязана.' -ForegroundColor Green
}

$oldCi = $env:CI
$env:CI = 'true'
try { Invoke-Wrangler d1 migrations apply kontur --remote }
finally { $env:CI = $oldCi }

if ($ImportLocalData) {
    $countText = Invoke-WranglerCapture d1 execute kontur --remote --command 'SELECT count(*) AS n FROM users' --json
    $countResult = ConvertFrom-MixedJsonArray $countText
    $remoteUsers = [int]$countResult[0].results[0].n
    if ($remoteUsers -eq 0) {
        $transferFile = [IO.Path]::GetTempFileName()
        $oldDatabaseUrl = $env:DATABASE_URL
        $oldPgliteDir = $env:PGLITE_DIR
        try {
            $env:DATABASE_URL = $source.DATABASE_URL
            if ($source.PGLITE_DIR) { $env:PGLITE_DIR = $source.PGLITE_DIR }
            $exportSummary = (& $script:Pnpm -F '@kontur/db' export:d1 -- --out $transferFile 2>&1 | Out-String)
            if ($LASTEXITCODE -ne 0) { throw "Local data export failed:`n$exportSummary" }
            Invoke-Wrangler d1 execute kontur --remote --file $transferFile
            Write-Host "Existing local data transferred: $exportSummary" -ForegroundColor Green
        } finally {
            $env:DATABASE_URL = $oldDatabaseUrl
            $env:PGLITE_DIR = $oldPgliteDir
            Remove-Item -LiteralPath $transferFile -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "D1 already contains $remoteUsers users; import skipped." -ForegroundColor Yellow
    }
} else {
    Write-Host 'Local PGlite import disabled: production D1 starts clean.' -ForegroundColor Green
}

$state = if (Test-Path -LiteralPath $StatePath) { Read-EnvFile $StatePath } else { @{} }
$webhookSecret = if ($state.ContainsKey('WEBHOOK_SECRET') -and $state['WEBHOOK_SECRET']) { $state['WEBHOOK_SECRET'] } else { New-Secret }
$adminSecret = if ($state.ContainsKey('ADMIN_SECRET') -and $state['ADMIN_SECRET']) { $state['ADMIN_SECRET'] } else { New-Secret }
$publicUrl = if ($state.ContainsKey('PUBLIC_URL')) { $state['PUBLIC_URL'] } else { $null }

if (-not $publicUrl) {
    Write-Host 'Создаю безопасную bootstrap-версию Worker…'
    $deploy = Invoke-WranglerCapture deploy --var 'MINIAPP_URL:https://invalid.invalid'
    $urls = [regex]::Matches($deploy, 'https://[a-zA-Z0-9.-]+\.workers\.dev')
    if ($urls.Count -eq 0) { throw "Не удалось определить workers.dev URL:`n$deploy" }
    $publicUrl = $urls[$urls.Count - 1].Value.TrimEnd('/')
}

@(
    "PUBLIC_URL=$publicUrl"
    "WEBHOOK_SECRET=$webhookSecret"
    "ADMIN_SECRET=$adminSecret"
) | Set-Content -LiteralPath $StatePath -Encoding utf8

$miniAppUrl = "$publicUrl/?season=zero"

Set-WorkerSecret BOT_TOKEN $source.BOT_TOKEN
Set-WorkerSecret MAIN_CHAT_ID $source.MAIN_CHAT_ID
Set-WorkerSecret JWT_SECRET $source.JWT_SECRET
Set-WorkerSecret WEBHOOK_SECRET $webhookSecret
Set-WorkerSecret ADMIN_SECRET $adminSecret

Invoke-Wrangler deploy --var "MINIAPP_URL:$miniAppUrl"

$health = Invoke-RestMethod @WebProxyArgs -Uri "$publicUrl/api/v1/health" -TimeoutSec 30
if (-not $health.ok -or $health.driver -ne 'd1' -or $health.devMode) {
    throw 'Живой health-check вернул неожиданный ответ.'
}
$page = Invoke-WebRequest @WebProxyArgs -UseBasicParsing -Uri $publicUrl -TimeoutSec 30
if ($page.StatusCode -ne 200 -or $page.Content -notmatch '<div id="root">') {
    throw 'Mini App не отдаётся с production URL.'
}

$telegramBase = "https://api.telegram.org/bot$($source.BOT_TOKEN)"
$hook = Invoke-RestMethod @WebProxyArgs -Method Post -Uri "$telegramBase/setWebhook" -Body @{
    url = "$publicUrl/telegram/webhook"
    secret_token = $webhookSecret
    allowed_updates = '["message","chat_member"]'
    drop_pending_updates = 'false'
}
if (-not $hook.ok) { throw 'Telegram не принял webhook.' }

$menu = @{
    type = 'web_app'
    text = 'Открыть'
    web_app = @{ url = $miniAppUrl }
} | ConvertTo-Json -Compress -Depth 4
$menuResult = Invoke-RestMethod @WebProxyArgs -Method Post -Uri "$telegramBase/setChatMenuButton" -Body @{ menu_button = $menu }
if (-not $menuResult.ok) { throw 'Telegram не принял кнопку Mini App.' }

$commands = @(
    @{ command = 'start'; description = 'Открыть птицу' }
    @{ command = 'worm'; description = 'Кинуть червяка реплаем' }
    @{ command = 'w'; description = 'Короткая команда червяка' }
    @{ command = 'mute'; description = 'Выключить напоминания' }
    @{ command = 'unmute'; description = 'Включить напоминания' }
) | ConvertTo-Json -Compress
$commandsResult = Invoke-RestMethod @WebProxyArgs -Method Post -Uri "$telegramBase/setMyCommands" -Body @{ commands = $commands }
if (-not $commandsResult.ok) { throw 'Telegram не принял список команд.' }

$hookInfo = Invoke-RestMethod @WebProxyArgs -Uri "$telegramBase/getWebhookInfo" -TimeoutSec 30
if (-not $hookInfo.ok -or $hookInfo.result.url -ne "$publicUrl/telegram/webhook") {
    throw 'Telegram webhook не подтвердился после установки.'
}

Write-Host ''
Write-Host 'Cloudflare production готов.' -ForegroundColor Green
Write-Host "URL: $publicUrl"
Write-Host "Mini App V4: $miniAppUrl"
Write-Host "D1: $databaseId"
Write-Host "Webhook pending updates: $($hookInfo.result.pending_update_count)"
Write-Host 'Секреты сохранены локально в .env.cloudflare.local и не выводились.'
