[CmdletBinding()]
param(
    [ValidateSet('ApplyMigrations', 'DeployDisabled', 'EnableGame', 'DisableGame', 'EnablePublish', 'DisablePublish')]
    [string]$Mode = 'DeployDisabled',
    [string]$MiniAppUrl,
    [string]$BackupManifest,
    [string]$TimeTravelTimestamp,
    [string]$ProxyUrl = $env:HTTPS_PROXY,
    [ValidateRange(1, 240)][int]$MaxBackupAgeMinutes = 60,
    [switch]$GameAlreadyEnabled,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkerDir = Join-Path $ProjectRoot 'apps\worker'

function Resolve-Pnpm {
    # Prefer pnpm.cmd: Invoke-WranglerReadCapture runs pnpm via EncodedCommand,
    # and pnpm.ps1 collapses the splat into one unknown option there.
    $cmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $command = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($command) {
        $source = [string]$command.Source
        if ($source.EndsWith('.ps1', [StringComparison]::OrdinalIgnoreCase)) {
            $sibling = [IO.Path]::ChangeExtension($source, '.cmd')
            if (Test-Path -LiteralPath $sibling) { return $sibling }
        }
        return $source
    }
    $fallback = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    throw 'pnpm not found.'
}

function Read-EnvValue([string]$Path, [string]$Name) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match ('^\s*' + [regex]::Escape($Name) + '\s*=\s*(.+?)\s*$')) {
            return $matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

function Assert-VerifiedBackup([string]$ManifestPath, [int]$MaximumAgeMinutes) {
    if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
        throw 'This production mode requires -BackupManifest from a fresh logical D1 backup.'
    }
    $resolvedManifest = if ([IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $ProjectRoot $ManifestPath }
    if (-not (Test-Path -LiteralPath $resolvedManifest -PathType Leaf)) { throw 'Backup manifest was not found.' }
    $manifest = Get-Content -Raw -LiteralPath $resolvedManifest | ConvertFrom-Json
    if ([string]$manifest.database -ne 'kontur' -or [string]$manifest.kind -ne 'logical_sql_fallback') {
        throw 'Backup manifest is not a logical backup of the kontur D1 database.'
    }
    if ([IO.Path]::GetFileName([string]$manifest.file) -ne [string]$manifest.file) {
        throw 'Backup manifest contains an unsafe SQL filename.'
    }
    try {
        $generatedAt = [DateTimeOffset]::Parse(
            [string]$manifest.generatedAt,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind
        ).ToUniversalTime()
    } catch {
        throw 'Backup manifest has no valid generatedAt timestamp.'
    }
    $age = [DateTimeOffset]::UtcNow - $generatedAt
    if ($age.TotalMinutes -lt -5 -or $age.TotalMinutes -gt $MaximumAgeMinutes) {
        throw "Backup is not fresh enough for this release (maximum $MaximumAgeMinutes minutes)."
    }
    $sqlPath = Join-Path (Split-Path -Parent $resolvedManifest) ([string]$manifest.file)
    if (-not (Test-Path -LiteralPath $sqlPath -PathType Leaf)) { throw 'SQL file listed by backup manifest was not found.' }
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $sqlPath).Hash
    if ($actual -ne [string]$manifest.sha256) { throw 'Backup hash does not match its manifest.' }
    if ([int64]$manifest.bytes -ne (Get-Item -LiteralPath $sqlPath).Length) { throw 'Backup byte count does not match its manifest.' }
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
    if ($exitCode -ne 0) { throw "Wrangler failed with exit code $exitCode." }
}

function Invoke-WranglerReadCapture {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [ValidateRange(1, 120)][int]$TimeoutSeconds = 45
    )
    # Read-only preflight calls can use a bounded child. It preserves the
    # argument array (including timestamp punctuation) and on timeout kills
    # only the process tree that this function started.
    $quotedPnpm = "'" + $script:Pnpm.Replace("'", "''") + "'"
    $quotedArguments = @($Arguments | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ','
    $childScript = "& $quotedPnpm @($quotedArguments)`nexit `$LASTEXITCODE"
    $encodedScript = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childScript))

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = Join-Path $PSHOME 'pwsh.exe'
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    foreach ($argument in @('-NoProfile', '-NonInteractive', '-EncodedCommand', $encodedScript)) {
        [void]$startInfo.ArgumentList.Add($argument)
    }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) { throw 'Could not start the bounded Wrangler preflight process.' }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            try { $process.Kill($true) } catch { try { $process.Kill() } catch {} }
            [void]$process.WaitForExit(5000)
            return [pscustomobject]@{ ExitCode = 124; Text = "transport timeout after $TimeoutSeconds seconds" }
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        return [pscustomobject]@{ ExitCode = $process.ExitCode; Text = ($stdout + [Environment]::NewLine + $stderr) }
    } finally {
        $process.Dispose()
    }
}

