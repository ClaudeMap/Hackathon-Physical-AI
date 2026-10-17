from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from app.domain.models import ActionItem, ActionPlan, OfficeContext


class SolverActionItem(BaseModel):
    """Model-facing action shape; IDs and status are owned by the backend."""

    title: str = Field(min_length=1, max_length=180)
    instructions: str = Field(min_length=1, max_length=1_500)
    estimated_minutes: int | None = Field(default=None, ge=0, le=480)
    needs_supplier: bool = False


class SolverPlan(BaseModel):
    """Strict structured output requested from OpenAI."""

    diagnosis: str = Field(min_length=1, max_length=2_000)
    confidence: float = Field(ge=0, le=1)
    can_staff_fix: bool
    action_items: list[SolverActionItem] = Field(min_length=1, max_length=3)
    supplier_contact_id: str | None = None
    supplier_name: str | None = None
    estimated_callout_cost_gbp: float | None = Field(default=None, ge=0)
    escalation_brief: str | None = Field(default=None, max_length=2_000)
    voice_script: str | None = Field(default=None, max_length=2_000)

    @model_validator(mode="after")
    def escalation_requires_a_supplier(self) -> "SolverPlan":
        if not self.can_staff_fix:
            if not self.supplier_contact_id or not self.escalation_brief:
                raise ValueError("An escalation must include a supplier_contact_id and escalation_brief")
            if not any(item.needs_supplier for item in self.action_items):
                raise ValueError("An escalation must include a supplier action item")
        return self

    def with_verified_supplier_details(self, context: OfficeContext) -> "SolverPlan":
        """Use the database record, not model-generated contact details, for escalations."""
        if self.can_staff_fix:
            return self
        supplier = next(
            (contact for contact in context.escalation_contacts if contact.get("id") == self.supplier_contact_id),
            None,
        )
        if supplier is None:
            raise ValueError(f"Unknown supplier contact id: {self.supplier_contact_id}")

        contact_line = (
            f"Escalate to {supplier['name']} — phone: {supplier.get('phone', 'not recorded')}; "
            f"email: {supplier.get('email', 'not recorded')}; "
            f"call-out cost: £{supplier.get('callout_cost_gbp', 'not recorded')}."
        )
        action_items = [
            item.model_copy(
                update={
                    "instructions": f"{item.instructions}\n\n{contact_line}",
                    "needs_supplier": True,
                }
            )
            if item.needs_supplier
            else item
            for item in self.action_items
        ]
        return self.model_copy(
            update={
                "supplier_name": supplier["name"],
                "estimated_callout_cost_gbp": supplier.get("callout_cost_gbp"),
                "escalation_brief": f"{self.escalation_brief}\n\n{contact_line}",
                "action_items": action_items,
            }
        )

    def to_action_plan(self) -> ActionPlan:
        return ActionPlan(
            diagnosis=self.diagnosis,
            confidence=self.confidence,
            can_staff_fix=self.can_staff_fix,
            action_items=[
                ActionItem(
                    title=item.title,
                    instructions=item.instructions,
                    estimated_minutes=item.estimated_minutes,
                    needs_supplier=item.needs_supplier,
                )
                for item in self.action_items
            ],
            supplier_contact_id=self.supplier_contact_id,
            supplier_name=self.supplier_name,
            estimated_callout_cost_gbp=self.estimated_callout_cost_gbp,
            escalation_brief=self.escalation_brief,
            voice_script=self.voice_script,
        )

