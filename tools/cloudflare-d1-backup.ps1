[CmdletBinding()]
param(
    [string]$OutputDirectory = 'backups',
    [string]$ProxyUrl = $env:HTTPS_PROXY,
    [switch]$LogicalOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkerDir = Join-Path $ProjectRoot 'apps\worker'

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

function ConvertFrom-MixedJsonArray([string]$Text) {
    $lastBracket = $Text.LastIndexOf(']')
    if ($lastBracket -lt 0) { throw 'Wrangler не вернул JSON-массив.' }
    foreach ($match in [regex]::Matches($Text, '\[')) {
        $candidate = $Text.Substring($match.Index, $lastBracket - $match.Index + 1)
        try { return $candidate | ConvertFrom-Json -ErrorAction Stop } catch { continue }
    }
    throw 'Не удалось извлечь JSON-массив из вывода Wrangler.'
}

$script:Pnpm = Resolve-Pnpm
if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $env:HTTPS_PROXY = $ProxyUrl
    $env:HTTP_PROXY = $ProxyUrl
    if ([string]::IsNullOrWhiteSpace($env:NO_PROXY)) { $env:NO_PROXY = 'localhost,127.0.0.1,::1' }
}

$resolvedOutput = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
    [IO.Path]::GetFullPath($OutputDirectory)
} else {
    [IO.Path]::GetFullPath((Join-Path $ProjectRoot $OutputDirectory))
}
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

if ($LogicalOnly) {
    & (Join-Path $PSScriptRoot 'cloudflare-d1-logical-backup.ps1') -OutputDirectory $resolvedOutput -ProxyUrl $ProxyUrl
    exit $LASTEXITCODE
}

$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$baseName = "kontur-d1-$stamp"
$sqlPath = Join-Path $resolvedOutput ($baseName + '.sql')
$partialPath = Join-Path $resolvedOutput ($baseName + '.partial.sql')
$shaPath = $sqlPath + '.sha256'
$metaPath = Join-Path $resolvedOutput ($baseName + '.json')

foreach ($path in @($sqlPath, $partialPath, $shaPath, $metaPath)) {
    if (Test-Path -LiteralPath $path) { throw "Файл уже существует: $path" }
}

try {
    Set-Location -LiteralPath $WorkerDir
    try {
        [void](Invoke-WranglerCapture d1 export kontur --remote --skip-confirmation --output $partialPath)
    } catch {
        Write-Warning 'Cloudflare native D1 export is unavailable; using verified logical SQL fallback.'
        Set-Location -LiteralPath $ProjectRoot
        & (Join-Path $PSScriptRoot 'cloudflare-d1-logical-backup.ps1') -OutputDirectory $resolvedOutput -ProxyUrl $ProxyUrl
        exit $LASTEXITCODE
    }
    if (-not (Test-Path -LiteralPath $partialPath -PathType Leaf)) { throw 'Wrangler не создал SQL backup.' }
    $file = Get-Item -LiteralPath $partialPath
    if ($file.Length -lt 100) { throw "SQL backup подозрительно мал: $($file.Length) bytes" }
    if (-not (Select-String -LiteralPath $partialPath -Pattern 'CREATE TABLE' -Quiet)) {
        throw 'В SQL backup нет схемы.'
    }

    $countsQuery = 'SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM profiles WHERE hatched_at IS NOT NULL) AS hatched, (SELECT count(*) FROM worm_grants) AS worm_grants, (SELECT count(*) FROM egg_pulls) AS egg_pulls, (SELECT count(*) FROM signal_cards) AS signal_cards;'
    $countsText = Invoke-WranglerCapture d1 execute kontur --remote --json --command $countsQuery
    $counts = (ConvertFrom-MixedJsonArray $countsText)[0].results[0]
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $partialPath).Hash

    Move-Item -LiteralPath $partialPath -Destination $sqlPath
    Set-Content -LiteralPath $shaPath -Encoding ascii -Value "$hash  $([IO.Path]::GetFileName($sqlPath))"
    [ordered]@{
        generatedAt = [DateTime]::UtcNow.ToString('o')
        database = 'kontur'
        file = [IO.Path]::GetFileName($sqlPath)
        bytes = (Get-Item -LiteralPath $sqlPath).Length
        sha256 = $hash
        containsPersonalData = $true
        counts = [ordered]@{
            users = [int]$counts.users
            hatched = [int]$counts.hatched
            wormGrants = [int]$counts.worm_grants
            eggPulls = [int]$counts.egg_pulls
            signalCards = [int]$counts.signal_cards
        }
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $metaPath -Encoding utf8

    "BACKUP=$sqlPath"
    "SHA256=$hash"
    "BYTES=$((Get-Item -LiteralPath $sqlPath).Length)"
    "USERS=$([int]$counts.users)"
    'PERSONAL_DATA=YES'
} finally {
    if (Test-Path -LiteralPath $partialPath) { Remove-Item -LiteralPath $partialPath -Force }
    Set-Location -LiteralPath $ProjectRoot
}