function Invoke-WranglerCapture {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $allArguments = @('-F', '@kontur/worker', 'exec', 'wrangler') + $Arguments
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $execution = Invoke-WranglerReadCapture -Arguments $allArguments
        $captured = [string]$execution.Text
        if ([int]$execution.ExitCode -eq 0) { return $captured }
        $transient = $captured -match '(?i)fetch failed|timeout|time(?:d)?\s*out|ECONNRESET|ECONNREFUSED|socket hang up|\b429\b|\b5\d{2}\b'
        if (-not $transient -or $attempt -eq 3) { break }
        Start-Sleep -Seconds $attempt
    }
    throw 'Wrangler read-only preflight failed after bounded transport retries.'
}

function Assert-VerifiedTimeTravelRecoveryPoint([string]$Timestamp, [int]$MaximumAgeMinutes) {
    if ([string]::IsNullOrWhiteSpace($Timestamp)) {
        throw 'Supply a fresh verified recovery point before changing production D1.'
    }
    try {
        $target = [DateTimeOffset]::Parse(
            $Timestamp,
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::RoundtripKind
        ).ToUniversalTime()
    } catch {
        throw 'TimeTravelTimestamp must be a valid RFC3339 timestamp.'
    }
    $age = [DateTimeOffset]::UtcNow - $target
    if ($age.TotalMinutes -lt -5 -or $age.TotalMinutes -gt $MaximumAgeMinutes) {
        throw "Time Travel recovery point is not fresh enough (maximum $MaximumAgeMinutes minutes)."
    }
    $info = Invoke-WranglerCapture d1 time-travel info kontur --timestamp $target.ToString('o') --json
    if ($info -notmatch '"bookmark"\s*:\s*"[^"\r\n]+"') {
        throw 'Cloudflare did not confirm a Time Travel bookmark for the supplied recovery point.'
    }
}

function Assert-V5RemoteMigrationsApplied {
    # `wrangler d1 migrations list` reports only unapplied files.  Refuse an
    # enable operation if any V5 table migration is still pending remotely.
    $pendingNames = @(Get-RemotePendingMigrationNames)
    $required = Get-V5MigrationNames
    $pending = @($required | Where-Object { $pendingNames -contains $_ })
    if ($pending.Count -gt 0) {
        throw 'Refusing to enable V5 before its four D1 migrations are applied remotely.'
    }
}

function Get-V5MigrationNames {
    return @(
        '0015_v5_campaign_foundation.sql',
        '0016_v5_player_progress.sql',
        '0017_v5_gameplay_writes.sql',
        '0018_v5_chat_narrative.sql'
    )
}

function Get-RemotePendingMigrationNames {
    $migrationOutput = Invoke-WranglerCapture d1 migrations list kontur --remote
    # Wrangler lists only files from the local migrations directory. Match the
    # actual local names instead of assuming an underscore-only filename
    # convention, so a pending `0019-hotfix.sql` is never silently skipped.
    $localNames = @(Get-ChildItem -LiteralPath (Join-Path $WorkerDir 'migrations') -Filter '*.sql' -File |
        ForEach-Object { $_.Name })
    return @($localNames | Where-Object { $migrationOutput -match [regex]::Escape($_) })
}

function Assert-OnlyV5MigrationsPending {
    $pending = @(Get-RemotePendingMigrationNames)
    $expected = Get-V5MigrationNames
    $unexpected = @($pending | Where-Object { $_ -notin $expected })
    if ($unexpected.Count -gt 0) {
        throw 'Remote D1 has pending migrations outside the reviewed V5 set.'
    }
    return $pending
}

Set-Location -LiteralPath $ProjectRoot
$script:Pnpm = Resolve-Pnpm

if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $env:HTTPS_PROXY = $ProxyUrl
    $env:HTTP_PROXY = $ProxyUrl
    if ([string]::IsNullOrWhiteSpace($env:NO_PROXY)) { $env:NO_PROXY = 'localhost,127.0.0.1,::1' }
}

if ([string]::IsNullOrWhiteSpace($MiniAppUrl)) {
    $publicUrl = Read-EnvValue (Join-Path $ProjectRoot '.env.cloudflare.local') 'PUBLIC_URL'
    if ($publicUrl) { $MiniAppUrl = $publicUrl.TrimEnd('/') + '/?season=zero' }
}
if ([string]::IsNullOrWhiteSpace($MiniAppUrl) -or -not $MiniAppUrl.StartsWith('https://')) {
    throw 'Supply the current HTTPS Mini App URL with -MiniAppUrl, or keep PUBLIC_URL in .env.cloudflare.local.'
}

