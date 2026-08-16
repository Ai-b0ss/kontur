[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$SkipCheck,
    [string]$ProxyUrl = $env:HTTPS_PROXY
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkerDir = Join-Path $ProjectRoot 'apps\worker'
$ConfigPath = Join-Path $WorkerDir 'wrangler.preview.local.jsonc'
$StatePath = Join-Path $ProjectRoot '.preview.cloudflare.local'
$DatabaseName = 'kontur-preview-v2'
$WorkerName = 'kontur-preview-v2'
$PreviewIds = (1..10 | ForEach-Object { 980000 + $_ }) -join ','

function Resolve-Pnpm {
    $command = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $fallback = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    throw 'pnpm was not found.'
}

function New-Secret {
    $bytes = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

function Invoke-WranglerCapture {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $previous = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $text = (& $script:Pnpm -F '@kontur/worker' exec wrangler @Arguments 2>&1 | Out-String)
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous }
    if ($exitCode -ne 0) { throw "Wrangler failed:`n$text" }
    return $text
}

function ConvertFrom-MixedJsonArray([string]$Text) {
    $lastBracket = $Text.LastIndexOf(']')
    if ($lastBracket -lt 0) { throw 'Wrangler did not return a JSON array.' }
    foreach ($match in [regex]::Matches($Text, '\[')) {
        try { return $Text.Substring($match.Index, $lastBracket - $match.Index + 1) | ConvertFrom-Json -ErrorAction Stop }
        catch { continue }
    }
    throw 'Could not parse Wrangler JSON.'
}

function Write-PreviewConfig([string]$DatabaseId, [string]$PublicUrl, [string]$JwtSecret, [string]$WebhookSecret, [string]$AdminSecret) {
    $config = [ordered]@{
        '$schema' = 'node_modules/wrangler/config-schema.json'
        name = $WorkerName
        main = 'src/index.ts'
        compatibility_date = '2026-08-05'
        workers_dev = $true
        assets = [ordered]@{
            directory = '../miniapp/dist'
            binding = 'ASSETS'
            not_found_handling = 'single-page-application'
            run_worker_first = @('/api/*','/telegram/*')
        }
        d1_databases = @([ordered]@{
            binding = 'DB'
            database_name = $DatabaseName
            database_id = $DatabaseId
            migrations_dir = 'migrations'
        })
        vars = [ordered]@{
            DEV_MODE = 'true'
            MINIAPP_URL = $PublicUrl
            MAIN_CHAT_ID = '-100900000001'
            JWT_SECRET = $JwtSecret
            WEBHOOK_SECRET = $WebhookSecret
            ADMIN_SECRET = $AdminSecret
            EXPERIENCE_V2_ENABLED = 'true'
            EXPERIENCE_V2_USER_IDS = $PreviewIds
            SEASON_START = '2026-08-01'
            WORM_REACTION = ':)'
        }
        observability = [ordered]@{ enabled = $true }
    }
    $config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ConfigPath -Encoding utf8
}

Set-Location -LiteralPath $ProjectRoot
$script:Pnpm = Resolve-Pnpm
if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $env:HTTPS_PROXY = $ProxyUrl
    $env:HTTP_PROXY = $ProxyUrl
    if ([string]::IsNullOrWhiteSpace($env:NO_PROXY)) { $env:NO_PROXY = 'localhost,127.0.0.1,::1' }
}

$backup = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'backups') -Filter 'kontur-d1-*.json' -File |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if (-not $backup) { throw 'No verified fresh production D1 backup was found.' }
$backupMeta = Get-Content -Raw -LiteralPath $backup.FullName | ConvertFrom-Json
$backupSql = Join-Path $backup.DirectoryName $backupMeta.file
if (-not (Test-Path -LiteralPath $backupSql)) { throw 'Backup SQL listed by the manifest was not found.' }
$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $backupSql).Hash
if ($actualHash -ne $backupMeta.sha256) { throw 'Backup SHA does not match the manifest.' }

Write-Host "Preview Worker: $WorkerName"
Write-Host "Preview D1: $DatabaseName"
Write-Host 'Production Worker/D1/webhook: unchanged'
if (-not $Apply) {
    Write-Host 'DRY_RUN=PASS'
    Write-Host 'Repeat with -Apply to create the isolated preview.'
    exit 0
}

[void](Invoke-WranglerCapture whoami)
if (-not $SkipCheck) {
    & $script:Pnpm check
    if ($LASTEXITCODE -ne 0) { throw 'Full project gate failed.' }
}

