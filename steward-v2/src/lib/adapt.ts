// Translate the API's Task into the screen's Ticket, and back only at the call site in api.ts.
// Field names are intentionally not unified.

import { API_ORIGIN, type ApiContext, type ApiMessage, type ApiTask } from "./api";
import { KEYWORDS } from "./agent";
import { itemById, registerItems, type Item, type Report, type Severity, type Source, type Ticket } from "./data";

export type ReportedTicket = {
  id: string;
  merged: boolean;
  summary?: string;
  steps?: string[];
  voiceLine?: string;
  severity?: Severity;
  canSelfFix?: boolean;
};

// Same cue order as backend/app/services/demo_plans.py.
const ASSET_CUES: [string, string[]][] = [
  ["asset-003", ["fuse", "breaker", "socket", "sockets", "consumer unit"]],
  ["asset-002", ["dishwasher", "e24"]],
  ["asset-001", ["grinder", "coffee", "jura"]],
  ["asset-005", ["printer", "toner", "paper jam"]],
  ["asset-007", ["plant", "plants", "leaves"]],
  ["asset-004", ["wi-fi", "wifi", "internet", "access point"]],
  ["asset-006", ["screen", "display", "hdmi"]],
];

const actionItemIds = new Map<string, string[]>();

export function actionIdsFor(ticketId: string): string[] {
  return actionItemIds.get(ticketId) ?? [];
}

export type LocalPrefs = {
  manualRank?: number;
  urgent?: boolean;
  pickedUp?: boolean;
  assignee?: string;
};

export function rememberPrefs(prefs: LocalPrefs, patch: Partial<Ticket>): LocalPrefs {
  const next = { ...prefs };
  if ("manualRank" in patch) next.manualRank = patch.manualRank;
  if (patch.urgent !== undefined) next.urgent = patch.urgent;
  if (patch.status === "in_progress") next.pickedUp = true;
  if (patch.status === "done" || patch.status === "escalated") next.pickedUp = false;
  if (patch.assignee) next.assignee = patch.assignee;
  return next;
}

export function applyPrefs(ticket: Ticket, prefs?: LocalPrefs): Ticket {
  if (!prefs) return ticket;
  let status = ticket.status;
  if (prefs.pickedUp && (status === "new" || status === "in_progress")) status = "in_progress";
  return {
    ...ticket,
    status,
    ...(prefs.urgent !== undefined ? { urgent: prefs.urgent } : {}),
    ...(prefs.manualRank !== undefined ? { manualRank: prefs.manualRank } : {}),
    ...(prefs.assignee && status === "escalated" ? { assignee: prefs.assignee } : {}),
  };
}

export function officeNameFrom(context: ApiContext): string {
  return context.office_description.name || "Steward";
}

export function loadInventory(context: ApiContext) {
  const contacts = new Map(context.escalation_contacts.map((contact) => [contact.id, contact]));
  registerItems(context.inventory.filter((asset) => asset.id && asset.name).map((asset) => assetToItem(asset, contacts)));
}

export function taskToTicket(task: ApiTask, context: ApiContext, messages: ApiMessage[]): Ticket {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const linked = task.source_message_ids.map((id) => byId.get(id)).filter((message): message is ApiMessage => !!message);
  const primary = linked[0];
  const assetId = matchAssetId(`${task.title} ${task.description} ${task.location ?? ""}`);
  const item = itemById(assetId ?? "");
  const steps = task.action_items.map((item) => item.instructions?.trim() || item.title);
  const stepsDone = task.action_items.map((item) => item.status === "complete");
  const stepNotes = task.action_items.map((item) => item.user_context ?? "");
  actionItemIds.set(task.id, task.action_items.map((item) => item.id));

  const known = context.inventory.find((asset) => asset.id === assetId)?.known_issues?.[0];
  const reporters = task.reporter_ids.length ? task.reporter_ids : primary ? [primary.author] : [];
  const photoUrl = task.attachments[0]?.url ?? primary?.attachments[0]?.url;

  const ticket: Ticket = {
    id: task.id,
    title: task.title,
    itemId: assetId ?? item.id,
    severity: task.severity,
    status: mapStatus(task),
    source: mapSource(primary?.source),
    reporter: prettyPerson(reporters[0] ?? "Someone"),
    assignee: task.supplier_name || (task.can_staff_fix === false ? item.support.name : "You"),
    minsAgo: minutesAgo(task.created_at),
    diagnosis: task.diagnosis?.trim() || "Steward is still reading this report.",
    steps,
    urgent: Number(task.priority) === 1 || task.severity === "critical",
    photo: photoUrl ? mediaUrl(photoUrl) : undefined,
    duplicates: duplicateReports(task, linked.slice(1), reporters.slice(1)),
    stepsDone: stepsDone.some(Boolean) ? stepsDone : undefined,
    stepNotes: stepNotes.some((note) => note.trim()) ? stepNotes : undefined,
    history: known && known !== (task.diagnosis ?? "").trim() ? { 0: known } : undefined,
    voiceLine: task.voice_script ?? undefined,
    canSelfFix: task.can_staff_fix ?? undefined,
    escalated: task.status === "escalated",
  };
  return ticket;
}

