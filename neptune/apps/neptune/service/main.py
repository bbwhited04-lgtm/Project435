import os
from pathlib import Path
def read_audit(audit_dir: Path, task_id: str) -> list[dict]:
    path = audit_dir / f"audit_{task_id}.jsonl"
    if not path.exists():
        return []
    events = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        events.append(json.loads(line))
    return events
def get_repo_root() -> Path:
    env_root = os.getenv("PROJECT435_ROOT")
    if env_root:
        return Path(env_root)
    # fallback: worktree relative
    return Path(__file__).resolve().parents[3]

def load_policy(root: Path) -> dict:
    policy_path = root / "core" / "policy" / "policy.default.json"
    return json.loads(policy_path.read_text(encoding="utf-8"))
