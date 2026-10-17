from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.core.config import messages_path, state_path
from app.domain.models import (
    ActionItemPatch,
    ActionPlan,
    ClaimRelease,
    IncomingMessage,
    OfficeContext,
    Resolution,
    Task,
    TaskClaim,
    TaskPatch,
    TaskProposal,
)
from app.repositories.json_store import JsonStore
from app.services.prioritiser import build_queue, load_messages
from app.services.task_service import TaskService


router = APIRouter(prefix="/api/v1", tags=["steward"])
_store = JsonStore(state_path())


def get_service() -> TaskService:
    return TaskService(_store)


@router.get("/tasks", response_model=list[Task])
def list_tasks(include_resolved: bool = False, service: TaskService = Depends(get_service)) -> list[Task]:
    """Frontend task-list endpoint, ordered by priority then creation time."""
    return service.list_tasks(include_resolved)


@router.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str, service: TaskService = Depends(get_service)) -> Task:
    return service.get_task(task_id)


@router.patch("/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, patch: TaskPatch, service: TaskService = Depends(get_service)) -> Task:
    return service.update_task(task_id, patch)


@router.post("/tasks/{task_id}/resolve", response_model=Task)
def resolve_task(task_id: str, resolution: Resolution, service: TaskService = Depends(get_service)) -> Task:
    """Closes the ticket and writes the outcome into context history and memory."""
    return service.resolve_task(task_id, resolution)


@router.patch("/tasks/{task_id}/action-items/{action_item_id}", response_model=Task)
def update_action_item(
    task_id: str,
    action_item_id: str,
    patch: ActionItemPatch,
    service: TaskService = Depends(get_service),
) -> Task:
    return service.update_action_item(task_id, action_item_id, patch)


@router.post("/intake/messages", response_model=IncomingMessage, status_code=status.HTTP_201_CREATED)
def record_message(message: IncomingMessage, service: TaskService = Depends(get_service)) -> IncomingMessage:
    """Raw Slack/email/web intake. Jev reads or is sent these records."""
    return service.record_message(message)


@router.get("/intake/messages", response_model=list[IncomingMessage])
def list_messages(service: TaskService = Depends(get_service)) -> list[IncomingMessage]:
    return service.list_messages()


@router.post("/queue/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
def publish_prioritised_task(proposal: TaskProposal, service: TaskService = Depends(get_service)) -> Task:
    """Jev publishes a classified task here; duplicate reports merge automatically."""
    return service.create_from_proposal(proposal)


@router.post("/queue/claim-next", response_model=Task | None)
def claim_next_task(claim: TaskClaim, service: TaskService = Depends(get_service)) -> Task | None:
    """Solver claims the most urgent task with no active action items."""
    return service.claim_next(claim)


@router.get("/queue/solver-candidates", response_model=list[Task])
def list_solver_candidates(service: TaskService = Depends(get_service)) -> list[Task]:
    """Pollable Solver queue: queued/ready tasks whose action list has no pending item."""
    return service.list_solver_candidates()


@router.post("/tasks/{task_id}/release-claim", response_model=Task)
def release_solver_claim(
    task_id: str,
    release: ClaimRelease,
    service: TaskService = Depends(get_service),
) -> Task:
    """Return a task to its eligible state if a worker fails before publishing a plan."""
    return service.release_claim(task_id, release)


@router.post("/tasks/{task_id}/action-plan", response_model=Task)
def publish_action_plan(task_id: str, plan: ActionPlan, service: TaskService = Depends(get_service)) -> Task:
    """Solver publishes diagnosis, action items and escalation information."""
    return service.publish_plan(task_id, plan)


@router.get("/context", response_model=OfficeContext)
def get_context(service: TaskService = Depends(get_service)) -> OfficeContext:
    return service.get_context()


@router.post("/dev/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_demo_state() -> Response:
    """Development-only helper; remove or protect before deployment."""
    _store.reset()
    return Response(status_code=status.HTTP_204_NO_CONTENT)



@router.post("/dev/seed-queue", response_model=list[Task])
def seed_queue_from_messages(service: TaskService = Depends(get_service)) -> list[Task]:
    """Development-only: run the demo prioritiser over the intake messages. Re-running skips seen messages."""
    return build_queue(service, load_messages(messages_path()))
