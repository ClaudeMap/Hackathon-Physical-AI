# Steward

Hackathon prototype for an AI office manager that turns unstructured office reports into diagnosed, prioritised tickets and actionable fixes.

## Team boundaries

| Area | Owns | Uses / produces |
| --- | --- | --- |
| Frontend | Task list, task detail/action-item view, task/action completion | `GET /tasks`, `PATCH /tasks/{id}`, `PATCH /tasks/{id}/action-items/{item_id}`, `POST /tasks/{id}/resolve` |
| Jev prioritisation | Reads raw Slack/email records, detects duplicates, sets severity/priority | Reads `GET /intake/messages`; writes `POST /queue/tasks` with `TaskProposal` |
| Solver | Claims queued tasks, reads company context, creates the action plan/escalation | `POST /queue/claim-next`, `GET /context`, `POST /tasks/{id}/action-plan` |
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
  data/company_context.json    # version-controlled mock company database
  data/inbox.example.json      # sample raw Slack/email inputs
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

`data/messages.json` is the canonical, five-message intake fixture. Every message has one local JPEG in `data/images/`; `backend/data/inbox.example.json` is an exact contract copy for the backend workstream. Image paths are relative to `data/messages.json`, and their Commons licences are recorded in [data/images/ATTRIBUTION.md](data/images/ATTRIBUTION.md).

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

## What each model must return

Jev posts a `TaskProposal` containing a title, description, `priority`, `severity`, optional location/problem type, reporter/message IDs, confidence and an optional duplicate ticket ID.

Solver posts an `ActionPlan` containing a diagnosis, confidence, staff-vs-supplier decision, one or more action items, and optional supplier, cost, escalation brief and voice script. The action plan becomes the exact data the frontend renders.