switch ($Mode) {
    'ApplyMigrations' { $game = $null; $publish = $null }
    'DeployDisabled' { $game = 'false'; $publish = 'false' }
    'EnableGame' { $game = 'true'; $publish = 'false' }
    'DisableGame' { $game = 'false'; $publish = 'false' }
    # Wrangler uploads config vars even with --keep-vars. These modes must
    # therefore repeat true explicitly instead of accidentally restoring the
    # config default false. They require acknowledgement of the separately
    # verified EnableGame step; DisableGame is the safe full shutdown path.
    'EnablePublish' { $game = 'true'; $publish = 'true' }
    'DisablePublish' { $game = 'true'; $publish = 'false' }
}

if ($Mode -in @('EnablePublish', 'DisablePublish') -and -not $GameAlreadyEnabled) {
    throw "$Mode requires -GameAlreadyEnabled after a verified EnableGame release. Use DisableGame for a full shutdown."
}
$gameDisplay = if ($null -eq $game) { 'unchanged' } else { $game }
$publishDisplay = if ($null -eq $publish) { 'unchanged' } else { $publish }

Write-Host 'Target: production Worker kontur-igor'
Write-Host "Mode: $Mode (LIVE_CAMPAIGN_V5_ENABLED=$gameDisplay; LIVE_CAMPAIGN_V5_PUBLISH_ENABLED=$publishDisplay)"
Write-Host 'Safety: keep existing Worker vars/secrets; preserve V1-V4; D1 writes require a verified recovery point.'

if (-not $Apply) {
    Write-Host 'Production unchanged.'
    Write-Host 'DRY_RUN=PASS'
    exit 0
}

$recoveryKind = $null
if ($Mode -in @('ApplyMigrations', 'DeployDisabled')) {
    if (-not [string]::IsNullOrWhiteSpace($BackupManifest)) {
        Assert-VerifiedBackup $BackupManifest $MaxBackupAgeMinutes
        $recoveryKind = 'logical_backup'
    } elseif (-not [string]::IsNullOrWhiteSpace($TimeTravelTimestamp)) {
        $recoveryKind = 'time_travel'
    } else {
        throw 'Supply either -BackupManifest or -TimeTravelTimestamp from a fresh verified recovery point.'
    }
}
$dirty = (& git status --porcelain --untracked-files=all | Out-String).Trim()
if ($dirty) { throw 'Refusing deployment from a dirty worktree. Commit the reviewed checkpoint first.' }

# A target-D1 read proves the token, account routing and database access that
# this release actually needs.  It avoids Wrangler's extra `whoami` membership
# lookup, which is unrelated to deployment and can time out behind a proxy.
[void](Invoke-WranglerCapture d1 migrations list kontur --remote)
if ($recoveryKind -eq 'time_travel') { Assert-VerifiedTimeTravelRecoveryPoint $TimeTravelTimestamp $MaxBackupAgeMinutes }
if ($Mode -eq 'ApplyMigrations') {
    $pending = @(Assert-OnlyV5MigrationsPending)
    if ($pending.Count -eq 0) {
        Write-Host 'D1_MIGRATIONS=ALREADY_APPLIED'
        exit 0
    }
    $oldCi = $env:CI
    $env:CI = 'true'
    try {
        Invoke-Wrangler d1 migrations apply kontur --remote
    } finally {
        $env:CI = $oldCi
    }
    Assert-V5RemoteMigrationsApplied
    Write-Host 'D1_MIGRATIONS=PASS'
    exit 0
}
if ($Mode -in @('EnableGame', 'EnablePublish')) { Assert-V5RemoteMigrationsApplied }
& $script:Pnpm -F '@kontur/worker' build:assets
if ($LASTEXITCODE -ne 0) { throw 'Mini App build failed.' }

# --keep-vars prevents Wrangler from deleting the legacy MINIAPP_URL and all
# existing bindings. MINIAPP_URL is also supplied explicitly so a stale local
# config can never replace the working menu URL with an empty value.
$deployArguments = @('deploy', '--keep-vars', '--var', "MINIAPP_URL:$MiniAppUrl", '--var', "LIVE_CAMPAIGN_V5_PUBLISH_ENABLED:$publish")
if ($null -ne $game) { $deployArguments += @('--var', "LIVE_CAMPAIGN_V5_ENABLED:$game") }
Invoke-Wrangler @deployArguments

$origin = ([Uri]$MiniAppUrl).GetLeftPart([UriPartial]::Authority)
$health = Invoke-RestMethod -Uri "$origin/api/v1/health" -TimeoutSec 30
if (-not $health.ok -or $health.driver -ne 'd1' -or $health.devMode) {
    throw 'Production health check returned an unexpected result.'
}
Write-Host 'DEPLOY=PASS'
Write-Host "V5_GAME=$(if ($null -eq $game) { 'UNCHANGED' } else { $game.ToUpperInvariant() })"
Write-Host "V5_PUBLISH=$($publish.ToUpperInvariant())"
