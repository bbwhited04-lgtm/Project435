param(
  [Parameter(Mandatory=$true)][string]$TaskId,
  [Parameter(Mandatory=$true)][string]$Action,
  [Parameter(Mandatory=$true)][ValidateSet("started","success","failed","denied")][string]$Status,
  [Parameter(Mandatory=$true)][string]$AuditDir,
  [Parameter()][hashtable]$Details = @{},
  [Parameter()][string]$Error = ""
)

# Ensure audit directory exists
if (-not (Test-Path $AuditDir)) {
  New-Item -ItemType Directory -Path $AuditDir -Force | Out-Null
}

$event = [ordered]@{
  id        = [guid]::NewGuid().ToString()
  task_id   = $TaskId
  timestamp = (Get-Date).ToUniversalTime().ToString("o")
  actor     = "pluto"
  action    = $Action
  status    = $Status
  details   = $Details
  artifacts = @()
  error     = $(if ($Error) { $Error } else { $null })
}

$outFile = Join-Path $AuditDir ("audit_{0}.jsonl" -f $TaskId)

# App
