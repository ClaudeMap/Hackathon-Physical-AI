import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MESSAGES_PATH = REPOSITORY_ROOT / "data" / "messages.json"


def test_demo_messages_have_matching_local_jpegs() -> None:
    with MESSAGES_PATH.open(encoding="utf-8") as file:
        messages = json.load(file)

    assert 4 <= len(messages) <= 5
    for message in messages.values():
        photo_path = MESSAGES_PATH.parent / message["photo_link"]
        assert photo_path.is_file()
        assert photo_path.suffix.lower() == ".jpg"
        assert "source_url" not in message
