param(
  [Parameter(Mandatory=$true)]
  [string]$TaskJsonPath
)

# Auto-detect repo root from this script location:
# ...\apps\pluto\runner -> up 3 levels -> repo root of this worktree
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$AuditDir = "C:\Neptune\Logs"

$AuditWriter = Join-Path $RepoRoot "core\tools\powershell\Write-AuditEvent.ps1"
$Installer   = Join-Path $RepoRoot "core\tools\powershell\Install-ApprovedApp.ps1"

function Audit($taskId, $action, $status, $details=@{}, $error="") {
  if (Test-Path $AuditWriter) {
    & $AuditWriter -TaskId $taskId -Action $action -Status $status -AuditDir $AuditDir -Details $details -Error $error
  }
}

if (-not (Test-Path $TaskJsonPath)) { throw "Task JSON not found: $TaskJsonPath" }

$task = Get-Content $TaskJsonPath -Raw | ConvertFrom-Json
$taskId = $task.id

Write-Host "Pluto received task $taskId type=$($task.type)"

Audit $taskId "task_received" "started" @{ task_type = $task.type; path = $TaskJsonPath }

try {
  if ($task.type -ne "install_app") {
    Write-Host "Denied: unsupported task type"
    Audit $taskId "task_denied" "denied" @{ reason = "unsupported_task_type"; task_type = $task.type }
    exit 2
  }

  $wingetId = $task.payload.winget_id
  if (-not $wingetId) {
    Audit $taskId "task_failed" "failed" @{ reason = "missing_payload_winget_id" } "Missing payload.winget_id"
    throw "Missing payload.winget_id"
  }

  # Approval gate must be enforced by Neptune; Pluto still records what it sees.
  if ($task.requires_approval -eq $true) {
    Audit $taskId "approval_required" "started" @{ requires_approval = $true }
  }

  if (-not (Test-Path $Installer)) {
    Audit $taskId "task_failed" "failed" @{ reason = "installer_script_missing"; installer = $Installer } "Installer script missing"
    throw "Installer script missing: $Installer"
  }

  Audit $taskId "install_app" "started" @{ winget_id = $wingetId; installer = "winget" }

  & $Installer -WingetId $wingetId

  Audit $taskId "install_app" "success" @{ winget_id = $wingetId }
  Write-Host "✅ Pluto completed install: $wingetId"
  exit 0
}
catch {
  $msg = $_.Exception.Message
  Audit $taskId "task_failed" "failed" @{ task_type = $task.type } $msg
  throw
}
