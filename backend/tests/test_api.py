from fastapi.testclient import TestClient

from app.api.router import _store
from app.main import app


client = TestClient(app)


def setup_function() -> None:
    _store.reset()


def test_frontend_can_read_a_solver_plan_and_complete_it() -> None:
    initial_history_count = len(client.get("/api/v1/context").json()["history"])
    created = client.post(
        "/api/v1/queue/tasks",
        json={
            "title": "Dishwasher shows E24",
            "description": "Kitchen dishwasher displays E24.",
            "priority": 3,
            "severity": "normal",
            "problem_type": "appliance",
            "location": "Kitchen",
        },
    )
    assert created.status_code == 201
    task_id = created.json()["id"]

    claimed = client.post("/api/v1/queue/claim-next", json={"worker_id": "solver-demo"})
    assert claimed.status_code == 200
    assert claimed.json()["id"] == task_id

    plan = client.post(
        f"/api/v1/tasks/{task_id}/action-plan",
        json={
            "diagnosis": "The drain filter is blocked.",
            "confidence": 0.9,
            "can_staff_fix": True,
            "action_items": [{"title": "Clear the drain filter", "estimated_minutes": 5}],
        },
    )
    assert plan.status_code == 200
    action_item_id = plan.json()["action_items"][0]["id"]

    completed = client.patch(
        f"/api/v1/tasks/{task_id}/action-items/{action_item_id}",
        json={"status": "complete"},
    )
    assert completed.status_code == 200
    assert completed.json()["action_items"][0]["status"] == "complete"

    resolved = client.post(
        f"/api/v1/tasks/{task_id}/resolve",
        json={"outcome_note": "Filter cleared; cycle now drains.", "resolved_by": "sam@example.com"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"
    assert len(client.get("/api/v1/context").json()["history"]) == initial_history_count + 1


def test_duplicate_proposal_merges_onto_existing_task() -> None:
    original = client.post(
        "/api/v1/queue/tasks",
        json={
            "title": "Wi-Fi down on main floor",
            "description": "No network by the desks.",
            "priority": 2,
            "severity": "high",
            "reporter_ids": ["alex@example.com"],
        },
    ).json()

    merged = client.post(
        "/api/v1/queue/tasks",
        json={
            "title": "Duplicate Wi-Fi report",
            "description": "Second report.",
            "priority": 2,
            "severity": "high",
            "reporter_ids": ["morgan@example.com"],
            "duplicate_of_task_id": original["id"],
        },
    )
    assert merged.status_code == 201
    assert set(merged.json()["reporter_ids"]) == {"alex@example.com", "morgan@example.com"}
    assert len(client.get("/api/v1/tasks").json()) == 1