export function findRelatedTicket(tickets: Ticket[], text: string): Ticket | undefined {
  const diagnosisId = Object.entries(KEYWORDS).find(([, words]) => words.some((word) => text.toLowerCase().includes(word)))?.[0];
  const words = diagnosisId ? KEYWORDS[diagnosisId] : [];
  if (!words.length) return undefined;
  return tickets.find((ticket) => {
    if (ticket.status === "done") return false;
    const item = itemById(ticket.itemId);
    const hay = `${ticket.title} ${item.name} ${item.model}`.toLowerCase();
    return words.some((word) => hay.includes(word));
  });
}

function mapStatus(task: ApiTask): Ticket["status"] {
  if (task.status === "resolved") return "done";
  if (task.status === "escalated") return "escalated";
  if (task.status === "in_progress") return "in_progress";
  const started = task.action_items.some((item) => item.status === "complete");
  const open = task.action_items.some((item) => item.status === "pending");
  if (task.status === "ready" && started && open) return "in_progress";
  return "new";
}

function mapSource(source?: ApiMessage["source"]): Source {
  if (source === "slack") return "slack";
  if (source === "handheld") return "voice";
  return "app";
}

function duplicateReports(task: ApiTask, extras: ApiMessage[], extraReporters: string[]): Report[] {
  const fromMessages: Report[] = extras.map((message) => ({
    reporter: prettyPerson(message.author),
    minsAgo: minutesAgo(message.received_at || task.created_at),
    source: mapSource(message.source),
    text: message.content.trim().slice(0, 180),
  }));
  const seen = new Set(fromMessages.map((report) => report.reporter));
  for (const reporter of extraReporters) {
    const name = prettyPerson(reporter);
    if (seen.has(name)) continue;
    fromMessages.push({ reporter: name, minsAgo: minutesAgo(task.created_at), source: "app", text: "Also reported this." });
  }
  return fromMessages;
}

function matchAssetId(text: string): string | undefined {
  const hay = text.toLowerCase();
  let bestId: string | undefined;
  let best = 0;
  for (const [assetId, cues] of ASSET_CUES) {
    const score = cues.filter((cue) => hay.includes(cue)).length;
    if (score > best) {
      bestId = assetId;
      best = score;
    }
  }
  return bestId;
}

function assetToItem(
  asset: ApiContext["inventory"][number],
  contacts: Map<string | undefined, ApiContext["escalation_contacts"][number]>,
): Item {
  const contact = contacts.get(asset.support_contact_id);
  return {
    id: asset.id ?? "unknown",
    name: asset.name ?? "Office item",
    model: [asset.make, asset.model].filter(Boolean).join(" ") || "—",
    category: mapCategory(asset.category),
    location: asset.location ?? "Office",
    installed: asset.installed_on ?? "—",
    support: {
      name: contact?.name ?? "Office manager",
      role: contact?.speciality ?? "Supplier",
      phone: contact?.phone ?? "",
      costPerCallout: contact?.callout_cost_gbp,
    },
    notes: asset.known_issues?.[0],
  };
}

function mapCategory(category?: string): Item["category"] {
  const value = (category ?? "").toLowerCase();
  if (value.includes("electric")) return "electrical";
  if (value.includes("network")) return "network";
  if (value.includes("print")) return "printing";
  if (value.includes("av") || value.includes("display")) return "av";
  if (value.includes("plant")) return "facilities";
  if (value.includes("appliance") || value.includes("kitchen")) return "kitchen";
  return "facilities";
}

function prettyPerson(value: string): string {
  if (!value.includes("@")) return value;
  return value
    .split("@")[0]
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function minutesAgo(iso: string): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / 60000));
}

export function mediaUrl(url: string): string {
  if (/^(https?:|blob:|data:)/.test(url) || url.startsWith("/")) return url;
  const file = url.replace(/^images\//, "");
  return `${API_ORIGIN}/media/${file}`;
}
