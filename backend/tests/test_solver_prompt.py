import pytest

from app.domain.models import ActionItem, ActionItemStatus, OfficeContext, Task
from app.solver.contracts import SolverPlan
from app.solver.prompt import SYSTEM_INSTRUCTIONS, build_solver_prompt


def test_solver_prompt_includes_completed_user_evidence_and_supplier_phone() -> None:
    task = Task(
        title="Kitchen sockets have tripped",
        description="Coffee-machine outlet has no power.",
        priority=1,
        severity="critical",
        action_items=[
            ActionItem(
                title="Check for danger",
                status=ActionItemStatus.COMPLETE,
                user_context="No water, smoke or burning smell observed.",
                completed_by="aisha@example.com",
            )
        ],
    )
    context = OfficeContext(
        office_description={"emergency_rule": "Do not work on live electrical equipment."},
        escalation_contacts=[
            {
                "id": "supplier-electrician",
                "name": "BrightSpark",
                "phone": "+44 20 7946 0810",
                "callout_cost_gbp": 120,
            }
        ],
    )

    prompt = build_solver_prompt(task, context)
    assert "No water, smoke or burning smell observed." in prompt
    assert "+44 20 7946 0810" in prompt
    assert "supplier-electrician" in prompt
    assert "Never direct staff to work on live electrical equipment" in SYSTEM_INSTRUCTIONS


def test_solver_output_becomes_pending_backend_actions() -> None:
    output = SolverPlan.model_validate(
        {
            "diagnosis": "The filter may be blocked.",
            "confidence": 0.8,
            "can_staff_fix": True,
            "action_items": [{"title": "Inspect filter", "instructions": "Follow the labelled safe procedure."}],
        }
    )
    plan = output.to_action_plan()
    assert len(plan.action_items) == 1
    assert plan.action_items[0].status == ActionItemStatus.PENDING


def test_escalation_uses_the_company_database_contact_record() -> None:
    context = OfficeContext(
        escalation_contacts=[
            {
                "id": "supplier-electrician",
                "name": "BrightSpark",
                "phone": "+44 20 7946 0810",
                "email": "dispatch@brightspark.example",
                "callout_cost_gbp": 120,
            }
        ]
    )
    output = SolverPlan.model_validate(
        {
            "diagnosis": "The breaker trips repeatedly.",
            "confidence": 0.95,
            "can_staff_fix": False,
            "action_items": [
                {
                    "title": "Escalate electrical fault",
                    "instructions": "Send the diagnosis and safety observations.",
                    "needs_supplier": True,
                }
            ],
            "supplier_contact_id": "supplier-electrician",
            "supplier_name": "Made-up supplier",
            "estimated_callout_cost_gbp": 1,
            "escalation_brief": "Kitchen breaker trips again after one safe reset.",
        }
    ).with_verified_supplier_details(context)

    assert output.supplier_name == "BrightSpark"
    assert output.estimated_callout_cost_gbp == 120
    assert "+44 20 7946 0810" in output.action_items[0].instructions


def test_escalation_with_an_unknown_supplier_is_rejected() -> None:
    output = SolverPlan.model_validate(
        {
            "diagnosis": "Unsafe fault.",
            "confidence": 0.9,
            "can_staff_fix": False,
            "action_items": [{"title": "Escalate", "instructions": "Call a supplier.", "needs_supplier": True}],
            "supplier_contact_id": "not-in-company-db",
            "escalation_brief": "Unsafe condition.",
        }
    )
    with pytest.raises(ValueError, match="Unknown supplier"):
        output.with_verified_supplier_details(OfficeContext())
