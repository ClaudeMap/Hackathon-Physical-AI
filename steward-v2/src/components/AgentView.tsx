"use client";

import { useEffect, useRef, useState } from "react";
import { type ReportedTicket } from "@/lib/adapt";
import { agentForItem, ago, itemById, type Agent, type Report, type Ticket } from "@/lib/data";
import { AskView } from "./AskView";
import { AgentAvatar, Icon, PageTitle, SeverityBadge, SlackLogo, UrgentPill } from "./ui";

type Pane = "new" | string;
type Msg = { from: "you" | "steward"; text: string };

const SEV_RANK = { critical: 0, high: 1, normal: 2, low: 3 };
const needsYou = (t: Ticket) => t.status === "new" || t.status === "in_progress";

// The one-line preview of what the agent is doing on a job.
function latestLine(t: Ticket) {
  const item = itemById(t.itemId)!;
  if (t.status === "done") return "Fixed. I told #office-help.";
  if (t.status === "escalated") return `Escalated to ${item.support.name}. Waiting for a reply.`;
  if (t.status === "waiting") return t.steps[0];
  if (t.status === "in_progress") return "Walking you through it. Tell me when it's done.";
  return t.diagnosis;
}

export function AgentView({
  tickets,
  nextId,
  onCreate,
  onMerge,
  onUpdate,
  onReport,
}: {
  tickets: Ticket[];
  nextId: string;
  onCreate: (t: Ticket) => void;
  onMerge: (id: string, r: Report) => void;
  onUpdate: (id: string, p: Partial<Ticket>) => void;
  onReport?: (text: string) => Promise<ReportedTicket | null>;
}) {
  const [pane, setPane] = useState<Pane>("new");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chat, setChat] = useState<Record<string, Msg[]>>({});

  const open = (p: Pane) => {
    setPane(p);
    setMobileOpen(true);
  };

  const mine = [...tickets].sort(
    (a, b) => Number(!!b.urgent) - Number(!!a.urgent) || SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.minsAgo - b.minsAgo,
  );
  const sections = [
    { label: "Needs you", items: mine.filter(needsYou) },
    { label: "Waiting on others", items: mine.filter((t) => t.status === "waiting" || t.status === "escalated") },
    { label: "Done", items: mine.filter((t) => t.status === "done") },
  ].filter((s) => s.items.length);

  const ticket = pane === "new" ? null : (tickets.find((t) => t.id === pane) ?? null);

  const say = (id: string, from: Msg["from"], text: string) => setChat((c) => ({ ...c, [id]: [...(c[id] ?? []), { from, text }] }));

  return (
    <div className="grid gap-5 md:grid-cols-[320px_minmax(0,1fr)]">
      {/* Left: agents + jobs */}
      <div className={`min-w-0 ${mobileOpen ? "hidden md:block" : ""}`}>
        <div className="mb-3">
          <PageTitle kicker="Agent" title="Talk it through">
            <button onClick={() => open("new")} className="btn btn-primary btn-sm">
              <Icon name="plus" className="size-4" /> New request
            </button>
          </PageTitle>
        </div>

        {sections.map((s) => (
          <section key={s.label} className="mb-4">
            <h2 className="mb-2 px-1 text-[15px] font-medium text-ink-2">
              {s.label} <span className="text-ink-3/70">{s.items.length}</span>
            </h2>
            <ul className="space-y-2">
              {s.items.map((t) => {
                const active = pane === t.id;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => open(t.id)}
                      className={`flex w-full items-center gap-3 rounded-3xl bg-surface px-3 py-3 text-left shadow-card transition hover:shadow-soft ${active ? "ring-2 ring-ink" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {t.urgent && t.status !== "done" && <UrgentPill />}
                          <span className="truncate text-[15px] font-medium">{t.title}</span>
                        </span>
                        <span className="block truncate text-[13px] text-ink-2">{latestLine(t)}</span>
                      </span>
                      {t.status === "new" && <span className="size-2.5 shrink-0 rounded-full bg-norm" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {sections.length === 0 && <p className="rounded-3xl border border-dashed border-ink-faint p-6 text-center text-[15px] text-ink-2">Nothing for this agent right now.</p>}
      </div>

      {/* Right: new request, or a job thread */}
      <div className={`min-w-0 ${mobileOpen ? "" : "hidden md:block"}`}>
        <button onClick={() => setMobileOpen(false)} className="mb-3 inline-flex items-center gap-1 rounded-full bg-surface py-1.5 pl-2 pr-4 text-[15px] font-medium shadow-card md:hidden">
          <Icon name="arrow" className="size-4 rotate-180" /> Agents
        </button>
        {ticket ? (
          <Thread
            key={ticket.id}
            t={ticket}
            msgs={chat[ticket.id] ?? []}
            say={(from, text) => say(ticket.id, from, text)}
            onUpdate={onUpdate}
          />
        ) : (
          <AskView
            nextId={nextId}
            tickets={tickets}
            onReport={onReport}
            onCreate={onCreate}
            onMerge={onMerge}
            onOpenTicket={(id) => open(id)}
          />
        )}
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pl-12 text-[13px] text-ink-2">
      <span className="grid size-4 place-items-center text-ink-3">{icon ?? <span className="size-1.5 rounded-full bg-ink-3" />}</span>
      {children}
    </div>
  );
}

function Thread({ t, msgs, say, onUpdate }: { t: Ticket; msgs: Msg[]; say: (from: Msg["from"], text: string) => void; onUpdate: (id: string, p: Partial<Ticket>) => void }) {
  const item = itemById(t.itemId)!;
  const agent: Agent = agentForItem(t.itemId);
  const [text, setText] = useState("");
  const feed = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    if (msgs.length) feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  const escalate = () => {
    onUpdate(t.id, { status: "escalated", escalated: true, assignee: item.support.name });
    say("steward", `Calling ${item.support.name} now. I'll send them the photo and what we tried.`);
  };

  const send = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    say("you", q);
    setText("");
    setTimeout(() => {
      if (/escalat|call|engineer|send someone/i.test(q) && t.status !== "escalated" && t.status !== "done") escalate();
      else if (/fixed|done|solved|works/i.test(q) && t.status !== "done") {
        onUpdate(t.id, { status: "done" });
        say("steward", "Great. Marked as fixed and I've let #office-help know.");
      } else say("steward", "Got it. I'll add that to the ticket and keep an eye on it.");
    }, 700);
  };

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col overflow-hidden rounded-[30px] bg-surface shadow-soft md:h-[calc(100dvh-9rem)]">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <AgentAvatar tone={agent.tone} className="size-11" />
        <h2 className="min-w-0 flex-1 text-[17px] font-semibold leading-snug">{t.title}</h2>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {t.urgent && t.status !== "done" && <UrgentPill />}
          <SeverityBadge s={t.severity} />
        </div>
      </div>

      <div ref={feed} className="flex-1 space-y-3 overflow-y-auto p-4">
        {/* What was reported */}
        <div className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-surface-2 p-3.5 text-[15px]">
          {t.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.photo} alt={`Photo of ${item.name}`} className="mb-2 aspect-[4/5] w-52 max-w-full rounded-xl object-cover" />
          )}
          <div className="font-medium">{t.reporter}</div>
          <div>{t.title}</div>
          <div className="mt-1 text-xs text-ink-3">
            via {t.source === "slack" ? "Slack" : t.source === "voice" ? "voice" : "the app"} · {ago(t.minsAgo)}
          </div>
        </div>

        {/* What the agent did on its own */}
        <Chip>Read the report and matched {item.name} ({item.model})</Chip>
        {t.duplicates?.length ? (
          <Chip icon={<Icon name="copy" className="size-3.5" />}>
            Merged {t.duplicates.length} duplicate {t.duplicates.length === 1 ? "report" : "reports"} from {t.duplicates.map((d) => d.reporter.split(" ")[0]).join(", ")}
          </Chip>
        ) : (
          <Chip>Checked for duplicates. None found</Chip>
        )}
        <Chip>Looked up support: {item.support.name}{item.support.costPerCallout ? ` (£${item.support.costPerCallout} call-out)` : ""}</Chip>

        {/* The agent's answer */}
        <div className="flex gap-3">
          <AgentAvatar tone={agent.tone} className="size-9" />
          <div className="max-w-[85%] rounded-3xl rounded-bl-lg bg-lime/40 p-3.5 text-[15px]">
            <p>{t.diagnosis}</p>
            <ol className="mt-2 space-y-1.5">
              {t.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface text-xs font-medium text-ink-2">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {t.status === "escalated" && <Chip icon={<Icon name="phone" className="size-3.5" />}>Escalated to {item.support.name} with the photo and logs</Chip>}
        {t.status === "done" && (
          <Chip icon={<SlackLogo className="size-3.5" />}>
            Posted in #office-help and tagged {1 + (t.duplicates?.length ?? 0)} {t.duplicates?.length ? "reporters" : "reporter"}
          </Chip>
        )}

        {msgs.map((m, i) =>
          m.from === "you" ? (
            <div key={i} className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-surface-2 px-4 py-2.5 text-[15px]">
              {m.text}
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <AgentAvatar tone={agent.tone} className="size-9" />
              <div className="max-w-[85%] rounded-3xl rounded-bl-lg bg-lime/40 px-4 py-2.5 text-[15px]">{m.text}</div>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-line p-3">
        {t.status !== "done" && (
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              onClick={() => {
                onUpdate(t.id, { status: "done" });
                say("steward", "Marked as fixed and I've posted it in #office-help.");
              }}
              className="btn btn-primary btn-sm"
            >
              <Icon name="check" className="size-3.5" /> Mark fixed &amp; notify
            </button>
            {t.status !== "escalated" && (
              <button onClick={escalate} className="btn btn-secondary btn-sm">
                <Icon name="phone" className="size-3.5" /> Escalate to {item.support.name}
              </button>
            )}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pl-5 pr-1.5"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add an update or ask for help…"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-faint"
          />
          <button type="submit" disabled={!text.trim()} className="grid size-9 place-items-center rounded-full bg-ink text-surface disabled:opacity-40" aria-label="Send">
            <Icon name="arrow" className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
