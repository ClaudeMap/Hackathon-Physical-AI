# Steward

**The AI office manager that sees, fixes and escalates.**

Someone snaps a photo of what's broken and posts it in Slack or by email. Steward matches it to the office's own equipment, decides whether staff can fix it or a supplier must be called, gives the steps in a voice that suits the severity, and writes the outcome back to the company's memory so the next decision is better.

> Steward turns "someone take a look at this" into a diagnosed, ticketed, costed and remembered fix.

Built for the Physical AI Hackathon, 17 October 2026.

## The problem

Office managers spend their day routing small problems: a tripped fuse, a jammed coffee grinder, Wi-Fi down in the meeting rooms. Each one is low value but urgent to whoever is affected, so people interrupt the office manager, who then works out what is wrong, finds the right supplier and tries to remember what happened last time. That knowledge lives in one person's head.

Ticketing tools assume a clean, structured request and an IT team. General-purpose assistants start from scratch every time and don't know the office's equipment, suppliers or history. Steward does.

## How it works

```text
 Slack / email report (photo + text)
              │
              ▼
  POST /intake/messages ───────────────► raw intake, kept apart from company knowledge
              │
              ▼
  Jev (prioritiser) ── dedupes, sets severity/priority ──► POST /queue/tasks
              │
              ▼
  Solver worker ── claims the most urgent task, reads company context,
              │    decides "staff can fix" vs "call a supplier"
              │    ──► POST /tasks/{id}/action-plan
              ▼
  Steward desk (web app) ── shows diagnosis + 1–3 action items,
              │             staff tick them off with notes/photos
              ▼
  POST /tasks/{id}/resolve ──► outcome written to history + memory
```

- **Duplicate reports merge.** Three people reporting the same fuse become one ticket with three reporters.
- **Priority is an integer**, `1` (critical) to `4` (low), so sorting is unambiguous.
- **Escalation is grounded.** If there's no safe staff fix, the Solver must pick a supplier from the company's directory and include their contact details and call-out cost.
- **The queue is model-agnostic.** Jev and the Solver can be a prompt, a deterministic ruleset or a real model; the frontend contract doesn't change.

Photos taken on the handheld Steward Bot are sent through Slack or email, so those are the only two intake sources.

## Repository layout

```text
backend/                        FastAPI service: the shared task API
  app/api/router.py             HTTP contract for every workstream
  app/domain/models.py          shared Pydantic schemas (Task, TaskProposal, ActionPlan, …)
  app/services/task_service.py  task lifecycle and write-back rules
  app/services/prioritiser.py   deterministic stand-in for Jev
  app/services/demo_plans.py    demo action plans drafted from the inventory
  app/repositories/json_store.py  replaceable JSON persistence
  app/solver/                   polling Solver worker (OpenAI)
  data/company_context.json     mock company database (source-controlled)
  tests/                        API, prioritiser, fixture and prompt tests
data/
  messages.json                 five-message Slack/email demo intake fixture
  images/                       one JPEG per demo message (see ATTRIBUTION.md)
steward-v2/                     Next.js 16 frontend: the Steward desk
  src/components/               Tasks, Agent, Insights, Office (3D map), Connectors
  src/components/device/        interactive 3D Steward Bot concept, with STL export
  src/lib/api.ts, adapt.ts      backend client and Task → Ticket translation
  src/lib/data.ts               offline mock data (used when the API is down)
  docs/                         PRD and brand guidelines (Markdown + PDF)
```

## Quick start

You need Python 3.11+ and Node.js 20+.

```powershell
git clone https://github.com/ClaudeMap/Hackathon-Physical-AI.git
cd Hackathon-Physical-AI
```

### 1. Backend API

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1      # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The interactive API docs are at <http://127.0.0.1:8000/docs>. Demo state is written to `backend/data/state.json` (git-ignored). Reset it with `POST /api/v1/dev/reset`, which reloads the checked-in company context.

### 2. Frontend

```powershell
cd steward-v2
npm install
npm run dev
```

