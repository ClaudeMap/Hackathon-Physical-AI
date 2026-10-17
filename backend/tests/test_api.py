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


def test_solver_replans_only_after_all_current_actions_are_completed() -> None:
    task_id = client.post(
        "/api/v1/queue/tasks",
        json={
            "title": "Coffee machine reports a grinder jam",
            "description": "Jura X8 in the kitchen cannot brew.",
            "priority": 3,
            "severity": "normal",
        },
    ).json()["id"]
    assert [task["id"] for task in client.get("/api/v1/queue/solver-candidates").json()] == [task_id]

    client.post("/api/v1/queue/claim-next", json={"worker_id": "solver-test"})
    plan = client.post(
        f"/api/v1/tasks/{task_id}/action-plan",
        json={
            "diagnosis": "The hopper is too full.",
            "confidence": 0.8,
            "can_staff_fix": True,
            "action_items": [{"title": "Reduce the hopper", "instructions": "Leave it two-thirds full."}],
        },
    ).json()
    action_item_id = plan["action_items"][0]["id"]
    assert client.get("/api/v1/queue/solver-candidates").json() == []

    client.patch(
        f"/api/v1/tasks/{task_id}/action-items/{action_item_id}",
        json={
            "status": "complete",
            "user_context": "Hopper reduced; the error is still visible.",
            "completed_by": "aisha.rahman@steward-demo.co.uk",
            "attachments": [{"url": "images/coffee-machine-after.jpg", "caption": "Error remains"}],
        },
    ).raise_for_status()
    candidate = client.get("/api/v1/queue/solver-candidates").json()
    assert candidate[0]["id"] == task_id
    assert candidate[0]["action_items"][0]["user_context"] == "Hopper reduced; the error is still visible."


def test_solver_action_plan_has_a_maximum_of_three_actions() -> None:
    task_id = client.post(
        "/api/v1/queue/tasks",
        json={
            "title": "Printer needs attention",
            "description": "Printer error.",
            "priority": 3,
            "severity": "normal",
        },
    ).json()["id"]
    client.post("/api/v1/queue/claim-next", json={"worker_id": "solver-test"})
    response = client.post(
        f"/api/v1/tasks/{task_id}/action-plan",
        json={
            "diagnosis": "Needs diagnosis.",
            "confidence": 0.5,
            "can_staff_fix": True,
            "action_items": [{"title": f"Action {number}"} for number in range(4)],
        },
    )
    assert response.status_code == 422


def test_web_report_is_queued_and_given_inventory_steps() -> None:
    recorded = client.post(
        "/api/v1/intake/messages",
        json={
            "source": "web",
            "author": "nikolaj.jensen@steward-demo.co.uk",
            "content": "The coffee machine says grinder jammed",
            "location": "Kitchen",
        },
    )
    assert recorded.status_code == 201

    queued = client.post("/api/v1/dev/prioritise-intake")
    assert queued.status_code == 200
    task = queued.json()[0]
    assert task["problem_type"] == "appliance"
    assert task["action_items"] == []

    drafted = client.post("/api/v1/dev/draft-plans")
    assert drafted.status_code == 200
    plan = drafted.json()[0]
    assert plan["id"] == task["id"]
    assert plan["status"] == "ready"
    assert plan["diagnosis"]
    assert 1 <= len(plan["action_items"]) <= 3
    assert plan["action_items"][0]["status"] == "pending"
    assert "hopper" in plan["action_items"][0]["title"].lower() or "bean" in plan["action_items"][0]["title"].lower()

    again = client.post("/api/v1/dev/draft-plans")
    assert again.json() == []


def test_follow_up_report_merges_onto_the_named_task() -> None:
    original = client.post(
        "/api/v1/queue/tasks",
        json={
            "title": "Coffee machine out of action",
            "description": "Grinder jammed.",
            "priority": 3,
            "severity": "normal",
            "reporter_ids": ["aisha.rahman@steward-demo.co.uk"],
        },
    ).json()
    client.post(
        "/api/v1/intake/messages",
        json={
            "source": "web",
            "author": "leo.martin@steward-demo.co.uk",
            "content": "Same coffee machine, still jammed",
            "metadata": {"duplicate_of_task_id": original["id"]},
        },
    ).raise_for_status()

    merged = client.post("/api/v1/dev/prioritise-intake").json()
    assert len(merged) == 1
    assert merged[0]["id"] == original["id"]
    assert "leo.martin@steward-demo.co.uk" in merged[0]["reporter_ids"]
    assert len(client.get("/api/v1/tasks").json()) == 1


def test_intake_photos_are_served() -> None:
    response = client.get("/media/coffee-machine.jpg")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/")

