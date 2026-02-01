import json
import os
import time
from pathlib import Path
from dotenv import load_dotenv

from core.tools.python.policy import Policy

def repo_root() -> Path:
    env_root = os.getenv("PROJECT435_ROOT")
    if env_root:
        return Path(env_root)
    return Path(__file__).resolve().parents[3]

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path: Path, obj: dict):
    path.write_text(json.dumps(obj, indent=2), encoding="utf-8")

def read_audit_events(audit_file: Path) -> list[dict]:
    if not audit_file.exists():
        return []
    events = []
    for line in audit_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except Exception:
            # Ignore malformed lines; audit is append-only
            continue
    return events

def last_status(events: list[dict]) -> str | None:
    if not events:
        return None
    # Find last meaningful terminal status
    for ev in reversed(events):
        st = ev.get("status")
        if st in ("success", "failed", "denied"):
            return st
    return events[-1].get("status")

def ensure_task_id(task: dict, filename: str) -> str:
    # Ensure stable id; if missing, derive from filename
    tid = task.get("id")
    if tid:
        return tid
    safe = filename.replace(".json", "").replace(" ", "_")
    tid = f"task-{safe}"
    task["id"] = tid
    return tid

def main():
    load_dotenv()
    root = repo_root()

    # Policy paths
    policy_path = root / "core/policy/policy.default.json"
    apps_path   = root / "core/policy/apps.allowlist.json"
    allow_path  = root / "core/policy/domains.allowlist.json"
    block_path  = root / "core/policy/domains.blocklist.json"

    pol = Policy(policy_path, apps_path, allow_path, block_path)

    tasks_root = root / "tasks"
    pending    = tasks_root / "pending"
    approved   = tasks_root / "approved"
    running    = tasks_root / "running"
    done       = tasks_root / "done"
    failed     = tasks_root / "failed"

    audit_dir = Path(load_json(policy_path).get("logging", {}).get("audit_path", str(root / "_runtime/logs")))
    audit_dir.mkdir(parents=True, exist_ok=True)

    print("Neptune online ✅")
    print("Root:", root)
    print("Audit dir:", audit_dir)
    print("No scraping:", pol.no_scraping())

    # Simple loop: approve -> dispatch (by copying to running) -> watch audit -> finalize
    while True:
        # 1) Auto-move from pending -> approved only if task is policy-valid.
        for task_file in pending.glob("*.json"):
            try:
                task = load_json(task_file)
            except Exception as e:
                print(f"❌ Pending task unreadable: {task_file.name} ({e})")
                # Move to failed so it doesn't loop forever
                task_file.rename(failed / task_file.name)
                continue

            tid = ensure_task_id(task, task_file.name)

            # Minimal policy checks for install_app (expand later)
            if task.get("type") == "install_app":
                winget_id = (task.get("payload") or {}).get("winget_id")
                if not winget_id or not pol.is_app_approved(winget_id):
                    print(f"❌ Denied by policy (not approved app): {winget_id} ({task_file.name})")
                    task["denied_reason"] = "app_not_approved"
                    write_json(task_file, task)
                    task_file.rename(failed / task_file.name)
                    continue

            # Require human approval by default
            if task.get("requires_approval", True):
                print(f"⏸ Needs approval: {task_file.name} (id={tid})")
                # Leave in pending; you can approve by moving it to approved manually
                continue

            # If no approval required, auto-approve
            print(f"✅ Auto-approved: {task_file.name}")
            task_file.rename(approved / task_file.name)

        # 2) Dispatch approved -> running (create dispatch.*.json for Pluto runner)
        for task_file in approved.glob("*.json"):
            task = load_json(task_file)
            tid = ensure_task_id(task, task_file.name)

            dispatch_name = f"dispatch.{task_file.name}"
            dispatch_path = tasks_root / dispatch_name

            # Write dispatch file at tasks root (where you already run Pluto from)
            write_json(dispatch_path, task)

            print(f"📤 Dispatched for Pluto: {dispatch_path.name} (id={tid})")

            # Move the approved task into running for Neptune tracking
            task_file.rename(running / task_file.name)

        # 3) Watch running tasks via audit JSONL and finalize
        for task_file in running.glob("*.json"):
            task = load_json(task_file)
            tid = ensure_task_id(task, task_file.name)

            audit_file = audit_dir / f"audit_{tid}.jsonl"
            events = read_audit_events(audit_file)
            st = last_status(events)

            if st == "success":
                print(f"✅ Done: {task_file.name}")
                task_file.rename(done / task_file.name)
            elif st in ("failed", "denied"):
                print(f"❌ Failed/Denied: {task_file.name} (status={st})")
                task["final_status"] = st
                write_json(task_file, task)
                task_file.rename(failed / task_file.name)

        time.sleep(2)

if __name__ == "__main__":
    main()
