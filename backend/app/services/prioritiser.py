"""Deterministic demo stand-in for Jev: raw Slack/email messages in, prioritised TaskProposals out.

Swap `prioritise` for a model call later; `build_queue` and the queue contract stay the same.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from app.domain.models import IncomingMessage, MediaAttachment, Priority, Severity, Task, TaskProposal
from app.services.task_service import TaskService


@dataclass(frozen=True)
class Rule:
    key: str
    pattern: str
    title: str
    priority: Priority
    problem_type: str | None = None
    # Incidents several people report become one ticket; requests stay separate.
    merge_reports: bool = False
    actionable: bool = True


# Ordered: the first matching rule wins, so specific rules sit above broad ones.
RULES: list[Rule] = [
    Rule("thanks", r"\bthanks for fixing\b|\bworks perfectly\b", "Thank-you note", Priority.LOW, actionable=False),
    Rule("announcement", r"\bstarts in \d+ mins?\b|\bpizza is here\b", "Announcement", Priority.LOW, actionable=False),
    Rule("invoice", r"\binvoice\b", "Check supplier invoice", Priority.LOW, "finance"),
    Rule("water_leak", r"\bleak(?:s|ing)?\b", "Water leak", Priority.CRITICAL, "plumbing", merge_reports=True),
    Rule("network", r"wi-?fi|internet|officenet|router", "Wi-Fi / internet outage", Priority.HIGH, "network", merge_reports=True),
    Rule(
        "kitchen_power",
        r"kitchen.*\b(?:power|sockets?|fuse)\b|\b(?:power|sockets?|fuse)\b.*kitchen|fuse.?board",
        "Kitchen power out, likely tripped breaker",
        Priority.HIGH,
        "electrical",
        merge_reports=True,
    ),
    Rule("ceiling", r"ceiling|water.?stain", "Possible water ingress: stained ceiling tile", Priority.HIGH, "building", merge_reports=True),
    Rule("lighting", r"flicker", "Faulty lighting", Priority.HIGH, "electrical", merge_reports=True),
    Rule("coffee_machine", r"coffee machine", "Coffee machine out of action", Priority.NORMAL, "appliance", merge_reports=True),
    Rule("dishwasher", r"dishwasher", "Dishwasher fault", Priority.NORMAL, "appliance"),
    Rule("fridge", r"fridge", "Fridge fault", Priority.NORMAL, "appliance"),
    Rule("printer", r"printer|paper jam|toner", "Printer fault", Priority.NORMAL, "printer"),
    Rule("booking_panel", r"booking (?:panel|screen)", "Room booking panel fault", Priority.NORMAL, "av"),
    Rule("hvac", r"air ?con|thermostat|heating", "Temperature complaint", Priority.NORMAL, "hvac"),
    Rule("onboarding", r"new starter|access card", "New starter setup", Priority.NORMAL, "onboarding"),
    Rule("equipment", r"monitors?\b", "Equipment installation", Priority.NORMAL, "equipment"),
    Rule("furniture", r"chair|gas lift", "Furniture repair", Priority.NORMAL, "furniture"),
    Rule("av_kit", r"hdmi|adapter", "AV kit request", Priority.NORMAL, "av"),
    Rule("catering", r"just eat|catering|lunch order", "Catering order", Priority.NORMAL, "catering"),
    Rule("waste", r"recycling|\bbins?\b|waste", "Waste collection", Priority.NORMAL, "waste"),
    Rule("supplies", r"\bout of\b|running low", "Restock supplies", Priority.LOW, "supplies"),
    Rule("plants", r"\bplants?\b|leaves", "Plant care", Priority.LOW, "plants"),
]
FALLBACK = Rule("unclassified", r"", "Unclassified report", Priority.NORMAL)

URGENCY = re.compile(r"asap|urgent|🚨|client call|in \d+ mins?\b|\bat \d{1,2}(?::\d\d)?\s?(?:am|pm)\b", re.I)

_ORDINALS = {"1": "1st", "2": "2nd", "3": "3rd"}
LOCATIONS: list[tuple[str, Callable[[re.Match[str]], str]]] = [
    (r"meeting room ((?-i:[A-Z])\w+)", lambda m: f"Meeting room {m[1]}"),
    (r"(\d(?:st|nd|rd|th) floor)(?: (kitchen|men's toilets))?", lambda m: " ".join(filter(None, [m[1], m[2]]))),
    (r"\b(\d)F\b", lambda m: f"{_ORDINALS.get(m[1], m[1] + 'th')} floor"),
    (r"\b(desks? [A-Z]\d+(?:-[A-Z]\d+)?)", lambda m: m[1][0].upper() + m[1][1:]),
    (r"\b((?:north|south|east|west) )?stairwell\b", lambda m: m[0].capitalize()),
    (
        r"\b(reception|kitchen|bike storage|back entrance|engineering area|sales pod|design team)\b",
        lambda m: m[1].capitalize(),
    ),
]


def load_messages(path: Path) -> list[IncomingMessage]:
    """Read the `{msg_id: {content, source, photo_link, ...}}` dump as intake records.

    Author, location and timestamp are used when the message carries them, otherwise inferred.
    """
    raw = json.loads(path.read_text(encoding="utf-8"))
    messages = []
    for message_id, item in raw.items():
        attachments = []
        if item.get("photo_link"):
            attachments.append(MediaAttachment(url=item["photo_link"], caption=item.get("photo_description")))
        extra = {"received_at": item["received_at"]} if item.get("received_at") else {}
        messages.append(
            IncomingMessage(
                id=item.get("id", message_id),
                source=item["source"],
                author=item.get("author") or _author(item),
                content=item["content"],
                location=item.get("location") or _location(item["content"]),
                attachments=attachments,
                metadata={"processed": item.get("processed", False), "asset_hint": item.get("asset_hint")},
                **extra,
            )
        )
    return messages


def classify(message: IncomingMessage) -> Rule:
    # Photo filenames/descriptions stand in for image understanding, e.g. "what does this light mean" + router photo.
    text = " ".join([message.content, *(f"{a.url} {a.caption or ''}" for a in message.attachments)])
    return next((rule for rule in RULES if re.search(rule.pattern, text, re.I | re.S)), FALLBACK)


@dataclass
class _Group:
    rule: Rule
    messages: list[IncomingMessage] = field(default_factory=list)


def prioritise(messages: list[IncomingMessage]) -> list[TaskProposal]:
    """Drop processed/non-actionable messages, merge repeat reports, and rank the rest."""
    groups: list[_Group] = []
    for message in messages:
        if message.metadata.get("processed"):
            continue
        rule = classify(message)
        if not rule.actionable:
            continue
        existing = next((g for g in groups if g.rule.merge_reports and g.rule.key == rule.key), None)
        if existing:
            existing.messages.append(message)
        else:
            groups.append(_Group(rule, [message]))

    proposals = [_propose(group) for group in groups]
    # Stable sort keeps arrival order within a priority level.
    return sorted(proposals, key=lambda proposal: int(proposal.priority))


def build_queue(service: TaskService, messages: list[IncomingMessage]) -> list[Task]:
    """Record unseen messages as intake and publish their proposals to the queue. Safe to re-run."""
    seen = {message.id for message in service.list_messages()}
    new = [message for message in messages if message.id not in seen]
    for message in new:
        service.record_message(message)
    return [service.create_from_proposal(proposal) for proposal in prioritise(new)]


def publish_pending(service: TaskService) -> list[Task]:
    """Queue intake messages that are not yet attached to a task. Safe to re-run.

    A message may name an existing task via metadata.duplicate_of_task_id. That report
    is merged onto the open ticket instead of opening another one.
    """
    linked = {message_id for task in service.list_tasks(include_resolved=True) for message_id in task.source_message_ids}
    pending = [message for message in service.list_messages() if message.id not in linked and not message.metadata.get("processed")]
    duplicates = [message for message in pending if message.metadata.get("duplicate_of_task_id")]
    fresh = [message for message in pending if message not in duplicates]
    published = [service.create_from_proposal(_duplicate_proposal(message)) for message in duplicates]
    published.extend(service.create_from_proposal(proposal) for proposal in prioritise(fresh))
    return published


def _duplicate_proposal(message: IncomingMessage) -> TaskProposal:
    rule = classify(message)
    title = message.content.strip().splitlines()[0][:140]
    if len(title) < 3:
        title = rule.title
    return TaskProposal(
        title=title,
        description=message.content.strip() or title,
        priority=rule.priority,
        severity=Severity[rule.priority.name],
        problem_type=rule.problem_type,
        location=message.location,
        reporter_ids=[message.author] if message.author else [],
        source_message_ids=[message.id],
        attachments=list(message.attachments),
        duplicate_of_task_id=str(message.metadata["duplicate_of_task_id"]),
        confidence=0.8,
        model_reasoning="report names an open task, so it is merged",
    )


def _propose(group: _Group) -> TaskProposal:
    rule, messages = group.rule, group.messages
    priority, reasons = rule.priority, [f"rule '{rule.key}' sets {rule.priority.name.lower()}"]
    if len(messages) > 1:
        priority, reasons = _raise(priority), [*reasons, f"+1 for {len(messages)} separate reports"]
    if any(URGENCY.search(m.content) for m in messages):
        priority, reasons = _raise(priority), [*reasons, "+1 for urgency/deadline wording"]

    locations = list(dict.fromkeys(m.location for m in messages if m.location))
    # "3rd floor" adds nothing next to "3rd floor kitchen".
    locations = [loc for loc in locations if not any(other != loc and other.startswith(loc) for other in locations)]
    subject = _subject(messages[0].content)
    title = subject if subject and len(messages) == 1 else rule.title
    if title == rule.title and len(locations) == 1 and locations[0].lower() not in title.lower():
        title = f"{rule.title} ({locations[0]})"
    if rule is FALLBACK:
        title = (subject or messages[0].content)[:80]

    return TaskProposal(
        title=title,
        description="\n\n".join(_body(m.content) for m in messages)
        if len(messages) == 1
        else "\n\n".join(f"[{m.id}] {_body(m.content)}" for m in messages),
        priority=priority,
        severity=Severity[priority.name],
        problem_type=rule.problem_type,
        location=", ".join(locations) or None,
        reporter_ids=list(dict.fromkeys(m.author for m in messages)),
        source_message_ids=[m.id for m in messages],
        attachments=[a for m in messages for a in m.attachments],
        confidence=0.3 if rule is FALLBACK else 0.8,
        model_reasoning="; ".join(reasons),
    )


def _raise(priority: Priority) -> Priority:
    return Priority(max(int(priority) - 1, int(Priority.CRITICAL)))


def _subject(content: str) -> str | None:
    match = re.match(r"Subject: (.+)", content)
    return match[1].strip() if match else None


def _body(content: str) -> str:
    return re.sub(r"^Subject: .+\n+", "", content).strip()


def _author(item: dict) -> str:
    # Emails are signed off with the sender's name; the Slack dump carries no user.
    if item["source"] == "email":
        return item["content"].strip().splitlines()[-1].strip()
    return "unknown slack user"


def _location(content: str) -> str | None:
    for pattern, render in LOCATIONS:
        match = re.search(pattern, content, re.I)
        if match:
            return render(match)
    return None


if __name__ == "__main__":
    from app.core.config import messages_path, state_path
    from app.repositories.json_store import JsonStore

    queued = build_queue(TaskService(JsonStore(state_path())), load_messages(messages_path()))
    for task in queued:
        print(f"P{int(task.priority)} {task.severity.value:<8} {task.title}  {task.source_message_ids}")