Open <http://localhost:3000>. The desk polls the API every four seconds. On first load it seeds the queue from `data/messages.json` and drafts plans for any task without steps. If the API isn't running, it falls back to offline mock data, so the UI always demos. Point it at another API with `NEXT_PUBLIC_STEWARD_API`.

### 3. Solver worker (optional, needs an OpenAI key)

With the API running, from `backend/`:

```powershell
$env:OPENAI_API_KEY = "..."
python -m app.solver           # polls every 8 s
python -m app.solver --once    # process eligible tasks, then exit
```

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required for the Solver. Keep it in your environment, never in Git. |
| `STEWARD_API_URL` | API base, default `http://127.0.0.1:8000/api/v1` |
| `SOLVER_MODEL` | Model used for diagnosis |
| `SOLVER_POLL_SECONDS` | Poll interval, default `8` |
| `SOLVER_MAX_TASKS_PER_POLL` | Tasks per poll, default `5` |
| `SOLVER_WORKER_ID` | Name used when claiming tasks |
| `STEWARD_STATE_PATH` | Where the API writes demo state |
| `STEWARD_MESSAGES_PATH` | Override the intake file the prioritiser reads |

A task is eligible when it is `queued` or `ready` with no pending action items. The worker claims it atomically, sends the task, completed notes and photos, company context and supplier directory to the model, then appends one to three pending actions. A model or API failure releases the claim for a later retry.

### Run the tests

```powershell
cd backend
pytest
```

## API at a glance

All routes are under `/api/v1`.

| Who | Endpoint | What it does |
| --- | --- | --- |
| Intake | `POST /intake/messages`, `GET /intake/messages` | Record and list raw Slack/email reports |
| Jev | `POST /queue/tasks` | Publish a `TaskProposal`; a `duplicate_of_task_id` merges it into an existing ticket |
| Solver | `GET /queue/solver-candidates`, `POST /queue/claim-next` | Find and claim the most urgent eligible task |
| Solver | `GET /context` | The full company context |
| Solver | `POST /tasks/{id}/action-plan`, `POST /tasks/{id}/release-claim` | Publish a plan, or hand the task back |
| Frontend | `GET /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}` | List, read and edit tasks |
| Frontend | `PATCH /tasks/{id}/action-items/{item_id}` | Complete a step, with optional notes and photos |
| Frontend | `POST /tasks/{id}/resolve` | Close the ticket and write the outcome to memory |
| Dev only | `POST /dev/reset`, `/dev/seed-queue`, `/dev/prioritise-intake`, `/dev/draft-plans` | Demo helpers; remove or protect before deploying |

**Jev returns** a `TaskProposal`: title, description, `priority`, `severity`, optional location and problem type, reporter and message IDs, confidence, and an optional duplicate ticket ID.

**The Solver returns** an `ActionPlan`: diagnosis, confidence, the staff-vs-supplier decision, one to three action items, and optionally a supplier, cost, escalation brief and voice script. This is exactly what the frontend renders.

Completing an action can carry outcome evidence:

```json
{
  "status": "complete",
  "completed_by": "aisha.rahman@steward-demo.co.uk",
  "user_context": "Hopper reduced but the grinder error remains.",
  "attachments": [{"url": "images/coffee-machine-after.jpg", "media_type": "image"}]
}
```

## Demo data

**Company context** ([backend/data/company_context.json](backend/data/company_context.json)) is the mock company database every Solver run receives:

- six employees with responsibilities, availability and approval scope
- a navigable Level 7 office: zones, meeting rooms, equipment positions, access and safety rules
- seven inventory items with visual identifiers, service history, safe staff actions and escalation criteria
- five suppliers, office memory, seven closed tickets, matched invoices and reusable playbooks

**Intake** ([data/messages.json](data/messages.json)) holds five Slack/email reports, each with one local photo: a tripped fuse board, a coffee machine, an open dishwasher, the reception printer and a yellowing plant. Paths in `photo_link` are relative to `messages.json`.

