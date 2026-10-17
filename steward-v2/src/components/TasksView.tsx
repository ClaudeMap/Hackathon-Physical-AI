"use client";

import { useRef, useState } from "react";
import { ACTIVITY, ago, itemById, stepStats, type Severity, type Ticket } from "@/lib/data";
import { speak, stopSpeaking, VOICES } from "@/lib/voice";
import { EscalateSheet } from "./EscalateSheet";
import {
  ArrowBadge,
  Card,
  DetailsPill,
  DupChip,
  Gauge,
  Icon,
  PRIORITY,
  SectionTitle,
  SIGNAL_COLOR,
  SIGNAL_LABEL,
  Signal,
  SignalPill,
  signalFor,
  SlackLogo,
  SourceIcon,
} from "./ui";

type Filter = "open" | "escalated" | "done";

const SEV_RANK = { critical: 0, high: 1, normal: 2, low: 3 };
const STATUS_TEXT = { new: "New", in_progress: "In progress", waiting: "Waiting", escalated: "Escalated", done: "Completed" };
const SOURCE_NAME = { slack: "Slack", app: "App", voice: "Voice" };
const sigOf = (t: Ticket) => (t.status === "done" ? "calm" : signalFor(t.severity, t.urgent));

export function TasksView({
  tickets,
  onUpdate,
  selectedId,
  onSelect,
  sourceLabel = "Demo data",
}: {
  tickets: Ticket[];
  onUpdate: (id: string, patch: Partial<Ticket>) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  sourceLabel?: string;
}) {
  const [filter, setFilter] = useState<Filter>("open");

  const counts = {
    open: tickets.filter((t) => t.status !== "done" && t.status !== "escalated").length,
    escalated: tickets.filter((t) => t.status === "escalated").length,
    done: tickets.filter((t) => t.status === "done").length,
  };

  // Once someone reorders by hand, that order wins over urgent/severity. New
  // tickets have no rank, so they land at the top until they've been triaged.
  const manual = tickets.some((t) => t.manualRank !== undefined);
  const byDefault = (a: Ticket, b: Ticket) =>
    Number(!!b.urgent) - Number(!!a.urgent) || SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.minsAgo - b.minsAgo;

  const shown = tickets
    .filter((t) =>
      filter === "done" ? t.status === "done" : filter === "escalated" ? t.status === "escalated" : t.status !== "done" && t.status !== "escalated",
    )
    .sort((a, b) => (manual ? (a.manualRank ?? -1) - (b.manualRank ?? -1) : 0) || byDefault(a, b));

  const move = (id: string, dir: -1 | 1) => {
    const ids = shown.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    ids.forEach((tid, rank) => onUpdate(tid, { manualRank: rank }));
  };

  // Drag to reorder: the handle captures the pointer, and `order` previews the
  // new sequence live. The rank is only committed on release.
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(id);
    setOrder(shown.map((t) => t.id));
  };

  const dragOver = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragId || !order) return;
    const others = order.filter((id) => id !== dragId);
    const above = others.filter((id) => {
      const r = rows.current.get(id)?.getBoundingClientRect();
      return r ? e.clientY > r.top + r.height / 2 : false;
    }).length;
    const next = [...others.slice(0, above), dragId, ...others.slice(above)];
    if (next.some((id, i) => id !== order[i])) setOrder(next);
  };

  const endDrag = () => {
    if (order && order.some((id, i) => id !== shown[i]?.id)) order.forEach((id, rank) => onUpdate(id, { manualRank: rank }));
    setDragId(null);
    setOrder(null);
  };

  const visible = order ? order.map((id) => shown.find((t) => t.id === id)).filter((t): t is Ticket => !!t) : shown;
  const resetOrder = () => tickets.forEach((t) => t.manualRank !== undefined && onUpdate(t.id, { manualRank: undefined }));

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  // Overview numbers cover everything that's still open.
  const live = tickets.filter((t) => t.status !== "done").sort(byDefault);
  const stepTotals = live.reduce((a, t) => ({ done: a.done + stepStats(t).done, total: a.total + stepStats(t).total }), { done: 0, total: 0 });
  const stepsPct = stepTotals.total ? Math.round((stepTotals.done / stepTotals.total) * 100) : 0;
  const critical = live.filter((t) => t.urgent || t.severity === "critical" || t.severity === "high").slice(0, 3);
  const needYou = live.filter((t) => t.status === "new" || t.status === "in_progress").length;
  const criticalCount = live.filter((t) => t.urgent || t.severity === "critical").length;
  const recent = [
    ...tickets
      .filter((t) => t.status === "done")
      .map((t) => ({ id: t.id, title: t.title, meta: `${t.steps.length} of ${t.steps.length} steps`, pill: "Completed" })),
    ...ACTIVITY.slice(0, 3).map((a) => ({ id: a.id, title: a.text, meta: ago(a.minsAgo), pill: ACT_PILL[a.kind] })),
  ].slice(0, 4);

  return (
    <div className="space-y-4 pt-2">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Overview needYou={needYou} critical={criticalCount} stepsPct={stepsPct} lead={live[0]} sourceLabel={sourceLabel} />
        <CriticalAlerts items={critical} onSelect={onSelect} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="min-w-0">
          <SectionTitle title="All issues" meta={`${counts.open + counts.escalated} open`} />

          <div className="mb-3 mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
            <div role="tablist" className="flex gap-1 rounded-full bg-surface p-1 shadow-card">
              {(["open", "escalated", "done"] as Filter[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-[14px] font-medium capitalize transition ${filter === f ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"}`}
                >
                  {f} <span className={filter === f ? "text-surface/60" : "text-ink-3"}>{counts[f]}</span>
                </button>
              ))}
            </div>
            <p className="text-[13px] text-ink-2">
              {manual ? (
                <>
                  Your order.{" "}
                  <button onClick={resetOrder} className="font-medium text-accent hover:underline">
                    Reset to Steward&apos;s order
                  </button>
                </>
              ) : filter !== "done" ? (
                "Ordered by urgency. Drag the handle to reorder."
              ) : null}
            </p>
          </div>

          <ul className={`space-y-3 ${dragId ? "select-none" : ""}`}>
            {visible.map((t) => {
              const active = t.id === selectedId;
              const st = stepStats(t);
              const sig = sigOf(t);
              return (
                <li
                  key={t.id}
                  ref={(el) => {
                    if (el) rows.current.set(t.id, el);
                    else rows.current.delete(t.id);
                  }}
                  className={`flex items-stretch gap-1 transition ${dragId === t.id ? "relative z-10 scale-[1.01] opacity-90" : ""}`}
                >
                  <button
                    onClick={() => onSelect(active ? null : t.id)}
                    aria-pressed={active}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-3xl bg-surface py-3 pl-5 pr-3 text-left shadow-card transition hover:shadow-soft ${
                      active ? "ring-2 ring-ink" : ""
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <Signal state={sig} />
                        <span className="min-w-0 text-lead">{t.title}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
                        <SourceIcon s={t.source} className="size-4" />
                        <span className="whitespace-pre">
                          {SOURCE_NAME[t.source]}  |  {st.done}/{st.total} steps
                        </span>
                        {t.status !== "new" && <span>· {STATUS_TEXT[t.status]}</span>}
                        {!!t.duplicates?.length && <DupChip n={t.duplicates.length + 1} />}
                      </span>
                    </span>
                    <Gauge pct={st.pct} color={SIGNAL_COLOR[sig]}>
                      <span className="text-[11px] font-medium">{st.pct}%</span>
                    </Gauge>
                    <DetailsPill />
                  </button>
                  {filter !== "done" && (
                    <button
                      onPointerDown={(e) => startDrag(e, t.id)}
                      onPointerMove={dragOver}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                          e.preventDefault();
                          move(t.id, e.key === "ArrowUp" ? -1 : 1);
                        }
                      }}
                      aria-label={`Reorder ${t.id}. Drag, or use the up and down arrow keys.`}
                      title="Drag to reorder"
                      className={`grid w-6 shrink-0 touch-none select-none place-items-center rounded-full text-ink-faint transition hover:text-ink ${
                        dragId === t.id ? "cursor-grabbing text-ink" : "cursor-grab"
                      }`}
                    >
                      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
                        {[3, 8, 13].flatMap((y) => [5, 11].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.3} />))}
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
            {shown.length === 0 && <li className="rounded-3xl border border-dashed border-ink-faint p-8 text-center text-[15px] text-ink-2">Nothing here. Nice.</li>}
          </ul>

          <div className="mt-5 rounded-3xl bg-memory p-3 pt-5">
            <div className="flex items-center justify-between px-2 pb-3">
              <h2 className="text-section">Activity</h2>
              <span className="text-[13px]">Today</span>
            </div>
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-[20px] bg-surface py-3 pl-4 pr-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] leading-snug">{r.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-2">
                      <span className="size-2.5 rounded-full bg-ink" />
                      {r.meta}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-medium">{r.pill}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:rounded-[30px] lg:pb-1">
          {selected ? (
            // Bottom sheet on phones and tablets, side panel on desktop.
            <div
              className="fixed inset-0 z-40 flex items-end bg-ink/40 lg:static lg:block lg:bg-transparent"
              onClick={(e) => e.target === e.currentTarget && onSelect(null)}
            >
              <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] bg-bg p-3 lg:max-h-none lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0">
                <TicketDetail key={selected.id} t={selected} onUpdate={onUpdate} onClose={() => onSelect(null)} />
              </div>
            </div>
          ) : (
            <Card className="hidden p-6 text-[15px] text-ink-2 lg:block">Select a task to see Steward&apos;s diagnosis, the steps, and who to call.</Card>
          )}
        </div>
      </div>
    </div>
  );
}

