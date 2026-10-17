from __future__ import annotations

import os
from dataclasses import dataclass
from socket import gethostname


@dataclass(frozen=True)
class SolverSettings:
    api_base_url: str
    poll_seconds: float
    worker_id: str
    model: str
    max_tasks_per_poll: int

    @classmethod
    def from_environment(cls) -> "SolverSettings":
        poll_seconds = float(os.getenv("SOLVER_POLL_SECONDS", "8"))
        if poll_seconds <= 0:
            raise ValueError("SOLVER_POLL_SECONDS must be greater than zero")
        max_tasks_per_poll = int(os.getenv("SOLVER_MAX_TASKS_PER_POLL", "5"))
        if max_tasks_per_poll <= 0:
            raise ValueError("SOLVER_MAX_TASKS_PER_POLL must be greater than zero")
        return cls(
            api_base_url=os.getenv("STEWARD_API_URL", "http://127.0.0.1:8000/api/v1").rstrip("/"),
            poll_seconds=poll_seconds,
            worker_id=os.getenv("SOLVER_WORKER_ID", f"solver-{gethostname()}"),
            model=os.getenv("SOLVER_MODEL", "gpt-6-astra"),
            max_tasks_per_poll=max_tasks_per_poll,
        )

