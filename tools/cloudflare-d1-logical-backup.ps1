[CmdletBinding()]
param(
    [string]$OutputDirectory = 'backups',
    [string]$ProxyUrl = $env:HTTPS_PROXY,
    [ValidateRange(1, 1000)][int]$ChunkSize = 500,
    [ValidateRange(1, 12)][int]$MaxTransportAttempts = 12
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

function ConvertFrom-MixedJsonArray([string]$Text) {
    $lastBracket = $Text.LastIndexOf(']')
    if ($lastBracket -lt 0) { throw 'Wrangler не вернул JSON-массив.' }
    foreach ($match in [regex]::Matches($Text, '\[')) {
        $candidate = $Text.Substring($match.Index, $lastBracket - $match.Index + 1)
        try { return $candidate | ConvertFrom-Json -ErrorAction Stop } catch { continue }
    }
    throw 'Не удалось извлечь JSON-массив из вывода Wrangler.'
}

function Invoke-PnpmCapture {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [ValidateRange(1, 120)][int]$TimeoutSeconds = 45
    )
    # Each D1 query is a child we start ourselves. Keep output in memory (it
    # can contain backup rows) and kill only that exact process tree on a
    # transport hang, never an unrelated Node or Worker process.
    # Do not launch pnpm.cmd directly: cmd.exe can reinterpret parentheses
    # and quotes inside a SQL --command. A short encoded PowerShell child
    # preserves the exact argument array and is still one owned process tree.
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
        if (-not $process.Start()) { throw 'Could not start the bounded Wrangler child process.' }
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

function Invoke-D1Rows {
    param(
        [string]$Sql,
        [string]$Label = 'D1 query'
    )
    # pnpm forwards a multiline --command as separate arguments; D1 receives
    # only the first line. These backup queries contain no multiline literals.
    $Sql = $Sql -replace "[\r\n]+", ' '
    for ($attempt = 1; $attempt -le $MaxTransportAttempts; $attempt++) {
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $execution = Invoke-PnpmCapture -Arguments @('-F', '@kontur/worker', 'exec', 'wrangler', 'd1', 'execute', 'kontur', '--remote', '--json', '--command', $Sql)
            $text = [string]$execution.Text
            $exitCode = [int]$execution.ExitCode
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        if ($exitCode -eq 0) {
            try {
                $result = (ConvertFrom-MixedJsonArray $text)[0]
            } catch {
                # A successful pnpm wrapper with no D1 JSON is a known
                # transport-side incomplete response, never a row to write.
                # Retry it under the same bounded transport policy.
                $text = $text + [Environment]::NewLine + 'missing D1 JSON response'
                $exitCode = 1
            }
            if ($exitCode -eq 0) {
                if (-not $result.success) { throw "$Label returned an unsuccessful result while creating logical backup." }
                return @($result.results)
            }
        }
        $transient = $text -match '(?i)fetch failed|timeout|time(?:d)?\s*out|ECONNRESET|ECONNREFUSED|socket hang up|missing D1 JSON response|\b429\b|\b5\d{2}\b'
        if (-not $transient -or $attempt -eq $MaxTransportAttempts) { break }
        Start-Sleep -Seconds ([Math]::Min($attempt, 5))
    }
    throw "$Label failed while creating logical backup."
}

function Quote-Identifier([string]$Name) {
    return '"' + $Name.Replace('"', '""') + '"'
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

$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$baseName = "kontur-d1-logical-$stamp"
$sqlPath = Join-Path $resolvedOutput ($baseName + '.sql')
$partialPath = Join-Path $resolvedOutput ($baseName + '.partial.sql')
$shaPath = $sqlPath + '.sha256'
$metaPath = Join-Path $resolvedOutput ($baseName + '.json')
foreach ($path in @($sqlPath, $partialPath, $shaPath, $metaPath)) {
    if (Test-Path -LiteralPath $path) { throw "Файл уже существует: $path" }
}

$encoding = [System.Text.UTF8Encoding]::new($false)
$writer = $null
try {
    Set-Location -LiteralPath $WorkerDir
    $schema = @(Invoke-D1Rows -Label 'schema query' -Sql @'
SELECT type, name, sql
  FROM sqlite_master
 WHERE type IN ('table','view','index','trigger')
   AND sql IS NOT NULL
   AND name NOT LIKE 'sqlite_%'
   AND name NOT LIKE '_cf_%'
 ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'view' THEN 2 WHEN 'index' THEN 3 WHEN 'trigger' THEN 4 ELSE 9 END, name;
'@)
    $tables = @($schema | Where-Object { $_.type -eq 'table' })
    $laterObjects = @($schema | Where-Object { $_.type -ne 'table' })
    if ($tables.Count -eq 0) { throw 'Logical backup found no user tables.' }

    # D1 does not defer foreign-key checks for a whole import. Read the real
    # references and insert parent tables before their children.
    $tableDetails = @()
    foreach ($table in $tables) {
        $quotedTable = Quote-Identifier ([string]$table.name)
        $columns = @(Invoke-D1Rows -Label "columns:$($table.name)" -Sql "PRAGMA table_info($quotedTable);")
        if ($columns.Count -eq 0) { throw "Could not read columns for table $($table.name)." }
        $references = @(Invoke-D1Rows -Label "references:$($table.name)" -Sql "PRAGMA foreign_key_list($quotedTable);" |
            ForEach-Object { [string]$_.table } | Where-Object { $_ })
        $tableDetails += [pscustomobject]@{
            Name = [string]$table.name
            Sql = [string]$table.sql
            QuotedName = $quotedTable
            Columns = $columns
            References = $references
        }
    }
    $remaining = [System.Collections.ArrayList]::new()
    foreach ($detail in $tableDetails) { [void]$remaining.Add($detail) }
    $orderedTables = @()
    while ($remaining.Count -gt 0) {
        $remainingNames = @($remaining | ForEach-Object { $_.Name })
        $ready = @($remaining | Where-Object {
            $candidate = $_
            @($candidate.References | Where-Object { $_ -ne $candidate.Name -and $remainingNames -contains $_ }).Count -eq 0
        })
        if ($ready.Count -eq 0) { throw 'Logical backup cannot order a cyclic foreign-key dependency.' }
        foreach ($detail in $ready) {
            $orderedTables += $detail
            [void]$remaining.Remove($detail)
        }
    }

    $writer = [System.IO.StreamWriter]::new($partialPath, $false, $encoding)
    $writer.WriteLine('-- Kontur logical D1 backup. Generated by cloudflare-d1-logical-backup.ps1')
    $writer.WriteLine('PRAGMA foreign_keys=OFF;')
    $writer.WriteLine('BEGIN TRANSACTION;')
    foreach ($object in $orderedTables) {
        $writer.WriteLine($object.sql.TrimEnd().TrimEnd(';') + ';')
    }

    $totalRows = 0
    $tableCounts = [ordered]@{}
    foreach ($table in $orderedTables) {
        $quotedTable = $table.QuotedName
        $columnNames = @($table.Columns | ForEach-Object { Quote-Identifier ([string]$_.name) })
        $valueTerms = @($table.Columns | ForEach-Object { 'quote(' + (Quote-Identifier ([string]$_.name)) + ')' })
        $countRow = @(Invoke-D1Rows -Label "count:$($table.Name)" -Sql "SELECT count(*) AS total FROM $quotedTable;")[0]
        $rowCount = [int]$countRow.total
        $tableCounts[[string]$table.Name] = $rowCount
        $totalRows += $rowCount
        for ($offset = 0; $offset -lt $rowCount; $offset += $ChunkSize) {
            $statement = "SELECT 'INSERT INTO $quotedTable ($($columnNames -join ', ')) VALUES (' || $($valueTerms -join " || ',' || ") || ');' AS statement FROM $quotedTable LIMIT $ChunkSize OFFSET $offset;"
            foreach ($row in @(Invoke-D1Rows -Label "rows:$($table.Name)@$offset" -Sql $statement)) {
                $writer.WriteLine([string]$row.statement)
            }
        }
    }

    foreach ($object in $laterObjects) {
        $writer.WriteLine($object.sql.TrimEnd().TrimEnd(';') + ';')
    }
    $writer.WriteLine('COMMIT;')
    $writer.WriteLine('PRAGMA foreign_keys=ON;')
    $writer.Dispose()
    $writer = $null

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $partialPath).Hash
    Move-Item -LiteralPath $partialPath -Destination $sqlPath
    Set-Content -LiteralPath $shaPath -Encoding ascii -Value "$hash  $([IO.Path]::GetFileName($sqlPath))"
    [ordered]@{
        generatedAt = [DateTime]::UtcNow.ToString('o')
        database = 'kontur'
        kind = 'logical_sql_fallback'
        file = [IO.Path]::GetFileName($sqlPath)
        bytes = (Get-Item -LiteralPath $sqlPath).Length
        sha256 = $hash
        containsPersonalData = $true
        tableCount = $tables.Count
        rowCount = $totalRows
        tableCounts = $tableCounts
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $metaPath -Encoding utf8

    "BACKUP=$sqlPath"
    "SHA256=$hash"
    "BYTES=$((Get-Item -LiteralPath $sqlPath).Length)"
    "TABLES=$($tables.Count)"
    "ROWS=$totalRows"
    'KIND=LOGICAL_SQL_FALLBACK'
    'PERSONAL_DATA=YES'
} finally {
    if ($writer) { $writer.Dispose() }
    if (Test-Path -LiteralPath $partialPath) { Remove-Item -LiteralPath $partialPath -Force }
    Set-Location -LiteralPath $ProjectRoot
}
