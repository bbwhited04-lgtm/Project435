# Audit Contract (Pluto -> Neptune)

Every attempted action emits an audit event.

Required fields:
- id: string (uuid)
- task_id: string
- timestamp: ISO8601
- actor: "pluto"
- action: string
- status: "started" | "success" | "failed" | "denied"
- details: object (safe metadata only)
- artifacts: array (paths/logs created)
- error: string|null
