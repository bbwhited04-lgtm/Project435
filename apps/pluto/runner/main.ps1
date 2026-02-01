param(
  [Parameter(Mandatory=$true)]
  [string]$TaskJsonPath
)

# Resolve PROJECT435_ROOT (preferred)
$RepoRoot = $env:PROJECT435_ROOT

# Fallback: derive from script location (worktree-safe)
if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
}

# Read audit path from shared policy
$PolicyPath = Join-Path $RepoRoot "core\policy\policy.default.json"
$PolicyJson = Get-Content $PolicyPath -Raw | ConvertFrom-Json
try {
  $PolicyJson = Get-Content $PolicyPath -Raw | ConvertFrom-Json
} catch {
  throw "Policy JSON invalid at: $PolicyPath. Fix JSON formatting. Error: $($_.Exception.Message)"
}

$AuditDir = $PolicyJson.logging.audit_path
if (-not $AuditDir) { throw "Policy missing logging.audit_path in $PolicyPath" }


function Get-Sha256String($text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Require-ApprovalReceipt($task, $taskJsonText, $repoRoot) {
  if ($task.requires_approval -ne $true) { return }

  $taskId = $task.id
  if (-not $taskId) { throw "Task missing id; cannot verify approval receipt." }

  $receiptPath = Join-Path $repoRoot ("tasks\approvals\approval_{0}.json" -f $taskId)
  if (-not (Test-Path $receiptPath)) {
    throw "Approval receipt missing: $receiptPath"
  }

  $receipt = Get-Content $receiptPath -Raw | ConvertFrom-Json

  $taskHash = Get-Sha256String $taskJsonText
  if ($receipt.task_hash_sha256 -ne $taskHash) {
    throw "Approval receipt hash mismatch. Receipt=$($receipt.task_hash_sha256) Task=$taskHash"
  }

  # Optional expiry enforcement
  if ($receipt.expires_at_utc) {
    $exp = [DateTime]::Parse($receipt.expires_at_utc).ToUniversalTime()
    if ([DateTime]::UtcNow -gt $exp) {
      throw "Approval receipt expired at $($receipt.expires_at_utc)"
    }
  }
}


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
