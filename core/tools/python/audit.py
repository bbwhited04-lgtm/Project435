import json
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any, Dict, Optional

def emit_audit(audit_dir: str, task_id: str, action: str, status: str, details: Dict[str, Any], error: Optional[str]=None):
    Path(audit_dir).mkdir(parents=True, exist_ok=True)
    event = {
        "id": str(uuid4()),
        "task_id": task_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "actor": "pluto",
        "action": action,
        "status": status,
        "details": details,
        "artifacts": [],
        "error": error
    }
    out = Path(audit_dir) / f"audit_{task_id}.jsonl"
    with out.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")
    return event
