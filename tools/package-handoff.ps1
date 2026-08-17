[CmdletBinding()]
param(
    [string]$ArchiveName = 'KONTUR_HANDOFF_2026-08-17_CURRENT'
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$zipPath = Join-Path $root ($ArchiveName + '.zip')
$shaPath = $zipPath + '.sha256'
$script:tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())

if (Test-Path -LiteralPath $zipPath) { throw "Archive already exists: $zipPath" }
if (Test-Path -LiteralPath $shaPath) { throw "Checksum already exists: $shaPath" }

$runId = [guid]::NewGuid().ToString('N')
$stage = Join-Path $script:tempRoot ("kontur-handoff-stage-$runId")
$verify = Join-Path $script:tempRoot ("kontur-handoff-verify-$runId")
$tempZip = Join-Path $script:tempRoot ($ArchiveName + "-$runId.zip")
$bundle = Join-Path $stage 'kontur'

function Get-RelativePath([string]$basePath, [string]$targetPath) {
    $baseFull = [IO.Path]::GetFullPath($basePath).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $targetFull = [IO.Path]::GetFullPath($targetPath)
    $relativeUri = ([Uri]$baseFull).MakeRelativeUri([Uri]$targetFull)
    return [Uri]::UnescapeDataString($relativeUri.ToString()).Replace('/', [IO.Path]::DirectorySeparatorChar)
}

function Test-ShareSafeTrackedPath([string]$relative) {
    $normalized = $relative.Replace('\', '/')
    $segments = $normalized -split '/'
    $blockedSegments = @('node_modules', 'dist', 'data', 'backups', 'research-private', '.wrangler', '.git', '.claude', '.agents', '.codex', '.superseded')
    if ($segments | Where-Object { $blockedSegments -contains $_ }) { return $false }
    if ($normalized.StartsWith('.runtime-state/', [StringComparison]::OrdinalIgnoreCase)) { return $false }
    $leaf = [IO.Path]::GetFileName($normalized)
    if ($leaf -eq '.env' -or $leaf -like '*.local') { return $false }
    if ([IO.Path]::GetExtension($leaf) -in @('.zip', '.sha256', '.log', '.tmp', '.pem', '.p12', '.pfx', '.key')) { return $false }
    return $true
}

function Remove-SafeTemp([string]$path, [string]$prefix) {
    if (-not (Test-Path -LiteralPath $path)) { return }
    $resolved = [IO.Path]::GetFullPath($path)
    if (-not $resolved.StartsWith($script:tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe temp cleanup path: $resolved"
    }
    if (-not (Split-Path -Leaf $resolved).StartsWith($prefix, [StringComparison]::Ordinal)) {
        throw "Unexpected temp cleanup target: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}

try {
    New-Item -ItemType Directory -Path $bundle -Force | Out-Null

    $tracked = @(& git -C $root ls-files)
    if ($LASTEXITCODE -ne 0) { throw 'git ls-files failed' }
    if ($tracked.Count -eq 0) { throw 'Git tracked-file list is empty' }

    $included = 0
    foreach ($relative in $tracked) {
        if (-not (Test-ShareSafeTrackedPath $relative)) { continue }
        $source = Join-Path $root $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            throw "Tracked file is missing from worktree: $relative"
        }
        $target = Join-Path $bundle $relative
        $parent = Split-Path -Parent $target
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $target
        $included++
    }

    foreach ($required in @(
        'README.md',
        'CURRENT_PRODUCT.md',
        'HANDOFF.md',
        'ARCHITECTURE.md',
        'docs/product/PRODUCT_BRIEF_2026-08-13.md',
        'docs/product/DECISION_LOG_2026-08-14.md',
        'apps/miniapp/src/screens/LocalKontur.tsx',
        'apps/miniapp/src/components/QuizEgg.tsx',
        'apps/worker/src/index.ts',
        'pnpm-lock.yaml'
    )) {
        if (-not (Test-Path -LiteralPath (Join-Path $bundle $required) -PathType Leaf)) {
            throw "Required handoff file missing after staging: $required"
        }
    }

    $stagedFiles = @(Get-ChildItem -LiteralPath $bundle -Recurse -File)
    if ($stagedFiles.Count -eq 0 -or $included -eq 0) { throw 'Handoff staging is empty' }
    if ($stagedFiles.FullName -match '[\\/](node_modules|dist|data|backups|research-private|\.wrangler|\.git|\.runtime-state)[\\/]') {
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
    "FILES=$included"
    "SECRET_HITS=$secretHits"
    'INTERNAL_HASHES=PASS'
} finally {
    Remove-SafeTemp $stage 'kontur-handoff-stage-'
    Remove-SafeTemp $verify 'kontur-handoff-verify-'
    if (Test-Path -LiteralPath $tempZip) {
        $resolvedTempZip = [IO.Path]::GetFullPath($tempZip)
        if (-not $resolvedTempZip.StartsWith($script:tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Unsafe temporary archive path: $resolvedTempZip"
        }
        Remove-Item -LiteralPath $resolvedTempZip -Force
    }
}
