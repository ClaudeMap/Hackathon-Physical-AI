from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from threading import RLock
from typing import Any


COMPANY_CONTEXT_PATH = Path(__file__).resolve().parents[2] / "data" / "company_context.json"


def _load_seed_context() -> dict[str, Any]:
    with COMPANY_CONTEXT_PATH.open(encoding="utf-8") as file:
        return json.load(file)


DEFAULT_STATE: dict[str, Any] = {
    "messages": [],
    "tasks": [],
    "office_context": _load_seed_context(),
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

