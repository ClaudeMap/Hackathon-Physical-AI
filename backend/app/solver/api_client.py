from __future__ import annotations

from typing import Any

import httpx

from app.domain.models import ActionPlan, ClaimRelease, OfficeContext, Task, TaskClaim


class StewardApiClient:
    """Typed HTTP boundary between the independently-run Solver and the backend."""

    def __init__(self, base_url: str) -> None:
        self.client = httpx.Client(base_url=base_url, timeout=30.0)

    def close(self) -> None:
        self.client.close()

    def list_solver_candidates(self) -> list[Task]:
        return [Task.model_validate(item) for item in self._request("GET", "/queue/solver-candidates")]

    def claim_next(self, worker_id: str) -> Task | None:
        payload = self._request("POST", "/queue/claim-next", json=TaskClaim(worker_id=worker_id).model_dump(mode="json"))
        return Task.model_validate(payload) if payload is not None else None

    def get_context(self) -> OfficeContext:
        return OfficeContext.model_validate(self._request("GET", "/context"))

    def publish_action_plan(self, task_id: str, plan: ActionPlan) -> Task:
        payload = self._request("POST", f"/tasks/{task_id}/action-plan", json=plan.model_dump(mode="json"))
        return Task.model_validate(payload)

    def release_claim(self, task_id: str, worker_id: str, reason: str) -> Task:
        payload = self._request(
            "POST",
            f"/tasks/{task_id}/release-claim",
            json=ClaimRelease(worker_id=worker_id, reason=reason).model_dump(mode="json"),
        )
        return Task.model_validate(payload)

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.client.request(method, path, **kwargs)
        response.raise_for_status()
        return response.json() if response.status_code != 204 else None

