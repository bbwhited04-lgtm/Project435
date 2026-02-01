import json
from pathlib import Path
from typing import Any, Dict, List

class Policy:
    def __init__(self, policy_path: Path, allowlist_apps: Path, allowlist_domains: Path, blocklist_domains: Path):
        self.policy = json.loads(policy_path.read_text(encoding="utf-8"))
        self.apps = json.loads(allowlist_apps.read_text(encoding="utf-8"))["apps"]
        self.allow_domains = set(json.loads(allowlist_domains.read_text(encoding="utf-8"))["domains"])
        self.block_domains = set(json.loads(blocklist_domains.read_text(encoding="utf-8"))["domains"])

    def is_app_approved(self, winget_id: str) -> bool:
        return any(a.get("id") == winget_id and a.get("source") == "winget" for a in self.apps)

    def is_domain_allowed(self, domain: str) -> bool:
        if domain in self.block_domains:
            return False
        return domain in self.allow_domains

    def no_scraping(self) -> bool:
        return bool(self.policy.get("no_scraping", True))
