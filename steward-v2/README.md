# Steward

The AI office manager that sees, fixes and escalates. You snap a photo of what's broken. Steward knows what's in your office, tells you how to fix it in a voice that suits the moment, and calls the right person when you can't fix it yourself.

**Status: frontend prototype.** All data is mocked and runs offline. No API keys are needed.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## What's in the prototype

| View | What it shows |
|---|---|
| **Tasks** | Open, escalated and done tasks, with urgent ones first. **Drag the handle on the right to reorder** (or focus it and use ↑/↓). Each has a photo, an **Urgent** tag, a duplicate count, Steward's diagnosis, a fix checklist and who to call. **Mark fixed & notify** posts a "Fixed" message to #office-help on Slack and tags everyone who reported it. |
| **Agent** | An agent workspace, not a chat box. A row of agents (Steward, Facilities, IT, Lunch) sits above a list of the jobs they're working on, grouped as *Needs you*, *Waiting on others* and *Done*. Each job is a thread showing what the agent did on its own (matched the item, checked duplicates, looked up support), its diagnosis and steps, and a composer to give instructions ("call the engineer", "it's fixed"). **New request** takes a photo, video, voice or text and plays the pipeline: Slack → vision → inventory match → **duplicate check** → ticket. If the issue is already open, your report is merged into that ticket instead of opening a new one. |
| **Insights** | "Are we getting better?" KPIs, weekly charts (time to fix, staff interruptions, call-out spend for the COO), a log of what Steward did, and suggestions. |
| **Office** | A **3D floor map** of Transition: drag to rotate, pins coloured by open issues, and Steward Bot on patrol. Below it is the inventory as an expandable list. |
| **Connectors** | **Invoicing** (Xero) matches supplier bills to tickets and flags wrong charges. **HR** (HiBob) shows who's in, new starters and leavers. Slack, Teams, Just Eat, Calendar, OpenAI, ElevenLabs and the robot can be toggled on and off. |

### The device (`/device`)

An interactive 3D concept of the **Steward Bot** handheld: 2.8″ screen, rotating dual-fisheye camera barrel, scroll wheel, push-to-talk key and a Swiss-Army tool spine with six folding tools (bit driver, pry tool, jam grabber, voltage probe, soil probe, brush & pick). Each tool maps to a ticket in the task list. Orbit, click a tool to fan it out, switch colourways (Natural, Graphite, Signal Yellow, Steward Green), open the exploded view, or clip it onto the rover dock. The finish follows the brand guidelines: anodised aluminium body, stainless tools with etched icons, knurled wheel and key, four Torx screws.

The model is parametric (millimetres) in `src/components/device/model.ts`. **Export STL** downloads the current pose for slicing or for import into CAD. Dimensions are concept targets, not engineered figures.

### Demo script

1. **Agent**: open the urgent fuse job. **Tasks** has the same jobs as a list: open the urgent fuse ticket (3 reports, with photo), then click **Mark fixed & notify** to see the Slack post.
2. **Agent → New request**: tap "Wifi is down in meeting rooms" and send. Steward detects a duplicate and merges your report into STW-117.
3. **Agent → New request**: tap "Dishwasher shows E24" and send. With no duplicate, a new ticket is created and the fix is spoken.
4. **Office**: rotate the 3D map and click a pin.
5. **Connectors**: dispute the flagged PrintCare invoice, then look at the HR panel.
6. **Insights**: "fixed 73% faster, staff pulled in 71% less".

Photos are from Unsplash, hotlinked, under the free Unsplash license. For the real demo, swap in photos of your own office in `src/lib/data.ts`.

## Where the mocks are (swap these for the real build)

| File | Prototype | Real build |
|---|---|---|
| `src/lib/agent.ts` | Keyword match → canned playbook | OpenAI vision call with the photo + inventory as context, returning structured JSON |
| `src/lib/voice.ts` | Browser `speechSynthesis`, rate and pitch per severity | ElevenLabs TTS, one voice ID per severity (calm for critical) |
| `src/lib/data.ts` | Static inventory, tickets, invoices, people, floor plan | Inventory DB, ticket store, Xero/HiBob sync, robot-mapped floor plan |
| Duplicate check (`AskView`) | Same item + open ticket = duplicate | Vision embedding + item + time window |
| `SlackNotice` | On-screen preview of the post | `chat.postMessage` in the original Slack thread |
| `AskView` pipeline | Timed animation | Slack Events API → backend → reply in thread |

## Users

- **Office managers**: the main user. Fewer interruptions, more autonomy.
- **COO / budget holders**: Insights, call-out spend, trends.
- **Third-party suppliers**: escalation targets with call-out costs.
- **Regular staff**: report issues and fix simple ones with guidance.
