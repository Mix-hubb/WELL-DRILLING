param(
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"
if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required" }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$output = Join-Path $OutputDirectory "well-drilling-$timestamp.dump"

pg_dump $env:DATABASE_URL --format=custom --no-owner --file $output
$hash = (Get-FileHash $output -Algorithm SHA256).Hash
"$hash  $(Split-Path $output -Leaf)" | Set-Content "$output.sha256"
Write-Output "Backup created: $output"
