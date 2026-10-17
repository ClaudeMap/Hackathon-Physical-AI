from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from threading import RLock
from typing import Any


DEFAULT_STATE: dict[str, Any] = {
    "messages": [],
    "tasks": [],
    "office_context": {
        "office_description": {
            "name": "Steward Demo Office",
            "rooms": ["Kitchen", "Main floor", "Meeting Room 1"],
        },
        "employees": [],
        "escalation_contacts": [
            {"name": "BrightSpark Electricians", "speciality": "electrical", "callout_cost_gbp": 120},
            {"name": "Northstar Managed IT", "speciality": "network", "callout_cost_gbp": 95},
        ],
        "inventory": [],
        "memory": [],
        "history": [],
    },
}


class JsonStore:
    """Small atomic JSON store for demo use; replace this adapter with Postgres later."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = RLock()

    def read(self) -> dict[str, Any]:
        with self._lock:
            if not self.path.exists():
                self._write(DEFAULT_STATE)
            with self.path.open(encoding="utf-8") as file:
                return json.load(file)

    def write(self, value: dict[str, Any]) -> None:
        with self._lock:
            self._write(value)

    def reset(self) -> None:
        self.write(deepcopy(DEFAULT_STATE))

    def _write(self, value: dict[str, Any]) -> None:
        temporary = self.path.with_suffix(".tmp")
        with temporary.open("w", encoding="utf-8") as file:
            json.dump(value, file, indent=2, default=str)
        temporary.replace(self.path)

