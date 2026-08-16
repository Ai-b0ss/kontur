param()
$ErrorActionPreference="Stop"
if (-not $env:RUNTIME_STATE_KEY) { throw "RUNTIME_STATE_KEY is required" }
$outRoot = Join-Path $HOME "runtime-state-restored"
New-Item -ItemType Directory -Path $outRoot -Force | Out-Null

$gpg = (Get-Command gpg.exe -ErrorAction SilentlyContinue).Source
if (-not $gpg) {
    $candidate = Join-Path $env:ProgramFiles "Git\usr\bin\gpg.exe"
    if (Test-Path -LiteralPath $candidate) { $gpg=$candidate }
}
if (-not $gpg) { throw "gpg.exe not found" }

Get-ChildItem -LiteralPath ".runtime-state" -Filter "*.gpg" -File | ForEach-Object {
    $name = $_.Name.Substring(0,$_.Name.Length-4)
    $out = Join-Path $outRoot $name
    & $gpg --quiet --batch --yes --pinentry-mode loopback --passphrase $env:RUNTIME_STATE_KEY --output $out --decrypt $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "gpg decrypt failed: $($_.Name)" }
}
Write-Host "Decrypted archives: $outRoot"
