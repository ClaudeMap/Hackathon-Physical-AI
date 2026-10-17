from __future__ import annotations

from typing import Protocol

from app.domain.models import OfficeContext, Task
from app.solver.contracts import SolverPlan
from app.solver.prompt import SYSTEM_INSTRUCTIONS, build_solver_prompt


class PlanGenerator(Protocol):
    def generate(self, task: Task, context: OfficeContext) -> SolverPlan: ...


class OpenAIPlanGenerator:
    """OpenAI Responses API adapter; isolated so tests never require a network call."""

    def __init__(self, model: str) -> None:
        from openai import OpenAI

        self.client = OpenAI()
        self.model = model

    def generate(self, task: Task, context: OfficeContext) -> SolverPlan:
        response = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                {"role": "user", "content": build_solver_prompt(task, context)},
            ],
            text_format=SolverPlan,
        )
        if response.output_parsed is None:
            raise RuntimeError("OpenAI returned no structured Solver plan")
        return response.output_parsed.with_verified_supplier_details(context)

