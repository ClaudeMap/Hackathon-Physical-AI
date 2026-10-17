from __future__ import annotations

import os
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
DEFAULT_STATE_PATH = DATA_DIR / "state.json"


def state_path() -> Path:
    """Return the configured demo-state file, creating its parent if needed."""
    path = Path(os.getenv("STEWARD_STATE_PATH", DEFAULT_STATE_PATH))
    path.parent.mkdir(parents=True, exist_ok=True)
    return path

