[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Resolve-Pnpm {
    $command = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $fallback = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    throw 'pnpm was not found.'
}

function Resolve-Node {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $fallback = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    throw 'Node.js was not found.'
}

foreach ($port in 8976, 8977) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Local port $port is already in use. Stop the old OAuth attempt and retry."
    }
}

$bridge = $null
try {
    $bridgeSource = @"
const net = require('net');
const server = net.createServer((client) => {
  const upstream = net.connect(8977, '127.0.0.1');
  client.pipe(upstream);
  upstream.pipe(client);
  const close = () => { client.destroy(); upstream.destroy(); };
  client.on('error', close);
  upstream.on('error', close);
});
server.listen(8976, '127.0.0.1');
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($bridgeSource))
    $nodeArgument = "eval(Buffer.from('$encoded','base64').toString())"
    $bridge = Start-Process -FilePath (Resolve-Node) -ArgumentList @('-e', $nodeArgument) -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 400

    $listener = Get-NetTCPConnection -State Listen -LocalPort 8976 -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -eq '127.0.0.1' -and $_.OwningProcess -eq $bridge.Id }
    if (-not $listener) { throw 'Could not start the temporary OAuth bridge.' }

    Set-Location -LiteralPath $ProjectRoot
    & (Resolve-Pnpm) -F '@kontur/worker' exec wrangler login --no-use-keyring `
        --callback-host 127.0.0.1 --callback-port 8977
    if ($LASTEXITCODE -ne 0) { throw "Wrangler login exited with code $LASTEXITCODE" }
} finally {
    if ($bridge) {
        $process = Get-Process -Id $bridge.Id -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq 'node') {
            Stop-Process -Id $bridge.Id -Force
        }
    }
}

Write-Host 'Cloudflare OAuth is ready; the temporary localhost bridge was stopped.' -ForegroundColor Green
