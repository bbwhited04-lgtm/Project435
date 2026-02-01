import json
import os
from pathlib import Path
from dotenv import load_dotenv

from core.tools.python.policy import Policy

def load_task(task_path: Path):
    return json.loads(task_path.read_text(encoding="utf-8"))

def main():
    load_dotenv()

    root = Path(__file__).resolve().parents[3]

    policy_path = root / "core/policy/policy.default.json"
    apps_path   = root / "core/policy/apps.allowlist.json"
    allow_path  = root / "core/policy/domains.allowlist.json"
    block_path  = root / "core/policy/domains.blocklist.json"

    pol = Policy(policy_path, apps_path, allow_path, block_path)

    print("Neptune online ✅")
    print("No scraping:", pol.no_scraping())
    print("Adult blocked:", True)

    task_path = root / "tasks" / "install_node_lts.json"
    task = load_task(task_path)

    print("\nIncoming task:")
    print(json.dumps(task, indent=2))

    if task["type"] == "install_app":
        winget_id = task["payload"]["winget_id"]

        if not pol.is_app_approved(winget_id):
            print("❌ Task denied: app not approved")
            return

        if task["requires_approval"]:
            approval = input("\nApprove this task? (yes/no): ").strip().lower()
            if approval != "yes":
                print("❌ Task not approved by user")
                return

        print("✅ Task approved. Dispatching to Pluto…")

        # Write dispatch marker
        dispatch_path = root / "tasks" / "dispatch.install_node_lts.json"
        dispatch_path.write_text(json.dumps(task, indent=2), encoding="utf-8")

        print(f"📤 Dispatched task to Pluto: {dispatch_path}")

if __name__ == "__main__":
    main()
