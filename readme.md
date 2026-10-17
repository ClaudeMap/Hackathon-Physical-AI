# Steward

Hackathon prototype for an AI office manager that turns unstructured office reports into diagnosed, prioritised tickets and actionable fixes.

## Team boundaries

| Area | Owns | Uses / produces |
| --- | --- | --- |
| Frontend | Task list, task detail/action-item view, task/action completion | `GET /tasks`, `PATCH /tasks/{id}`, `PATCH /tasks/{id}/action-items/{item_id}`, `POST /tasks/{id}/resolve` |
| Jev prioritisation | Reads raw Slack/email records, detects duplicates, sets severity/priority | Reads `GET /intake/messages`; writes `POST /queue/tasks` with `TaskProposal` |
| Solver | Polls eligible tasks, reads company context, creates the next action plan/escalation | `GET /queue/solver-candidates`, `POST /queue/claim-next`, `GET /context`, `POST /tasks/{id}/action-plan` |
| Backend | API contract, persistence, task lifecycle, demo data | `backend/app` |

The shared queue is deliberately model-agnostic: models can be a prompt, a deterministic demo ruleset, or a real OpenAI integration without changing the frontend contract.

## Repository layout

```text
backend/
  app/
    api/router.py              # HTTP contract for the three workstreams
    domain/models.py           # shared Pydantic schemas
    services/task_service.py   # lifecycle and write-back rules
    repositories/json_store.py # replaceable demo persistence adapter
    solver/                    # independently-run polling OpenAI worker
  data/company_context.json    # version-controlled mock company database
  tests/test_api.py            # happy-path API contract tests
```

## Run the backend

Requires Python 3.11+.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the interactive API specification. The local demo state is written to `backend/data/state.json` and is ignored by Git; reset it with `POST /api/v1/dev/reset`. Resetting rehydrates the checked-in [company context seed](backend/data/company_context.json), leaving the source data untouched.

## Company database

`backend/data/company_context.json` is the mock, source-controlled database that every Solver run receives through `GET /api/v1/context`. It contains:

- Six employee records with responsibilities, availability and approval scope.
- A navigable Level 7 office description: zones, meeting rooms, equipment positions, access instructions and safety rules.
- Seven inventory records with visual identifiers, service history, safe staff actions and escalation criteria.
- Five suppliers, context-specific memory, seven closed tickets, matched invoices and reusable operating playbooks.

Keep incoming Slack/email reports in a separate `messages.json` (or submit them to `POST /api/v1/intake/messages`); this prevents raw intake from being mixed with durable company knowledge.

## Demo intake photos

`data/messages.json` is the only source of truth for the five-message intake fixture. Every message has one local JPEG in `data/images/`, and every `photo_link` is relative to `data/messages.json`. The frontend and Jev should read that one file directly.

## Build the prioritised queue

`app/services/prioritiser.py` is a deterministic stand-in for Jev. It skips processed and non-actionable messages, merges repeat reports of the same incident into one ticket, and publishes ranked `TaskProposal`s to the queue. From `backend/`:

```powershell
python -m app.services.prioritiser        # prints the queue
```

or call `POST /api/v1/dev/seed-queue`. Re-running only queues messages it has not seen. It reads `data/messages.local.json` if present, otherwise the `data/messages.json` demo fixture (override with `STEWARD_MESSAGES_PATH`). Put real Slack/email messages only in `data/messages.local.json`, which is git-ignored. To use a real model, replace `prioritise()`; the queue contract does not change.

## Lifecycle

```text
Slack/email/web report → POST /intake/messages
                         ↓
                  Jev → POST /queue/tasks
                         ↓
               Solver → POST /queue/claim-next
                      → GET /context
                      → POST /tasks/{id}/action-plan
                         ↓
               Frontend → checks action items / resolves ticket
                         ↓
               Backend writes resolution to context history + memory
```

Priority uses integer `1` (critical) through `4` (low), so sorting is unambiguous. A `duplicate_of_task_id` supplied by Jev merges reporters, source messages and attachments into the original ticket.

## Solver worker

Start the API first, set `OPENAI_API_KEY` locally, then run the worker from `backend/`:

```powershell
$env:OPENAI_API_KEY = "..."
python -m app.solver
```

Use `python -m app.solver --once` to process currently eligible tickets and exit. The worker polls every eight seconds by default; set `SOLVER_POLL_SECONDS`, `SOLVER_MAX_TASKS_PER_POLL`, `SOLVER_WORKER_ID`, `SOLVER_MODEL`, or `STEWARD_API_URL` to override it.

An eligible task is `queued` or `ready` and has no pending action items. The worker atomically claims it, supplies the task, completed user notes/photos, complete company context and supplier directory to OpenAI, then appends one to three pending actions. If the model cannot recommend a safe staff fix, it must select a supplier from the supplied directory and create an escalation action with that supplier's contact details and call-out cost. A model/API failure releases the claim for a later retry.

The frontend can attach outcome evidence when it completes an action:

```json
{
  "status": "complete",
  "completed_by": "aisha.rahman@steward-demo.co.uk",
  "user_context": "Hopper reduced but the grinder error remains.",
  "attachments": [{"url": "images/coffee-machine-after.jpg", "media_type": "image"}]
}
```

## What each model must return

Jev posts a `TaskProposal` containing a title, description, `priority`, `severity`, optional location/problem type, reporter/message IDs, confidence and an optional duplicate ticket ID.

Solver posts an `ActionPlan` containing a diagnosis, confidence, staff-vs-supplier decision, one to three pending action items, and optional supplier contact ID, supplier, cost, escalation brief and voice script. The action plan becomes the exact data the frontend renders.