const ACT_PILL = { order: "Drafted", report: "Report", ticket: "Logged", booking: "Booked", fix: "Fixed" } as const;

/* ---- Today (lime: Steward is talking) -------------------------------------------- */

const LIME_GRADIENT = "linear-gradient(to bottom, #ffffff 0%, #f5f0d6 45%, #e9f37e 100%)";

function Overview({
  needYou,
  critical,
  stepsPct,
  lead,
  sourceLabel,
}: {
  needYou: number;
  critical: number;
  stepsPct: number;
  lead?: Ticket;
  sourceLabel: string;
}) {
  const st = lead ? stepStats(lead) : null;
  return (
    <section aria-label="Today" className="relative min-h-[260px] overflow-hidden rounded-[30px]" style={{ background: LIME_GRADIENT }}>
      <div className="relative z-10 flex min-h-[260px] flex-col p-6">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-medium">Today</span>
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] text-ink-2">{sourceLabel}</span>
        </div>
        <div className="flex items-baseline gap-2.5 py-6">
          <span className="text-display font-light tabular-nums">{needYou}</span>
          <span className="text-[22px] leading-[1.15] tracking-[-0.015em]">
            {needYou === 1 ? "issue" : "issues"}
            <br />
            need you
          </span>
        </div>
        <p className="mt-auto text-meta">
          <span className="text-ink-2">{stepsPct}% of steps done</span>
          {critical > 0 && <span className="font-medium"> · {critical} critical</span>}
        </p>
      </div>

      {lead && st && (
        <>
          {lead.photo && (
            <div className="absolute bottom-6 right-[7%] hidden -rotate-6 sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lead.photo} alt={`Photo: ${lead.title}`} className="size-[140px] rounded-[28px] object-cover shadow-[0_16px_15px_rgba(0,0,0,0.2)]" />
            </div>
          )}
          <div className="absolute right-[24%] top-[92px] hidden items-center gap-1.5 rounded-full bg-surface py-1 pl-2 pr-2.5 text-[13px] font-medium text-ink shadow-[0_4px_12px_rgba(0,0,0,0.12)] sm:flex">
            <Signal state={sigOf(lead)} className="size-3" />
            {SIGNAL_LABEL[sigOf(lead)]}
          </div>
          <div className="absolute right-[18%] top-[140px] hidden rounded-full bg-surface py-1 pl-2 pr-2.5 text-[13px] font-medium text-ink shadow-[0_4px_12px_rgba(0,0,0,0.12)] sm:block">
            {st.done} of {st.total} done
          </div>
        </>
      )}
    </section>
  );
}