$list = ConvertFrom-MixedJsonArray (Invoke-WranglerCapture d1 list --json)
$database = $list | Where-Object { $_.name -eq $DatabaseName } | Select-Object -First 1
if (-not $database) {
    $created = Invoke-WranglerCapture d1 create $DatabaseName --location eeur
    $match = [regex]::Match($created, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
    if (-not $match.Success) { throw 'D1 was created but its ID could not be parsed.' }
    $databaseId = $match.Value
} else {
    $databaseId = [string]$database.uuid
    if (-not $databaseId) { $databaseId = [string]$database.id }
}

$jwtSecret = New-Secret
$webhookSecret = New-Secret
$adminSecret = New-Secret
Write-PreviewConfig $databaseId 'https://invalid.invalid' $jwtSecret $webhookSecret $adminSecret

$oldCi = $env:CI
$env:CI = 'true'
try {
    [void](Invoke-WranglerCapture d1 migrations apply $DatabaseName --remote --config $ConfigPath)
} finally { $env:CI = $oldCi }
$seedBase64 = 'SU5TRVJUIE9SIElHTk9SRSBJTlRPIHBpbG90X2NoYXRzCiAgKGNvZGUsdGl0bGUscHVycG9zZSxraW5kLHRlbGVncmFtX2NoYXRfaWQsYWN0aXZlLHBvc2l0aW9uKQpWQUxVRVMKICAoJ2dlbmVyYWwnLCfQntCx0YnQuNC5INGH0LDRgicsJ9Cf0LXRgNCy0YvQuSDQstC+0L/RgNC+0YEg0Lgg0L7QsdGJ0LDRjyDQvdCw0LLQuNCz0LDRhtC40Y8nLCdnZW5lcmFsJywtMTAwOTAwMDAwMDAxLDEsMSksCiAgKCdncmFudHMnLCfQp9Cw0YIg0LPRgNCw0L3RgtC+0LLQuNC60L7QsicsJ9Ch0YDQvtC60LgsINC00L7QutGD0LzQtdC90YLRiyDQuCDQvtC/0YvRgiDQt9Cw0Y/QstC+0LonLCdzcGVjaWFsaXN0JywtMTAwOTAwMDAwMDAyLDEsMik7'
$seedSql = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($seedBase64)).Replace("`r", ' ').Replace("`n", ' ')
[void](Invoke-WranglerCapture d1 execute $DatabaseName --remote --config $ConfigPath --command $seedSql)

$oldPreview = $env:VITE_PREVIEW_MODE
$env:VITE_PREVIEW_MODE = 'true'
try {
    & $script:Pnpm -F '@kontur/miniapp' build
    if ($LASTEXITCODE -ne 0) { throw 'Preview build failed.' }
    $deploy = Invoke-WranglerCapture deploy --config $ConfigPath
    $urls = [regex]::Matches($deploy, 'https://[a-zA-Z0-9.-]+\.workers\.dev')
    if ($urls.Count -eq 0) { throw 'Could not determine the preview URL.' }
    $publicUrl = $urls[$urls.Count - 1].Value.TrimEnd('/')
    Write-PreviewConfig $databaseId $publicUrl $jwtSecret $webhookSecret $adminSecret
    [void](Invoke-WranglerCapture deploy --config $ConfigPath)
} finally {
    $env:VITE_PREVIEW_MODE = $oldPreview
    & $script:Pnpm -F '@kontur/miniapp' build | Out-Null
}

@(
    "PUBLIC_URL=$publicUrl"
    "DATABASE_NAME=$DatabaseName"
    "WORKER_NAME=$WorkerName"
) | Set-Content -LiteralPath $StatePath -Encoding utf8

$health = Invoke-RestMethod -Uri "$publicUrl/api/v1/health" -Proxy $ProxyUrl -TimeoutSec 30
if (-not $health.ok -or $health.driver -ne 'd1' -or -not $health.devMode) {
    throw 'Isolated preview health check failed.'
}
$page = Invoke-WebRequest -UseBasicParsing -Uri "$publicUrl/?preview=1" -Proxy $ProxyUrl -TimeoutSec 30
if ($page.StatusCode -ne 200 -or $page.Content -notmatch '<div id="root">') {
    throw 'Preview page did not open.'
}

Write-Host "PREVIEW_URL=$publicUrl"
Write-Host 'PREVIEW_SLOTS=10'
Write-Host 'TELEGRAM_WEBHOOK=NOT_CONFIGURED'
Write-Host 'APPLY=PASS'
