import json
import os
import time
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

from core.tools.python.policy import Policy


# ----------------------------
# Utilities
# ----------------------------

def repo_root() -> Path:
    """Single source of truth: PROJECT435_ROOT env var, fallback to relative."""
    env_root = os.getenv("PROJECT435_ROOT")
    if env_root:
        return Path(env_root)
    return Path(__file__).resolve().parents[3]


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj: dict):
    path.write_text(json.dumps(obj, indent=2), encoding="utf-8")


def safe_move(src: Path, dst: Path) -> Path:
    """
    Move src -> dst, but if dst exists, append a suffix.
    Returns the final destination path.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        src.rename(dst)
        return dst

    stem = dst.stem
    suf = dst.suffix
    for i in range(1, 1000):
        candidate = dst.parent / f"{stem}.{i}{suf}"
        if not candidate.exists():
            src.rename(candidate)
            return candidate
    raise RuntimeError(f"Unable to move {src} -> {dst}: too many conflicts")


def ensure_task_id(task: dict, filename: str) -> str:
    """Ensure stable id; if missing, derive from filename."""
    tid = task.get("id")
    if tid:
        return tid
    safe = filename.replace(".json", "").replace(" ", "_")
    tid = f"task-{safe}"
    task["id"] = tid
    return tid


def read_audit_events(audit_file: Path) -> list[dict]:
    """Read JSONL audit events; ignore malformed lines."""
    if not audit_file.exists():
        return []
    events: list[dict] = []
    for line in audit_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except Exception:
            continue
    return events


def last_terminal_status(events: list[dict]) -> str | None:
    """Return last terminal status (success/failed/denied) if present; else last status."""
    if not events:
        return None
    for ev in reversed(events):
        st = ev.get("status")
        if st in ("success", "failed", "denied"):
            return st
    return events[-1].get("status")


def write_approval_receipt(root: Path, task: dict, task_json_text: str, method: str) -> Path:
    approvals_dir = root / "tasks" / "approvals"
    approvals_dir.mkdir(parents=True, exist_ok=True)

    task_id = task["id"]
    receipt = {
        "task_id": task_id,
        "task_hash_sha256": sha256_text(task_json_text),
        "approved_at_utc": now_utc(),
        "approved_by": os.getenv("USERNAME", "local_operator"),
        "approval_method": method,
        # time-box approval (Pluto enforces). Adjust as you like.
        "expires_at_utc": (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat(),
    }

    receipt_path = approvals_dir / f"approval_{task_id}.json"
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    return receipt_path


# ----------------------------
# Neptune Loop
# ----------------------------

def ensure_folders(tasks_root: Path):
    for name in ["pending", "approved", "running", "done", "failed", "approvals"]:
        (tasks_root / name).mkdir(parents=True, exist_ok=True)


def main():
    load_dotenv()
    root = repo_root()

    # Policy paths
    policy_path = root / "core" / "policy" / "policy.default.json"
    apps_path   = root / "core" / "policy" / "apps.allowlist.json"
    allow_path  = root / "core" / "policy" / "domains.allowlist.json"
    block_path  = root / "core" / "policy" / "domains.blocklist.json"

    # Load policy for enforcement + audit dir
    pol = Policy(policy_path, apps_path, allow_path, block_path)
    policy_json = load_json(policy_path)

    # Tasks folders
    tasks_root = root / "tasks"
    ensure_folders(tasks_root)

    pending  = tasks_root / "pending"
    approved = tasks_root / "approved"
    running  = tasks_root / "running"
    done     = tasks_root / "done"
    failed   = tasks_root / "failed"

    # Audit dir from policy (fallback to F:\project435\_runtime\logs)
    audit_dir = Path(policy_json.get("logging", {}).get("audit_path", str(root / "_runtime" / "logs")))
    audit_dir.mkdir(parents=True, exist_ok=True)

    print("Neptune online ✅")
    print("PROJECT435_ROOT:", os.getenv("PROJECT435_ROOT"))
    print("Root:", root)
    print("Audit dir:", audit_dir)
    print("No scraping:", pol.no_scraping())
    print("Watching: tasks/pending, tasks/approved, tasks/running\n")

    while True:
        # ------------------------------------------------------------
        # 1) Validate pending tasks (but do NOT auto-approve)
        # ------------------------------------------------------------
        for task_file in pending.glob("*.json"):
            try:
                task = load_json(task_file)
            except Exception as e:
                print(f"❌ Pending task unreadable: {task_file.name} ({e})")
                safe_move(task_file, failed / task_file.name)
                continue

            tid = ensure_task_id(task, task_file.name)

            # Minimal enforcement: install_app must be allowlisted
            if task.get("type") == "install_app":
                winget_id = (task.get("payload") or {}).get("winget_id")
                if not winget_id or not pol.is_app_approved(winget_id):
                    print(f"❌ Denied by policy (not approved app): {winget_id} ({task_file.name})")
                    task["denied_reason"] = "app_not_approved"
                    write_json(task_file, task)
                    safe_move(task_file, failed / task_file.name)
                    continue

            # Always require human approval (liability protection)
            if task.get("requires_approval", True):
                print(f"⏸ Awaiting approval: {task_file.name} (id={tid})")
            else:
                # Even if someone sets requires_approval=false, we still recommend human approval.
                print(f"⚠️  Task says no approval required, but policy expects approval: {task_file.name} (id={tid})")
                print("    Move it to tasks/approved manually if you truly want it executed.\n")

        # ------------------------------------------------------------
        # 2) Dispatch approved tasks -> create receipt + dispatch file -> move to running
        # ------------------------------------------------------------
        for task_file in approved.glob("*.json"):
            task_text = task_file.read_text(encoding="utf-8")
            try:
                task = json.loads(task_text)
            except Exception as e:
                print(f"❌ Approved task unreadable JSON: {task_file.name} ({e})")
                safe_move(task_file, failed / task_file.name)
                continue

            tid = ensure_task_id(task, task_file.name)

            # Create dispatch file name
            dispatch_name = f"dispatch.{task_file.name}"
            dispatch_path = tasks_root / dispatch_name

            # If dispatch exists, create a unique one to avoid overwrite confusion
            if dispatch_path.exists():
                dispatch_path = tasks_root / f"dispatch.{task_file.stem}.{int(time.time())}{task_file.suffix}"

            # Write dispatch exactly as approved (stable hash)
            dispatch_path.write_text(task_text, encoding="utf-8")

            # Write approval receipt
            receipt_path = write_approval_receipt(root, task, task_text, method="manual_move")

            print(f"🧾 Approval receipt: {receipt_path.name}")
            print(f"📤 Dispatched for Pluto: {dispatch_path.name} (id={tid})")

            # Move task into running
            safe_move(task_file, running / task_file.name)

        # ------------------------------------------------------------
        # 3) Watch running tasks via audit JSONL -> finalize
        # ------------------------------------------------------------
        for task_file in running.glob("*.json"):
            try:
                task = load_json(task_file)
            except Exception as e:
                print(f"❌ Running task unreadable: {task_file.name} ({e})")
                safe_move(task_file, failed / task_file.name)
                continue

            tid = ensure_task_id(task, task_file.name)
            audit_file = audit_dir / f"audit_{tid}.jsonl"

            events = read_audit_events(audit_file)
            status = last_terminal_status(events)

            if status == "success":
                print(f"✅ Done: {task_file.name}")
                safe_move(task_file, done / task_file.name)
            elif status in ("failed", "denied"):
                print(f"❌ Failed/Denied: {task_file.name} (status={status})")
                task["final_status"] = status
                write_json(task_file, task)
                safe_move(task_file, failed / task_file.name)
            else:
                # still running or no audit yet — quiet
                pass

        time.sleep(2)


if __name__ == "__main__":
    main()
