# Task Contract (Neptune -> Pluto)

A Task is a JSON object signed/approved by Neptune and executed by Pluto.

Required fields:
- id: string (uuid)
- created_at: ISO8601
- requested_by: "user" | "system"
- type: string (e.g., "install_app", "run_command", "open_url", "file_op")
- risk: "low" | "medium" | "high"
- requires_approval: boolean
- payload: object (type-specific)
- constraints: object (sandbox folders, allowed domains, etc.)

Rules:
- Pluto executes only tasks that pass validation AND match active policy.
- Pluto must refuse if policy denies, if approval missing, or if any constraint is violated.
