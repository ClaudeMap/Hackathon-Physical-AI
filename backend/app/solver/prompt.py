from __future__ import annotations

import json

from app.domain.models import ActionItemStatus, OfficeContext, Task


SYSTEM_INSTRUCTIONS = """You are Steward's office-facilities Solver. Produce a safe, practical next action plan.

Use only the supplied office context, task evidence and completed-action evidence. Do not invent equipment, supplier details, access rights, prices, fault codes or safety facts.

Safety rules:
- Never direct staff to work on live electrical equipment, open electrical panels, bypass a safety feature, make a licensed repair or take a risky action.
- If there is smoke, heat, a burning smell, water near electricity, visible damage, a repeat electrical trip, or material uncertainty, escalate instead of proposing a DIY fix.
- Do not repeat a completed action. Incorporate the user's completion notes and photo captions before proposing what is next.

Action-plan rules:
- Return exactly one to three actions. They are new actions for the frontend, so every one must be currently actionable and not already completed.
- If office staff can safely continue, set can_staff_fix=true and give concise, ordered steps.
- If staff cannot safely solve it, set can_staff_fix=false. Select the appropriate supplier from ESCALATION DIRECTORY using its exact id, name, phone and call-out cost. Include one action to escalate, with the contact details in its instructions and in escalation_brief.
- Never mark the task or any action complete. The frontend records user completion, notes and photos.
- Your response must conform to the supplied JSON schema; do not include prose outside it.
"""


def build_solver_prompt(task: Task, context: OfficeContext) -> str:
    """Create an auditable model prompt from the exact ticket and company data."""
    completed_actions = [
        action.model_dump(mode="json")
        for action in task.action_items
        if action.status == ActionItemStatus.COMPLETE
    ]
    escalation_directory = [
        {
            "id": contact.get("id"),
            "name": contact.get("name"),
            "speciality": contact.get("speciality"),
            "phone": contact.get("phone"),
            "email": contact.get("email"),
            "callout_cost_gbp": contact.get("callout_cost_gbp"),
            "contract_terms": contact.get("contract_terms"),
            "preferred_for": contact.get("preferred_for", []),
        }
        for contact in context.escalation_contacts
    ]

    payload = {
        "task": task.model_dump(mode="json"),
        "completed_action_items_with_user_context": completed_actions,
        "office_context": context.model_dump(mode="json"),
        "escalation_directory": escalation_directory,
    }
    return """Create the next action plan for this ticket. The complete office context and escalation numbers are included below as JSON.

```json
%s
```
""" % json.dumps(payload, ensure_ascii=False, indent=2)

