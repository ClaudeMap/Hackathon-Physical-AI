from __future__ import annotations

import logging
import time

from app.solver.api_client import StewardApiClient
from app.solver.config import SolverSettings
from app.solver.openai_gateway import PlanGenerator


logger = logging.getLogger(__name__)


class SolverWorker:
    def __init__(
        self,
        api: StewardApiClient,
        generator: PlanGenerator,
        settings: SolverSettings,
    ) -> None:
        self.api = api
        self.generator = generator
        self.settings = settings

    def process_available_tasks(self) -> int:
        """Claim and plan each currently eligible ticket, up to the configured limit."""
        if not self.api.list_solver_candidates():
            return 0

        processed = 0
        for _ in range(self.settings.max_tasks_per_poll):
            task = self.api.claim_next(self.settings.worker_id)
            if task is None:
                break
            try:
                plan = self.generator.generate(task, self.api.get_context()).to_action_plan()
                self.api.publish_action_plan(task.id, plan)
                processed += 1
                logger.info("Published %d action items for task %s", len(plan.action_items), task.id)
            except Exception as error:
                logger.exception("Solver failed for task %s", task.id)
                self._release_after_failure(task.id, str(error))
        return processed

    def run_forever(self) -> None:
        while True:
            try:
                self.process_available_tasks()
            except Exception:
                logger.exception("Solver poll failed")
            time.sleep(self.settings.poll_seconds)

    def _release_after_failure(self, task_id: str, reason: str) -> None:
        try:
            self.api.release_claim(task_id, self.settings.worker_id, reason[:500])
        except Exception:
            logger.exception("Could not release failed Solver claim for task %s", task_id)

