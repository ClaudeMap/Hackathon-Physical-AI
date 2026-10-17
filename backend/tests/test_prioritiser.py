import pytest
from fastapi.testclient import TestClient

from app.api.router import _store
from app.core.config import DEMO_MESSAGES_PATH
from app.domain.models import IncomingMessage
from app.main import app
from app.services.prioritiser import load_messages, prioritise


client = TestClient(app)


@pytest.fixture(autouse=True)
def demo_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    # Pin to the committed fixture so a local data/messages.local.json never leaks into tests.
    _store.reset()
    monkeypatch.setenv("STEWARD_MESSAGES_PATH", str(DEMO_MESSAGES_PATH))


def _slack(message_id: str, content: str, processed: bool = False) -> IncomingMessage:
    return IncomingMessage(
        id=message_id, source="slack", author="someone", content=content, metadata={"processed": processed}
    )


def test_demo_messages_become_one_ticket_each_using_their_metadata() -> None:
    proposals = prioritise(load_messages(DEMO_MESSAGES_PATH))
    by_message = {p.source_message_ids[0]: p for p in proposals}

    assert len(proposals) == 5
    assert by_message["msg_003"].problem_type == "electrical"
    assert by_message["msg_001"].reporter_ids == ["aisha.rahman@steward-demo.co.uk"]
    assert by_message["msg_005"].location == "Open-plan desks, zone C near desk C10"


def test_repeat_reports_merge_and_raise_priority() -> None:
    proposals = prioritise(
        [
            _slack("a", "is the wifi down for anyone else?"),
            _slack("b", "+1 wifi is dead in meeting room Orion too"),
            _slack("c", "the printer is jammed again"),
        ]
    )

    assert [p.source_message_ids for p in proposals] == [["a", "b"], ["c"]]
    assert proposals[0].priority == 1


def test_processed_and_non_actionable_messages_are_skipped() -> None:
    proposals = prioritise(
        [
            _slack("done", "the printer is jammed", processed=True),
            _slack("thanks", "thanks for fixing the projector yesterday, works perfectly now"),
        ]
    )

    assert proposals == []


def test_seeded_queue_is_ordered_and_idempotent() -> None:
    seeded = client.post("/api/v1/dev/seed-queue").json()
    priorities = [task["priority"] for task in seeded]

    assert priorities == sorted(priorities)
    assert seeded[0]["problem_type"] == "electrical"
    assert client.post("/api/v1/dev/seed-queue").json() == []
    assert [t["id"] for t in client.get("/api/v1/tasks").json()] == [t["id"] for t in seeded]
