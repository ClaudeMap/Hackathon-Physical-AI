"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KEYWORDS } from "@/lib/agent";
import { itemById, stepStats, type Contact, type Item, type Ticket } from "@/lib/data";
import { Icon, SIGNAL_LABEL, Signal, SourceIcon, signalFor } from "./ui";

// Figma "Escalate" and "Sent (demo)" screens: pick who gets the job, see exactly what
// they'll be sent, then confirm.

type Group = "facilities" | "it" | "electrician";

const GROUPS: { id: Group; label: string }[] = [
  { id: "facilities", label: "Facilities contractor" },
  { id: "it", label: "IT support" },
  { id: "electrician", label: "Electrician" },
];

const defaultGroup = (item: Item): Group => (item.category === "electrical" ? "electrician" : item.category === "network" ? "it" : "facilities");

function contactFor(group: Group, item: Item): Contact {
  if (group === "it") return itemById("wifi")!.support;
  if (group === "electrician") return itemById("fuse")!.support;
  return item.category === "network" || item.category === "electrical" ? itemById("dishwasher")!.support : item.support;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export function EscalateSheet({
  t,
  onClose,
  onBack,
  onSend,
}: {
  t: Ticket;
  onClose: () => void;
  onBack: () => void;
  onSend: (contactName: string) => void;
}) {
  const item = itemById(t.itemId)!;
  const [group, setGroup] = useState<Group>(defaultGroup(item));
  const [sent, setSent] = useState(false);
  const contact = contactFor(group, item);
  const sig = signalFor(t.severity, t.urgent);
  const st = stepStats(t);
  const tried = t.steps.filter((_, i) => t.stepsDone?.[i]);
  const open = t.steps.filter((_, i) => !t.stepsDone?.[i]);

  const text = `${t.title} ${t.diagnosis}`.toLowerCase();
  const matched = (KEYWORDS[t.itemId] ?? []).filter((w) => text.includes(w)).slice(0, 3);
  const why = group !== defaultGroup(item) ? "Switched by you" : `Matched on ${(matched.length ? matched : [item.name.toLowerCase()]).join(", ")}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = () => {
    onSend(contact.name);
    setSent(true);
  };

  // Portalled to <body> so the sticky header and detail panel can't sit on top of it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Escalate"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[94dvh] w-full max-w-[470px] space-y-3 overflow-y-auto rounded-t-[30px] bg-bg p-3 md:rounded-[30px]">
        {sent ? (
          <section className="rounded-[30px] bg-surface px-6 pb-6 pt-10 text-center shadow-soft">
            <span className="mx-auto grid size-[92px] place-items-center rounded-full bg-forest text-lime">
              <Icon name="check" className="size-11" />
            </span>
            <span className="mt-6 inline-flex rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium text-ink-2">Sent (demo)</span>
            <h2 className="mt-4 text-heading font-light">{contact.name.split(" ")[0]} has the full picture</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
              {contact.name} ({contact.role.toLowerCase()}) now has the report, what you tried, what&apos;s still open{t.photo ? " and the photo" : ""}.
            </p>
            <div className="mt-8 flex flex-col gap-2">
              <button
                onClick={() => {
                  onClose();
                  onBack();
                }}
                className="btn btn-primary w-full"
              >
                Back to tasks
              </button>
              <button onClick={onClose} className="rounded-full py-3 text-[16px] font-medium hover:bg-surface-2">
                View task
              </button>
            </div>
          </section>
        ) : (
          <>
            <button onClick={onClose} className="inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-4 text-[15px] font-medium shadow-soft">
              <span className="grid size-9 place-items-center rounded-full bg-surface-2">
                <Icon name="back" className="size-[18px]" />
              </span>
              Back to task
            </button>

            <div className="px-1 pb-1 pt-2">
              <p className="text-[15px] text-ink-2">Escalate</p>
              <h2 className="text-title font-medium">Hand this to someone</h2>
            </div>

            <section className="flex items-center gap-4 rounded-[30px] bg-forest p-5 text-white">
              <span className="grid size-[60px] shrink-0 place-items-center rounded-full bg-lime text-[22px] font-medium text-ink">{initials(contact.name)}</span>
              <div className="min-w-0">
                <div className="text-[22px] font-medium leading-tight">{contact.name}</div>
                <div className="text-[16px] text-white/70">
                  {contact.role}
                  {contact.costPerCallout ? ` · £${contact.costPerCallout} call-out` : ""}
                </div>
                <span className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[13px] font-medium text-white">{why}</span>
              </div>
            </section>

            <div role="radiogroup" aria-label="Who to contact" className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  role="radio"
                  aria-checked={group === g.id}
                  onClick={() => setGroup(g.id)}
                  className={`rounded-full px-4 py-2.5 text-[15px] font-medium shadow-card transition ${group === g.id ? "bg-ink text-surface" : "bg-surface text-ink-2 hover:text-ink"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <section className="rounded-3xl bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-section">Why</h3>
              <div className="rounded-3xl bg-surface-2 p-4">
                <div className="flex items-center gap-2 text-[14px]">
                  <Signal state={sig} className="size-4" />
                  <span className="flex-1 font-medium">{SIGNAL_LABEL[sig]}</span>
                  <SourceIcon s={t.source} className="size-[18px]" />
                  <span className="text-ink-2">{t.source === "slack" ? "Slack" : t.source === "voice" ? "Voice" : "App"}</span>
                </div>
                <p className="mt-2.5 text-[16px] leading-snug">&ldquo;{t.title}&rdquo;</p>
              </div>
            </section>

            <section className="rounded-3xl bg-surface p-5 shadow-card">
              <h3 className="flex items-center gap-2 text-section">
                Steps tried <Count n={tried.length} />
              </h3>
              <ul className="mt-3 space-y-2.5 text-[16px]">
                {tried.length === 0 && <li className="text-ink-2">Nothing tried yet.</li>}
                {tried.map((s) => (
                  <li key={s} className="flex gap-3">
                    <span className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-ink text-surface">
                      <Icon name="check" className="size-3" />
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
              <h3 className="mt-5 flex items-center gap-2 text-section">
                Still open <Count n={open.length} />
              </h3>
              <ul className="mt-3 space-y-2.5 text-[16px]">
                {open.map((s) => (
                  <li key={s} className="flex gap-3">
                    <span className="mt-0.5 size-[22px] shrink-0 rounded-full border-2 border-ink-faint" />
                    {s}
                  </li>
                ))}
                {open.length === 0 && <li className="text-ink-2">All {st.total} steps are done.</li>}
              </ul>
            </section>

            {t.photo && (
              <section className="rounded-3xl bg-surface p-5 shadow-card">
                <h3 className="flex items-center gap-2 text-section">
                  Photo <Count n={1} />
                </h3>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.photo} alt={`Photo of ${item.name}`} className="mt-3 aspect-[4/5] w-full rounded-3xl object-cover" />
              </section>
            )}

            <div className="sticky bottom-0 -mx-1 rounded-full bg-surface p-1.5 shadow-float">
              <button onClick={send} className="btn btn-primary w-full" style={{ padding: "1rem 1.5rem", fontSize: 17 }}>
                Send to {contact.name.split(" ")[0]}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Count({ n }: { n: number }) {
  return <span className="grid min-w-6 place-items-center rounded-full bg-surface-2 px-1.5 py-0.5 text-[13px] font-medium text-ink-2">{n}</span>;
}
