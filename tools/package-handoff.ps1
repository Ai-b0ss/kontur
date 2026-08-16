[CmdletBinding()]
param(
    [string]$ArchiveName = 'KONTUR_HANDOFF_2026-08-06-STABLE'
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$zipPath = Join-Path $root ($ArchiveName + '.zip')
$shaPath = $zipPath + '.sha256'

if (Test-Path -LiteralPath $zipPath) { throw "Archive already exists: $zipPath" }
if (Test-Path -LiteralPath $shaPath) { throw "Checksum already exists: $shaPath" }

$runId = [guid]::NewGuid().ToString('N')
$stage = Join-Path $env:TEMP ("kontur-handoff-stage-$runId")
$verify = Join-Path $env:TEMP ("kontur-handoff-verify-$runId")
$tempZip = Join-Path $env:TEMP ($ArchiveName + "-$runId.zip")
$bundle = Join-Path $stage 'kontur'

$rootFiles = @(
    'AGENTS.md',
    'AI_PROJECT_NAVIGATOR.md',
    'PROJECT_STATE.yaml',
    'PROJECT_PASSPORT.md',
    'BACKLOG.md',
    'ART_DIRECTION_V1.md',
    'COMMUNITY_INTERVIEW_GUIDE_V1.md',
    'COMMUNITY_RESEARCH_DEEP_DIVE_V1.md',
    'COMMUNITY_RESEARCH_STAGE1_INTERIM.md',
    'EXPERIENCE_SPEC_V1.md',
    'IMPLEMENTATION_PLAN_V1.md',
    'PRODUCT_DIRECTION_V1.md',
    'PRODUCT_REDESIGN_BRIEF.md',
    'CHAT_RESEARCH_PROTOCOL.md',
    'RESTORED_PRODUCT_V3.md',
    'STAGE1_INTERVIEW_EXECUTION.md',
    'STAGE1_MINIMAL_VALIDATION.md',
    'STAGE5_PROTOTYPE_V1.md',
    'STAGE6_PREVIEW_TRIAL_V1.md',
    'STAGE7_CLOSED_ROLLOUT_V1.md',
    'NEXT_CHAT_PROMPT.md',
    '.env.example',
    '.env.telegram-test.example',
    '.gitattributes',
    '.gitignore',
    'DESIGN.md',
    'kontur-brief.html',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'README.md',
    'WORKLOG.md',
    'HANDOVER.md'
)
$rootDirectories = @('apps', 'packages', 'tools', 'art-direction', 'stage5-prototype')
$blockedSegments = @('node_modules', 'dist', 'data', 'backups', 'research-private', '.wrangler', '.git', '.claude', '.agents', '.codex', '.superseded')

function Get-RelativePath([string]$basePath, [string]$targetPath) {
    $baseFull = [IO.Path]::GetFullPath($basePath).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $targetFull = [IO.Path]::GetFullPath($targetPath)
    $relativeUri = ([Uri]$baseFull).MakeRelativeUri([Uri]$targetFull)
    return [Uri]::UnescapeDataString($relativeUri.ToString()).Replace('/', [IO.Path]::DirectorySeparatorChar)
}

function Test-IncludedFile([IO.FileInfo]$file) {
    $relative = Get-RelativePath $root $file.FullName
    $segments = $relative -split '[\\/]'
    if ($segments | Where-Object { $blockedSegments -contains $_ }) { return $false }
    if ($file.Name -eq '.env' -or $file.Name -like '*.local') { return $false }
    if ($file.Extension -in @('.zip', '.sha256', '.log', '.tmp')) { return $false }
    return $true
}

function Remove-SafeTemp([string]$path, [string]$prefix) {
    if (-not (Test-Path -LiteralPath $path)) { return }
    $resolved = [IO.Path]::GetFullPath($path)
    $tempRoot = [IO.Path]::GetFullPath($env:TEMP)
    if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe temp cleanup path: $resolved"
    }
    if (-not (Split-Path -Leaf $resolved).StartsWith($prefix, [StringComparison]::Ordinal)) {
        throw "Unexpected temp cleanup target: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}

try {
    New-Item -ItemType Directory -Path $bundle -Force | Out-Null

    foreach ($name in $rootFiles) {
        $source = Join-Path $root $name
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing handoff file: $name" }
        $target = Join-Path $bundle $name
        $parent = Split-Path -Parent $target
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $target
    }

    foreach ($directory in $rootDirectories) {
        $sourceRoot = Join-Path $root $directory
        foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File) {
            if (-not (Test-IncludedFile $file)) { continue }
            $relative = Get-RelativePath $root $file.FullName
            $target = Join-Path $bundle $relative
            $parent = Split-Path -Parent $target
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $target
        }
    }

    $stagedFiles = @(Get-ChildItem -LiteralPath $bundle -Recurse -File)
    if ($stagedFiles.Count -eq 0) { throw 'Handoff staging is empty' }
    if ($stagedFiles | Where-Object { $_.Name -eq '.env' -or $_.Name -like '*.local' }) {
        throw 'A local env file entered the handoff'
    }
    if ($stagedFiles.FullName -match '[\\/](node_modules|dist|data|backups|research-private|\.wrangler|\.git|\.superseded)[\\/]') {
        throw 'A blocked directory entered the handoff'
    }

    $secretValues = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($envName in @('.env', '.env.telegram-test.local', '.env.cloudflare.local')) {
        $envPath = Join-Path $root $envName
        if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) { continue }
        foreach ($line in Get-Content -LiteralPath $envPath) {
            if ($line -notmatch '^\s*([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD)|DATABASE_URL)\s*=\s*(.*)\s*$') { continue }
            $value = $Matches[2].Trim().Trim('"').Trim("'")
            if ($value.Length -ge 8) { [void]$secretValues.Add($value) }
        }
    }

    $secretHits = 0
    foreach ($file in $stagedFiles) {
        $text = $null
        try { $text = [IO.File]::ReadAllText($file.FullName) } catch { continue }
        if ($text -match '(?<!\d)\d{6,12}:[A-Za-z0-9_-]{30,}(?![A-Za-z0-9_-])') { $secretHits++ }
        foreach ($secret in $secretValues) {
            if ($text.IndexOf($secret, [StringComparison]::Ordinal) -ge 0) { $secretHits++ }
        }
    }
    if ($secretHits -ne 0) { throw "Secret scan failed: $secretHits hit(s)" }

    $manifestLines = foreach ($file in $stagedFiles | Sort-Object FullName) {
        $relative = (Get-RelativePath $bundle $file.FullName).Replace('\', '/')
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash
        "$hash  $relative"
    }
    Set-Content -LiteralPath (Join-Path $bundle 'SHA256SUMS.txt') -Value $manifestLines -Encoding utf8

    Compress-Archive -LiteralPath $bundle -DestinationPath $tempZip -CompressionLevel Optimal
    New-Item -ItemType Directory -Path $verify -Force | Out-Null
    Expand-Archive -LiteralPath $tempZip -DestinationPath $verify

    $verifyRoot = Join-Path $verify 'kontur'
    $verifyManifest = Join-Path $verifyRoot 'SHA256SUMS.txt'
    foreach ($line in Get-Content -LiteralPath $verifyManifest) {
        if ($line -notmatch '^([A-Fa-f0-9]{64})  (.+)$') { throw "Invalid manifest line: $line" }
        $expected = $Matches[1].ToUpperInvariant()
        $relative = $Matches[2].Replace('/', [IO.Path]::DirectorySeparatorChar)
        $candidate = [IO.Path]::GetFullPath((Join-Path $verifyRoot $relative))
        if (-not $candidate.StartsWith([IO.Path]::GetFullPath($verifyRoot), [StringComparison]::OrdinalIgnoreCase)) {
            throw "Unsafe manifest path: $relative"
        }
        if ((Get-FileHash -Algorithm SHA256 -LiteralPath $candidate).Hash -ne $expected) {
            throw "Internal hash mismatch: $relative"
        }
    }

    Move-Item -LiteralPath $tempZip -Destination $zipPath
    $zipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash
    Set-Content -LiteralPath $shaPath -Value "$zipHash  $([IO.Path]::GetFileName($zipPath))" -Encoding ascii

    "ARCHIVE=$zipPath"
    "SHA256=$zipHash"
    "FILES=$($stagedFiles.Count)"
    "SECRET_HITS=$secretHits"
    'INTERNAL_HASHES=PASS'
} finally {
    Remove-SafeTemp $stage 'kontur-handoff-stage-'
    Remove-SafeTemp $verify 'kontur-handoff-verify-'
    if (Test-Path -LiteralPath $tempZip) {
        $resolvedTempZip = [IO.Path]::GetFullPath($tempZip)
        if (-not $resolvedTempZip.StartsWith([IO.Path]::GetFullPath($env:TEMP), [StringComparison]::OrdinalIgnoreCase)) {
            throw "Unsafe temporary archive path: $resolvedTempZip"
        }
        Remove-Item -LiteralPath $resolvedTempZip -Force
    }
}
