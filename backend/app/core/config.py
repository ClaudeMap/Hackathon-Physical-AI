from __future__ import annotations

import os
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
DEFAULT_STATE_PATH = DATA_DIR / "state.json"
DEMO_MESSAGES_PATH = BACKEND_ROOT.parent / "data" / "messages.json"
# Real Slack/email messages; git-ignored so they never leave the machine.
LOCAL_MESSAGES_PATH = DEMO_MESSAGES_PATH.with_name("messages.local.json")


def messages_path() -> Path:
    """Messages for the prioritiser: env override, else local real messages, else the demo fixture."""
    if override := os.getenv("STEWARD_MESSAGES_PATH"):
        return Path(override)
    return LOCAL_MESSAGES_PATH if LOCAL_MESSAGES_PATH.exists() else DEMO_MESSAGES_PATH


def state_path() -> Path:
    """Return the configured demo-state file, creating its parent if needed."""
    path = Path(os.getenv("STEWARD_STATE_PATH", DEFAULT_STATE_PATH))
    path.parent.mkdir(parents=True, exist_ok=True)
    return path