To try real messages, put them in `data/messages.local.json`. It is git-ignored, and the prioritiser reads it instead of the fixture when it exists:

```powershell
cd backend
python -m app.services.prioritiser   # prints the queue; re-running only queues new messages
```

## The Steward desk

| View | What it shows |
| --- | --- |
| **Tasks** | Open, escalated and done tickets, urgent first, with photo, duplicate count, diagnosis, fix checklist and who to call. Drag to reorder. **Mark fixed & notify** previews the Slack post to everyone who reported it. |
| **Agent** | A workspace of agents (Steward, Facilities, IT, Lunch) and the jobs they're on, grouped as *Needs you*, *Waiting on others* and *Done*. **New request** plays the pipeline: Slack → vision → inventory match → duplicate check → ticket. |
| **Insights** | "Are we getting better?" metrics: time to fix, staff interruptions, call-out spend. |
| **Office** | A 3D floor map with pins coloured by open issues, plus the inventory. |
| **Connectors** | Invoicing (Xero) matched against tickets with a flagged charge, HR (HiBob), and toggles for Slack, Teams, Just Eat, Calendar, OpenAI, ElevenLabs and the robot. |
| **`/device`** | The **Steward Bot** handheld: a 3D concept with a dual-fisheye camera, push-to-talk and a six-tool spine. Exploded view, rover dock, colourways and **Export STL**. |

### Demo script

1. **Tasks**: open the urgent fuse ticket (three reports merged into one), then **Mark fixed & notify**.
2. **Agent → New request**: "Wifi is down in meeting rooms". Steward detects the duplicate and merges it.
3. **Agent → New request**: "Dishwasher shows E24". There's no duplicate, so a new ticket is created and the fix is spoken.
4. **Office**: rotate the 3D map and click a pin.
5. **Connectors**: dispute the flagged PrintCare invoice.
6. **Insights**: the trend for budget holders.
7. **`/device`**: fan out the tools and open the exploded view.

## What's real and what's mocked

| Piece | Status |
| --- | --- |
| Task API, lifecycle, duplicate merge, write-back to memory | **Real** (FastAPI with JSON storage) |
| Frontend ↔ API (tasks, steps, reports, resolution) | **Real**, with an offline mock fallback |
| Prioritiser (Jev) | Deterministic stand-in. Replace `prioritise()` with the real model; the contract stays the same. |
| Solver | **Real** OpenAI worker. Without a key, `/dev/draft-plans` fills in demo plans from the inventory. |
| Vision in the desk's "New request" flow | Keyword-matched playbook (`src/lib/agent.ts`) |
| Voice | Browser `speechSynthesis` per severity. ElevenLabs is planned. |
| Slack posting, Xero, HiBob, Insights figures | Mocked |
| Steward Bot | Concept 3D model; dimensions are targets, not engineered |

## Team workstreams

| Area | Owns | Talks to |
| --- | --- | --- |
| Frontend | Task list, task detail, step and ticket completion | `GET /tasks`, `PATCH /tasks/{id}`, `PATCH …/action-items/{item_id}`, `POST …/resolve` |
| Jev prioritisation | Reads raw reports, detects duplicates, sets severity and priority | `GET /intake/messages` → `POST /queue/tasks` |
| Solver | Claims eligible tasks, reads context, writes the action plan or escalation | `/queue/solver-candidates`, `/queue/claim-next`, `/context`, `/tasks/{id}/action-plan` |
| Backend | API contract, persistence, lifecycle, demo data | `backend/app` |

## Further reading

- [Product Requirements Document](steward-v2/docs/PRD.md) ([PDF with diagrams](steward-v2/docs/PRD.pdf)): users, eight core scenarios, requirements, AI architecture, roadmap and risks
- [Design brief and brand guidelines](steward-v2/docs/brand-guidelines.md) ([PDF](steward-v2/docs/brand-guidelines.pdf))
- [Frontend README](steward-v2/README.md): where each mock lives and what replaces it