/* ---- Critical alerts (forest: these are what you hand off) ---------------------------- */

function CriticalAlerts({ items, onSelect }: { items: Ticket[]; onSelect: (id: string) => void }) {
  return (
    <section aria-label="Critical alerts" className="rounded-3xl bg-forest pb-3 pl-5 pr-4 pt-5 text-white">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-section">Critical alerts</h2>
        <span className="text-fine text-white/70">{items.length} live</span>
      </div>
      {items.length === 0 && <p className="pb-4 text-[15px] text-white/70">Nothing critical right now.</p>}
      <ul>
        {items.map((t, i) => (
          <li key={t.id} className={i > 0 ? "border-t border-white/15" : ""}>
            <button onClick={() => onSelect(t.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface">
                <SourceIcon s={t.source} className="size-[22px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-white/70">
                  {SIGNAL_LABEL[sigOf(t)]} · priority {PRIORITY[t.severity]}
                </span>
                <span className="block text-[16px] font-medium leading-snug">{t.title}</span>
              </span>
              <ArrowBadge light />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---- Task detail (Figma "Task detail") ------------------------------------------ */

const PRIORITIES: { id: Severity; label: string }[] = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" },
];

function TicketDetail({ t, onUpdate, onClose }: { t: Ticket; onUpdate: (id: string, p: Partial<Ticket>) => void; onClose: () => void }) {
  const item = itemById(t.itemId)!;
  const sig = sigOf(t);
  const st = stepStats(t);
  const isDone = t.status === "done";
  const [speaking, setSpeaking] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const toggleVoice = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(t.voiceLine || `${t.diagnosis} ${t.steps.join(" ")}`, t.severity, () => setSpeaking(false));
  };

  const setStepDone = (i: number, v: boolean) => {
    const next = t.steps.map((_, j) => (j === i ? v : (t.stepsDone?.[j] ?? false)));
    onUpdate(t.id, { stepsDone: next });
  };
  const setNote = (i: number, v: string) => {
    const next = t.steps.map((_, j) => (j === i ? v : (t.stepNotes?.[j] ?? "")));
    onUpdate(t.id, { stepNotes: next });
  };

  return (
    <div className="space-y-3">
      <section className="rounded-[30px] bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <SignalPill state={sig} />
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[15px] text-ink-2">
              <SourceIcon s={t.source} className="size-[22px]" />
              {SOURCE_NAME[t.source]}
            </span>
            <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink" aria-label="Close">
              <Icon name="x" className="size-4" />
            </button>
          </div>
        </div>

        <h2 className="mt-4 text-heading font-medium">{t.title}</h2>
        <p className="mt-2 text-meta text-ink-2">
          <span className="font-mono">{t.id}</span> · reported by {t.reporter} · {ago(t.minsAgo)}
        </p>

        {t.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.photo} alt={`Photo of ${item.name}`} className="mt-4 aspect-[4/5] w-full rounded-3xl object-cover" />
        )}

        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 gap-[3px]" role="img" aria-label={`${st.done} of ${st.total} steps done`}>
            {t.steps.map((_, i) => (
              <span key={i} className={`h-[18px] flex-1 rounded-[3px] ${i < st.done ? "bg-ink" : "bg-line"}`} />
            ))}
          </div>
          <span className="text-[15px] tabular-nums text-ink-2">
            {st.done}/{st.total}
          </span>
        </div>

        {!isDone && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <div role="radiogroup" aria-label="Priority" className="flex gap-0.5 rounded-full bg-surface-2 p-0.5 text-[13px]">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={t.severity === p.id}
                  onClick={() => onUpdate(t.id, { severity: p.id })}
                  className={`rounded-full px-3 py-1 font-medium transition ${t.severity === p.id ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => onUpdate(t.id, { urgent: !t.urgent })}
              aria-pressed={!!t.urgent}
              className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${t.urgent ? "bg-ink text-surface" : "bg-surface-2 text-ink-2 hover:text-ink"}`}
            >
              {t.urgent ? "Urgent ✓" : "Mark urgent"}
            </button>
            {t.status === "new" && (
              <button onClick={() => onUpdate(t.id, { status: "in_progress" })} className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium text-ink-2 hover:text-ink">
                I&apos;m on it
              </button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-3xl p-5 shadow-card" style={{ background: LIME_GRADIENT }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-medium text-ink-2">Steward&apos;s diagnosis</h3>
          <button onClick={toggleVoice} className={`btn btn-sm ${speaking ? "btn-primary" : "btn-secondary"}`}>
            <Icon name={speaking ? "stop" : "speaker"} className="size-3.5" />
            {speaking ? "Stop" : `Hear it · ${VOICES[t.severity].label}`}
          </button>
        </div>
        <p className="text-[18px] leading-[1.35]">{t.diagnosis}</p>
      </section>

      {!!t.duplicates?.length && (
        <section className="rounded-3xl bg-memory p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-medium">
            <Icon name="copy" className="size-4" /> {t.duplicates.length} duplicate {t.duplicates.length === 1 ? "report" : "reports"} merged
          </h3>
          <ul className="space-y-2 text-[15px]">
            {t.duplicates.map((d, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <SourceIcon s={d.source} className="mt-0.5 size-4" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{d.reporter}</span> <span className="text-ink-2">&ldquo;{d.text}&rdquo;</span>
                </span>
                <span className="shrink-0 text-[13px] text-ink-2">{ago(d.minsAgo)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px]">Everyone gets notified when this is fixed.</p>
        </section>
      )}

      <SectionTitle title="Steps" meta={`${st.done} of ${st.total} done`} />
      {t.steps.map((s, i) => (
        <StepCard
          key={i}
          n={i + 1}
          text={s}
          done={isDone || !!t.stepsDone?.[i]}
          locked={isDone}
          history={t.history?.[i]}
          note={t.stepNotes?.[i] ?? ""}
          onToggle={(v) => setStepDone(i, v)}
          onNote={(v) => setNote(i, v)}
        />
      ))}

      <section className="rounded-3xl bg-surface p-5 text-[15px] shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{item.name}</span>
          <span className="text-[13px] text-ink-2">{item.location}</span>
        </div>
        <div className="text-ink-2">{item.model}</div>
        {item.notes && <p className="mt-2 text-[13px] text-ink-2">{item.notes}</p>}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <div>
            <div className="font-medium">{item.support.name}</div>
            <div className="text-[13px] text-ink-2">
              {item.support.role}
              {item.support.costPerCallout !== undefined && ` · £${item.support.costPerCallout} call-out`}
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap font-mono text-[13px] text-ink-2">{item.support.phone}</span>
        </div>
      </section>

      {isDone ? (
        <p className="flex items-center gap-2.5 rounded-3xl bg-memory px-4 py-3 text-[15px]">
          <SlackLogo className="size-4 shrink-0" /> Fixed. #office-help was notified{t.duplicates?.length ? ` and ${t.duplicates.length + 1} reporters were tagged` : ""}.
        </p>
      ) : (
        <div className="sticky bottom-3 z-10 flex items-center gap-2 rounded-full bg-surface p-1.5 pl-5 shadow-float">
          <Signal state={sig} className="size-6" />
          <span className="flex-1 sm:hidden" />
          <span className="hidden min-w-0 flex-1 truncate text-[15px] text-ink-2 sm:block">{t.status === "escalated" ? `With ${t.assignee}` : SIGNAL_LABEL[sig]}</span>
          <button
            onClick={() => onUpdate(t.id, { status: "done" })}
            className="btn btn-secondary btn-sm"
          >
            <Icon name="check" className="size-4" /> Fixed &amp; notify
          </button>
          {t.status !== "escalated" && (
            <button onClick={() => setEscalating(true)} className="btn btn-primary" style={{ padding: "0.9rem 1.5rem" }}>
              Escalate
            </button>
          )}
        </div>
      )}

      {escalating && (
        <EscalateSheet
          t={t}
          onClose={() => setEscalating(false)}
          onBack={onClose}
          onSend={(contactName) => onUpdate(t.id, { status: "escalated", escalated: true, assignee: contactName })}
        />
      )}
    </div>
  );
}

function StepCard({
  n,
  text,
  done,
  locked,
  history,
  note,
  onToggle,
  onNote,
}: {
  n: number;
  text: string;
  done: boolean;
  locked: boolean;
  history?: string;
  note: string;
  onToggle: (v: boolean) => void;
  onNote: (v: string) => void;
}) {
  const [draft, setDraft] = useState(note);
  const [photo, setPhoto] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const saved = draft.trim() !== "" && draft === note;

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <button
          onClick={() => !locked && onToggle(!done)}
          aria-pressed={done}
          aria-label={`Step ${n} ${done ? "done" : "not done"}`}
          className={`grid size-[30px] shrink-0 place-items-center rounded-full transition ${done ? "bg-ink text-surface" : "border-2 border-ink-faint hover:border-ink"}`}
        >
          {done && <Icon name="check" className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-ink-faint">Step {n}</div>
          <p className={`text-lead ${done ? "text-ink-faint line-through" : ""}`}>{text}</p>
        </div>
      </div>

      {history && !done && (
        <div className="flex gap-3 rounded-[14px] bg-memory py-3 pl-3 pr-4">
          <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-ink text-surface">
            <Icon name="history" className="size-4" />
          </span>
          <div className="text-[15px]">
            <p className="font-semibold">Happened before</p>
            <p>{history}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <label htmlFor={`note-${n}`} className="text-[15px] font-medium text-ink-2">
            What did you see?
          </label>
          <span className="text-[13px] text-good">{saved ? "Saved" : "​"}</span>
        </div>
        <textarea
          id={`note-${n}`}
          value={draft}
          readOnly={locked}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== note && onNote(draft)}
          rows={2}
          placeholder="e.g. light still blinking after restart"
          className="min-h-[60px] w-full resize-none rounded-[14px] bg-surface-2 px-4 py-3.5 text-[16px] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-ink/20"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPhoto(URL.createObjectURL(f));
          }}
        />
        <button onClick={() => file.current?.click()} className="btn btn-secondary gap-1.5 !py-3 !pl-1.5 !pr-5 !text-[16px]">
          <span className="grid size-[30px] place-items-center rounded-full bg-ink text-surface">
            <Icon name="camera" className="size-4" />
          </span>
          Take photo
        </button>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`Photo for step ${n}`} className="size-12 rounded-xl object-cover" />
        )}
      </div>
    </section>
  );
}
