from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from fastapi import HTTPException, status

from app.domain.models import (
    ActionItemPatch,
    ActionItemStatus,
    ActionPlan,
    IncomingMessage,
    OfficeContext,
    Resolution,
    Task,
    TaskClaim,
    TaskPatch,
    TaskProposal,
    TaskStatus,
)
from app.repositories.json_store import JsonStore


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TaskService:
    def __init__(self, store: JsonStore) -> None:
        self.store = store

    def list_tasks(self, include_resolved: bool = False) -> list[Task]:
        tasks = [Task.model_validate(item) for item in self.store.read()["tasks"]]
        if not include_resolved:
            tasks = [task for task in tasks if task.status != TaskStatus.RESOLVED]
        return sorted(tasks, key=lambda task: (int(task.priority), task.created_at))

    def get_task(self, task_id: str) -> Task:
        task = next((task for task in self._tasks() if task.id == task_id), None)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return task

    def record_message(self, message: IncomingMessage) -> IncomingMessage:
        state = self.store.read()
        state["messages"].append(message.model_dump(mode="json"))
        self.store.write(state)
        return message

    def list_messages(self) -> list[IncomingMessage]:
        return [IncomingMessage.model_validate(item) for item in self.store.read()["messages"]]

    def create_from_proposal(self, proposal: TaskProposal) -> Task:
        state = self.store.read()
        tasks = [Task.model_validate(item) for item in state["tasks"]]

        # A duplicate is attached to its existing ticket; a new ticket is not created.
        if proposal.duplicate_of_task_id:
            existing = self._find_in(tasks, proposal.duplicate_of_task_id)
            existing.reporter_ids = _unique([*existing.reporter_ids, *proposal.reporter_ids])
            existing.source_message_ids = _unique([*existing.source_message_ids, *proposal.source_message_ids])
            existing.attachments.extend(proposal.attachments)
            existing.updated_at = _now()
            self._save_tasks(state, tasks)
            return existing

        task = Task(**proposal.model_dump())
        tasks.append(task)
        self._save_tasks(state, tasks)
        return task

    def claim_next(self, claim: TaskClaim) -> Task | None:
        state = self.store.read()
        tasks = [Task.model_validate(item) for item in state["tasks"]]
        queued = sorted(
            (task for task in tasks if task.status == TaskStatus.QUEUED),
            key=lambda task: (int(task.priority), task.created_at),
        )
        if not queued:
            return None
        task = queued[0]
        task.status = TaskStatus.IN_PROGRESS
        task.claimed_by = claim.worker_id
        task.updated_at = _now()
        self._save_tasks(state, tasks)
        return task

    def publish_plan(self, task_id: str, plan: ActionPlan) -> Task:
        state = self.store.read()
        tasks = [Task.model_validate(item) for item in state["tasks"]]
        task = self._find_in(tasks, task_id)
        if task.status not in {TaskStatus.IN_PROGRESS, TaskStatus.QUEUED}:
            raise HTTPException(status_code=409, detail="Only queued or in-progress tasks can receive a plan")
        task.diagnosis = plan.diagnosis
        task.confidence = plan.confidence
        task.can_staff_fix = plan.can_staff_fix
        task.action_items = plan.action_items
        task.supplier_name = plan.supplier_name
        task.estimated_callout_cost_gbp = plan.estimated_callout_cost_gbp
        task.escalation_brief = plan.escalation_brief
        task.voice_script = plan.voice_script
        task.status = TaskStatus.READY if plan.can_staff_fix else TaskStatus.ESCALATED
        task.updated_at = _now()
        self._save_tasks(state, tasks)
        return task

    def update_task(self, task_id: str, patch: TaskPatch) -> Task:
        state = self.store.read()
        tasks = [Task.model_validate(item) for item in state["tasks"]]
        task = self._find_in(tasks, task_id)
        for field, value in patch.model_dump(exclude_unset=True).items():
            setattr(task, field, value)
        task.updated_at = _now()
        self._save_tasks(state, tasks)
        return task

    def update_action_item(self, task_id: str, action_item_id: str, patch: ActionItemPatch) -> Task:
        state = self.store.read()
        tasks = [Task.model_validate(item) for item in state["tasks"]]
        task = self._find_in(tasks, task_id)
        item = next((item for item in task.action_items if item.id == action_item_id), None)
        if item is None:
            raise HTTPException(status_code=404, detail="Action item not found")
        item.status = patch.status
        item.completed_at = _now() if patch.status == ActionItemStatus.COMPLETE else None
        task.updated_at = _now()
        self._save_tasks(state, tasks)
        return task

    def resolve_task(self, task_id: str, resolution: Resolution) -> Task:
        state = self.store.read()
        tasks = [Task.model_validate(item) for item in state["tasks"]]
        task = self._find_in(tasks, task_id)
        task.status = TaskStatus.RESOLVED
        task.resolved_at = _now()
        task.updated_at = _now()
        context = OfficeContext.model_validate(state["office_context"])
        context.history.append(
            {
                "task_id": task.id,
                "title": task.title,
                "problem_type": task.problem_type,
                "outcome_note": resolution.outcome_note,
                "resolved_by": resolution.resolved_by,
                "resolved_at": task.resolved_at,
            }
        )
        context.memory.append(
            {
                "task_id": task.id,
                "lesson": resolution.outcome_note,
                "problem_type": task.problem_type,
                "created_at": task.resolved_at,
            }
        )
        state["office_context"] = context.model_dump(mode="json")
        self._save_tasks(state, tasks)
        return task

    def get_context(self) -> OfficeContext:
        return OfficeContext.model_validate(self.store.read()["office_context"])

    def _tasks(self) -> list[Task]:
        return [Task.model_validate(item) for item in self.store.read()["tasks"]]

    @staticmethod
    def _find_in(tasks: Iterable[Task], task_id: str) -> Task:
        task = next((candidate for candidate in tasks if candidate.id == task_id), None)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return task

    def _save_tasks(self, state: dict, tasks: list[Task]) -> None:
        state["tasks"] = [task.model_dump(mode="json") for task in tasks]
        self.store.write(state)


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))

