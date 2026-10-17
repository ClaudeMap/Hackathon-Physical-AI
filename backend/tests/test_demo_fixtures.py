import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MESSAGES_PATH = REPOSITORY_ROOT / "data" / "messages.json"
BACKEND_INBOX_PATH = REPOSITORY_ROOT / "backend" / "data" / "inbox.example.json"


def test_demo_messages_have_matching_local_jpegs() -> None:
    with MESSAGES_PATH.open(encoding="utf-8") as file:
        messages = json.load(file)

    assert 4 <= len(messages) <= 5
    for message in messages.values():
        photo_path = MESSAGES_PATH.parent / message["photo_link"]
        assert photo_path.is_file()
        assert photo_path.suffix.lower() == ".jpg"
        assert message["photo_attribution"]["source_url"].startswith("https://commons.wikimedia.org/")


def test_backend_inbox_is_an_exact_copy_of_canonical_messages() -> None:
    with MESSAGES_PATH.open(encoding="utf-8") as file:
        messages = json.load(file)
    with BACKEND_INBOX_PATH.open(encoding="utf-8") as file:
        inbox = json.load(file)

    assert inbox == messages
