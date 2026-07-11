param(
  [string]$Container = "cpinsight-postgres-1",
  [string]$Database = "cpinsight",
  [string]$User = "cpinsight",
  [string]$OutputDir = ".\backups"
)

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputFile = Join-Path $OutputDir "$Database-$timestamp.sql.gz"

docker exec $Container pg_dump -U $User $Database | gzip > $outputFile
Write-Host "Wrote backup to $outputFile"
