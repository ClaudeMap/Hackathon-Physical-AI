from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum, IntEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Source(str, Enum):
    SLACK = "slack"
    EMAIL = "email"
    WEB = "web"
    HANDHELD = "handheld"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class Priority(IntEnum):
    """Smaller value means a more urgent task."""

    CRITICAL = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4


class TaskStatus(str, Enum):
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    READY = "ready"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


class ActionItemStatus(str, Enum):
    PENDING = "pending"
    COMPLETE = "complete"


class MediaAttachment(BaseModel):
    url: str
    media_type: str = "image"
    caption: str | None = None


class IncomingMessage(BaseModel):
    """Raw data passed to Jev before it becomes a task."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    source: Source
    author: str
    content: str
    received_at: datetime = Field(default_factory=utc_now)
    location: str | None = None
    attachments: list[MediaAttachment] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TaskProposal(BaseModel):
    """The only write contract Jev needs to create a task in the queue."""

    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=1)
    priority: Priority
    severity: Severity
    problem_type: str | None = None
    location: str | None = None
    reporter_ids: list[str] = Field(default_factory=list)
    source_message_ids: list[str] = Field(default_factory=list)
    attachments: list[MediaAttachment] = Field(default_factory=list)
    duplicate_of_task_id: str | None = None
    confidence: float = Field(default=0.5, ge=0, le=1)
    model_reasoning: str | None = None


class ActionItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str = Field(min_length=1, max_length=180)
    instructions: str | None = None
    estimated_minutes: int | None = Field(default=None, ge=0)
    status: ActionItemStatus = ActionItemStatus.PENDING
    needs_supplier: bool = False
    user_context: str | None = Field(default=None, max_length=2_000)
    attachments: list[MediaAttachment] = Field(default_factory=list)
    completed_by: str | None = None
    completed_at: datetime | None = None


class ActionPlan(BaseModel):
    """The Solver publishes this after claiming a queued task."""

    diagnosis: str = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)
    can_staff_fix: bool
    action_items: list[ActionItem] = Field(min_length=1, max_length=3)
    supplier_contact_id: str | None = None
    supplier_name: str | None = None
    estimated_callout_cost_gbp: float | None = Field(default=None, ge=0)
    escalation_brief: str | None = None
    voice_script: str | None = None
    model_reasoning: str | None = None

    @model_validator(mode="after")
    def actions_must_be_pending(self) -> "ActionPlan":
        if any(item.status != ActionItemStatus.PENDING for item in self.action_items):
            raise ValueError("Solver action items must be created as pending")
        return self


class Task(BaseModel):
    model_config = ConfigDict(use_enum_values=False)

    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    description: str
    priority: Priority
    severity: Severity
    status: TaskStatus = TaskStatus.QUEUED
    problem_type: str | None = None
    location: str | None = None
    reporter_ids: list[str] = Field(default_factory=list)
    source_message_ids: list[str] = Field(default_factory=list)
    attachments: list[MediaAttachment] = Field(default_factory=list)
    duplicate_of_task_id: str | None = None
    confidence: float = Field(default=0.5, ge=0, le=1)
    model_reasoning: str | None = None
    diagnosis: str | None = None
    can_staff_fix: bool | None = None
    action_items: list[ActionItem] = Field(default_factory=list)
    supplier_contact_id: str | None = None
    supplier_name: str | None = None
    estimated_callout_cost_gbp: float | None = None
    escalation_brief: str | None = None
    voice_script: str | None = None
    claimed_by: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    resolved_at: datetime | None = None


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=140)
    description: str | None = Field(default=None, min_length=1)
    priority: Priority | None = None
    severity: Severity | None = None
    status: TaskStatus | None = None
    location: str | None = None


class ActionItemPatch(BaseModel):
    """Frontend write contract for completing an action and adding outcome evidence."""

    status: ActionItemStatus | None = None
    user_context: str | None = Field(default=None, max_length=2_000)
    attachments: list[MediaAttachment] | None = None
    completed_by: str | None = None


class TaskClaim(BaseModel):
    worker_id: str = Field(min_length=1, max_length=100)


class ClaimRelease(BaseModel):
    worker_id: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=500)


class Resolution(BaseModel):
    outcome_note: str = Field(min_length=1)
    resolved_by: str = Field(min_length=1)


class OfficeContext(BaseModel):
    """Loose enough for the hackathon; add typed records as integrations become real."""

    office_description: dict[str, Any] = Field(default_factory=dict)
    employees: list[dict[str, Any]] = Field(default_factory=list)
    escalation_contacts: list[dict[str, Any]] = Field(default_factory=list)
    inventory: list[dict[str, Any]] = Field(default_factory=list)
    memory: list[dict[str, Any]] = Field(default_factory=list)
    history: list[dict[str, Any]] = Field(default_factory=list)
    invoices: list[dict[str, Any]] = Field(default_factory=list)
    playbooks: list[dict[str, Any]] = Field(default_factory=list)

