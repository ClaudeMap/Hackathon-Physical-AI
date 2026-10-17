// Backend names stay here: Task, action items, intake messages.
// The screens keep Ticket, steps and severity. See adapt.ts for the translation.

import type { Severity, Ticket } from "./data";

export const API_ORIGIN = process.env.NEXT_PUBLIC_STEWARD_API ?? "http://127.0.0.1:8000";

export const DESK_USER = "nikolaj.jensen@steward-demo.co.uk";

export type ApiAttachment = { url: string; media_type?: string; caption?: string | null };

export type ApiActionItem = {
  id: string;
  title: string;
  instructions?: string | null;
  status: "pending" | "complete";
  user_context?: string | null;
  completed_by?: string | null;
};

export type ApiTask = {
  id: string;
  title: string;
  description: string;
  priority: number;
  severity: Severity;
  status: "queued" | "in_progress" | "ready" | "resolved" | "escalated";
  problem_type?: string | null;
  location?: string | null;
  reporter_ids: string[];
  source_message_ids: string[];
  attachments: ApiAttachment[];
  diagnosis?: string | null;
  can_staff_fix?: boolean | null;
  action_items: ApiActionItem[];
  supplier_name?: string | null;
  voice_script?: string | null;
  created_at: string;
};

export type ApiMessage = {
  id: string;
  source: "slack" | "email" | "web" | "handheld";
  author: string;
  content: string;
  received_at: string;
  location?: string | null;
  attachments: ApiAttachment[];
};

export type ApiContext = {
  office_description: { name?: string; floors?: unknown[] };
  employees: { id?: string; name?: string; email?: string; role?: string; on_site_today?: boolean }[];
  escalation_contacts: {
    id?: string;
    name?: string;
    speciality?: string;
    phone?: string;
    callout_cost_gbp?: number;
  }[];
  inventory: {
    id?: string;
    name?: string;
    category?: string;
    make?: string;
    model?: string;
    location?: string;
    installed_on?: string;
    support_contact_id?: string;
    known_issues?: string[];
    notes?: string;
  }[];
};

const SEVERITY_PRIORITY: Record<Severity, number> = { critical: 1, high: 2, normal: 3, low: 4 };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const listTasks = (includeResolved = true) =>
  request<ApiTask[]>(`/api/v1/tasks?include_resolved=${includeResolved ? "true" : "false"}`);

export const listMessages = () => request<ApiMessage[]>("/api/v1/intake/messages");

export const getContext = () => request<ApiContext>("/api/v1/context");

export const seedQueue = () => request<ApiTask[]>("/api/v1/dev/seed-queue", { method: "POST" });

export const draftPlans = () => request<ApiTask[]>("/api/v1/dev/draft-plans", { method: "POST" });

export function submitReport(content: string, duplicateOf?: string) {
  return request<ApiMessage>("/api/v1/intake/messages", {
    method: "POST",
    body: JSON.stringify({
      source: "web",
      author: DESK_USER,
      content,
      metadata: duplicateOf ? { duplicate_of_task_id: duplicateOf } : {},
    }),
  }).then(() => request<ApiTask[]>("/api/v1/dev/prioritise-intake", { method: "POST" }));
}

export function patchTask(id: string, body: { severity?: Severity; priority?: number; status?: ApiTask["status"] }) {
  return request<ApiTask>(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function patchAction(
  taskId: string,
  actionId: string,
  body: { status?: "pending" | "complete"; user_context?: string; completed_by?: string },
) {
  return request<ApiTask>(`/api/v1/tasks/${taskId}/action-items/${actionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function resolveTask(id: string, outcomeNote: string) {
  return request<ApiTask>(`/api/v1/tasks/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ outcome_note: outcomeNote, resolved_by: DESK_USER }),
  });
}

export async function saveTicketPatch(current: Ticket, patch: Partial<Ticket>, actionItemIds: string[]): Promise<boolean> {
  let wrote = false;
  if (patch.severity) {
    await patchTask(current.id, { severity: patch.severity, priority: SEVERITY_PRIORITY[patch.severity] });
    wrote = true;
  }
  if (patch.status === "escalated") {
    await patchTask(current.id, { status: "escalated" });
    wrote = true;
  }
  if (patch.status === "done") {
    await resolveTask(current.id, "Marked fixed from the Steward desk.");
    wrote = true;
  }
  if (patch.stepsDone) {
    for (let i = 0; i < actionItemIds.length; i += 1) {
      const next = !!patch.stepsDone[i];
      const prev = !!current.stepsDone?.[i];
      if (next === prev) continue;
      await patchAction(current.id, actionItemIds[i], {
        status: next ? "complete" : "pending",
        ...(next ? { completed_by: DESK_USER } : {}),
      });
      wrote = true;
    }
  }
  if (patch.stepNotes) {
    for (let i = 0; i < actionItemIds.length; i += 1) {
      const next = patch.stepNotes[i];
      if (next === undefined || next === (current.stepNotes?.[i] ?? "")) continue;
      await patchAction(current.id, actionItemIds[i], { user_context: next });
      wrote = true;
    }
  }
  return wrote;
}
