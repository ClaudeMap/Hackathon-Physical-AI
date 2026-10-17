"""Deterministic stand-in for the Solver, used when a queued task has no plan yet.

The polling OpenAI worker still owns real diagnoses. This only fills empty tasks from
the office inventory so the frontend has steps to check off during a local demo.
"""
from __future__ import annotations

from app.domain.models import ActionItem, ActionPlan, OfficeContext, Task, TaskStatus
from app.services.task_service import TaskService


# Keep this cue list aligned with steward-v2/src/lib/adapt.ts.
ASSET_CUES: list[tuple[str, tuple[str, ...]]] = [
    ("asset-003", ("fuse", "breaker", "socket", "sockets", "consumer unit")),
    ("asset-002", ("dishwasher", "e24")),
    ("asset-001", ("grinder", "coffee", "jura")),
    ("asset-005", ("printer", "toner", "paper jam")),
    ("asset-007", ("plant", "plants", "leaves")),
    ("asset-004", ("wi-fi", "wifi", "internet", "access point")),
    ("asset-006", ("screen", "display", "hdmi")),
]


def match_asset_id(text: str) -> str | None:
    hay = text.lower()
    best_id: str | None = None
    best = 0
    for asset_id, cues in ASSET_CUES:
        score = sum(1 for cue in cues if cue in hay)
        if score > best:
            best_id, best = asset_id, score
    return best_id


def draft_demo_plans(service: TaskService) -> list[Task]:
    """Attach an inventory plan to every queued task that still has no action items."""
    context = service.get_context()
    drafted: list[Task] = []
    for task in service.list_tasks():
        if task.action_items or task.status not in {TaskStatus.QUEUED, TaskStatus.READY}:
            continue
        saved = service.attach_plan_if_empty(task.id, plan_for(task, context))
        if saved is not None:
            drafted.append(saved)
    return drafted


def plan_for(task: Task, context: OfficeContext) -> ActionPlan:
    text = " ".join(part for part in (task.title, task.description, task.location, task.problem_type) if part)
    asset = _asset(context, match_asset_id(text))
    actions = [str(step).strip() for step in (asset or {}).get("safe_staff_actions", []) if str(step).strip()]
    actions = actions[:3] or ["Confirm what is wrong and add a note about what you see."]
    known = [str(note).strip() for note in (asset or {}).get("known_issues", []) if str(note).strip()]
    diagnosis = known[0] if known else _first_line(task.description) or task.title
    items = [ActionItem(title=step[:180], instructions=step) for step in actions]
    spoken = " ".join(step.rstrip(".") + "." for step in actions)
    return ActionPlan(
        diagnosis=diagnosis,
        confidence=0.66 if asset else 0.4,
        can_staff_fix=True,
        action_items=items,
        voice_script=spoken,
        model_reasoning="deterministic demo plan from the office inventory",
    )


def _asset(context: OfficeContext, asset_id: str | None) -> dict | None:
    if not asset_id:
        return None
    return next((item for item in context.inventory if item.get("id") == asset_id), None)


def _first_line(description: str) -> str:
    return description.strip().splitlines()[0].strip() if description.strip() else ""
