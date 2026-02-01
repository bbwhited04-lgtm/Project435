param(
  [Parameter(Mandatory=$true)]
  [string]$WingetId
)

# This script intentionally only uses winget (approved installer).
# Neptune should ensure $WingetId is allowlisted before calling Pluto to execute.

$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) { throw "winget not found" }

winget install --id $WingetId --exact --accept-package-agreements --accept-source-agreements
