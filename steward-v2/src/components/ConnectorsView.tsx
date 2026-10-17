"use client";

import { useState } from "react";
import { CONNECTORS, INVOICES, PEOPLE_TODAY, type Connector, type Invoice } from "@/lib/data";
import { Card, Icon, PageTitle, SourceIcon } from "./ui";

const INV_STATUS: Record<Invoice["status"], { label: string; cls: string }> = {
  matched: { label: "Matched", cls: "bg-surface-2 text-ink-2" },
  needs_approval: { label: "Needs approval", cls: "bg-surface-2 text-ink" },
  flagged: { label: "Flagged", cls: "bg-ink text-surface" },
};

export function ConnectorsView() {
  const [connected, setConnected] = useState<Record<string, boolean>>(() => Object.fromEntries(CONNECTORS.map((c) => [c.id, c.connected])));
  const [invoices, setInvoices] = useState(INVOICES);
  const groups = [...new Set(CONNECTORS.map((c) => c.group))];

  const flagged = invoices.filter((i) => i.status === "flagged");
  const atRisk = flagged.reduce((s, i) => s + i.amount, 0);
  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const pending = invoices.filter((i) => i.status === "needs_approval").length;

  const resolve = (id: string, note: string) => setInvoices((xs) => xs.map((x) => (x.id === id ? { ...x, status: "matched", note } : x)));

  return (
    <div className="space-y-8">
      <div>
        <PageTitle kicker="Connectors" title="The tools Steward works in" />
        <p className="max-w-2xl px-0.5 text-[15px] text-ink-2">Steward works inside the tools Transition already uses. Each connection adds to what it knows.</p>
      </div>

      {/* Invoicing */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2">
              <Icon name="receipt" className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-medium">Invoicing</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[13px] font-medium text-accent">
                  <span className="size-1.5 rounded-full bg-accent" /> Xero connected
                </span>
              </div>
              <p className="text-[15px] text-ink-2">Every supplier bill is checked against the ticket, the contract and what actually happened.</p>
            </div>
          </div>
          <div className="flex gap-6 text-[15px]">
            <Metric label="Billed this month" value={`£${total}`} />
            <Metric label="Awaiting approval" value={`${pending}`} />
            <Metric label="Flagged" value={`£${atRisk}`} tone={atRisk > 0 ? "text-crit-ink" : undefined} />
          </div>
        </div>

        <ul className="divide-y divide-line">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{inv.supplier}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[13px] font-medium ${INV_STATUS[inv.status].cls}`}>{INV_STATUS[inv.status].label}</span>
                </div>
                <p className="mt-0.5 text-[15px] text-ink-2">{inv.note}</p>
                <div className="mt-1 flex gap-3 font-mono text-[13px] text-ink-3">
                  <span>{inv.id}</span>
                  <span>{inv.date}</span>
                  {inv.ticketId && <span>↔ {inv.ticketId}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <span className="text-base font-semibold tabular-nums">£{inv.amount}</span>
                {inv.status === "flagged" && (
                  <button
                    onClick={() => resolve(inv.id, "Dispute sent to the supplier. Steward will chase in 5 days.")}
                    className="btn btn-secondary btn-sm"
                  >
                    Send dispute
                  </button>
                )}
                {inv.status === "needs_approval" && (
                  <button
                    onClick={() => resolve(inv.id, "Approved and scheduled for payment in Xero.")}
                    className="btn btn-primary btn-sm"
                  >
                    Approve
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <PeoplePanel />

      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-3 px-1 text-section font-medium">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {CONNECTORS.filter((c) => c.group === g).map((c) => (
              <ConnectorCard key={c.id} c={c} on={connected[c.id]} toggle={() => setConnected((s) => ({ ...s, [c.id]: !s[c.id] }))} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function ConnectorCard({ c, on, toggle }: { c: Connector; on: boolean; toggle: () => void }) {
  const waitlist = c.id === "robot";
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-[15px] font-semibold text-ink-2">
          {c.id === "slack" ? <SourceIcon s="slack" className="size-5" /> : c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{c.name}</div>
          <p className="mt-0.5 text-[15px] text-ink-2">{c.blurb}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 pt-1">
        <span className="text-[13px] text-ink-3">{on ? c.detail ?? "Connected" : waitlist ? c.detail : "Not connected"}</span>
        {waitlist ? (
          <button className="btn btn-secondary btn-sm">Join pilot</button>
        ) : (
          <button
            role="switch"
            aria-checked={on}
            onClick={toggle}
            className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-line"}`}
            aria-label={`${on ? "Disconnect" : "Connect"} ${c.name}`}
          >
            <span className={`absolute top-1 size-4 rounded-full bg-surface shadow transition-all ${on ? "left-5" : "left-1"}`} />
          </button>
        )}
      </div>
    </Card>
  );
}

function PeoplePanel() {
  const p = PEOPLE_TODAY;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2">
            <Icon name="users" className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-medium">HR &amp; people</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[13px] font-medium text-accent">
                <span className="size-1.5 rounded-full bg-accent" /> HiBob connected
              </span>
            </div>
            <p className="text-[15px] text-ink-2">Steward knows who&apos;s in, prepares for new starters and never routes a problem to someone on holiday.</p>
          </div>
        </div>
        <div className="text-[15px]">
          <div className="text-[13px] text-ink-3">In the office today</div>
          <div className="text-lg font-semibold tabular-nums">
            {p.inOffice} <span className="text-[15px] font-normal text-ink-3">of {p.headcount}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-line md:grid-cols-3">
        <div className="bg-surface p-5">
          <h3 className="mb-2 text-[13px] font-medium text-ink-2">On leave</h3>
          <ul className="space-y-1.5 text-[15px]">
            {p.onLeave.map((x) => (
              <li key={x.name} className="flex justify-between gap-2">
                <span>{x.name}</span>
                <span className="text-[13px] text-ink-3">{x.until}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-surface-2 p-2 text-[13px] text-ink-2">Tom is off, so Wi-Fi updates on STW-117 go to Aisha M. instead.</p>
        </div>
        {p.starters.map((x) => (
          <div key={x.name} className="bg-surface p-5">
            <h3 className="mb-2 text-[13px] font-medium text-ink-2">New starter · {x.date}</h3>
            <div className="text-[15px] font-medium">{x.name}</div>
            <div className="mb-2 text-[13px] text-ink-3">{x.role}</div>
            <ul className="space-y-1 text-[15px]">
              {x.tasks.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check" className="size-3.5 text-good" /> {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {p.leavers.map((x) => (
          <div key={x.name} className="bg-surface p-5">
            <h3 className="mb-2 text-[13px] font-medium text-ink-2">Leaving · {x.date}</h3>
            <div className="mb-2 text-[15px] font-medium">{x.name}</div>
            <ul className="space-y-1 text-[15px] text-ink-2">
              {x.tasks.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="size-3.5 rounded border border-line" /> {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
