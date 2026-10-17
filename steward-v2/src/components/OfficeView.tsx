"use client";

import { useState } from "react";
import { ITEMS, OFFICE, PINS, type Item, type Pin, type Ticket } from "@/lib/data";
import { OfficeMap } from "./OfficeMap";
import { ScanSheet } from "./ScanSheet";
import Link from "next/link";
import { Card, Icon, PageTitle } from "./ui";

const CATEGORY: Record<string, string> = {
  kitchen: "Kitchen",
  av: "AV",
  electrical: "Electrical",
  network: "Network",
  printing: "Printing",
  facilities: "Facilities",
  services: "Services",
};

const COLS = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_88px_20px]";

export function OfficeView({ tickets }: { tickets: Ticket[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>(ITEMS);
  const [pins, setPins] = useState<Pin[]>(PINS);
  const [scanned, setScanned] = useState("by Steward Bot on 14 Oct");
  const [scanning, setScanning] = useState(false);

  const movePin = (itemId: string, x: number, y: number) => setPins((ps) => ps.map((p) => (p.itemId === itemId ? { ...p, x, y } : p)));
  // New items drop in the left aisle, ready to be dragged to where they really are.
  const placeItem = (itemId: string) => setPins((ps) => (ps.some((p) => p.itemId === itemId) ? ps : [...ps, { itemId, x: 200, y: 205 }]));

  return (
    <div className="space-y-5">
      <PageTitle kicker="Office" title={`What Steward knows about ${OFFICE.name}`}>
        <div className="flex gap-2">
          <Link href="/device" className="btn btn-secondary btn-sm bg-surface shadow-card">
            <Icon name="spark" className="size-4" /> Steward Bot
          </Link>
          <button onClick={() => setScanning(true)} className="btn btn-primary btn-sm">
            <Icon name="camera" className="size-4" /> Re-scan office
          </button>
        </div>
      </PageTitle>
      <p className="-mt-3 max-w-2xl px-0.5 text-[15px] text-ink-2">
        {items.length} items known · {OFFICE.floor}. Steward uses this to diagnose from a single photo and to know who to call.
      </p>

      <OfficeMap tickets={tickets} items={items} pins={pins} scanned={scanned} onMovePin={movePin} onPlace={placeItem} onReset={() => setPins(PINS)} />

      {scanning && (
        <ScanSheet
          known={items}
          onClose={() => setScanning(false)}
          onDone={({ found, by }) => {
            setItems((xs) => [...xs, ...found]);
            setScanned(`by ${by} just now`);
          }}
        />
      )}

      <Card className="overflow-hidden">
        <div className={`hidden gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-ink-2 md:grid ${COLS}`}>
          <span>Item</span>
          <span>Location</span>
          <span>Support</span>
          <span>Status</span>
          <span />
        </div>
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const openCount = tickets.filter((t) => t.itemId === item.id && t.status !== "done").length;
            const expanded = open === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setOpen(expanded ? null : item.id)}
                  aria-expanded={expanded}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 text-left text-[15px] transition hover:bg-surface-2 ${COLS}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block truncate text-[13px] text-ink-2">{item.model}</span>
                  </span>
                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate">{item.location}</span>
                    <span className="block text-[13px] text-ink-3">{CATEGORY[item.category]}</span>
                  </span>
                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate">{item.support.name}</span>
                    <span className="block whitespace-nowrap font-mono text-[13px] text-ink-3">{item.support.phone}</span>
                  </span>
                  <span>
                    {openCount > 0 ? (
                      <span className="whitespace-nowrap rounded-full bg-high-soft px-2 py-0.5 text-[13px] font-medium text-high">{openCount} open</span>
                    ) : (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[13px] font-medium text-accent">OK</span>
                    )}
                  </span>
                  <Icon name="arrow" className={`hidden size-4 text-ink-3 transition md:block ${expanded ? "rotate-90" : ""}`} />
                </button>
                {expanded && (
                  <div className="grid gap-x-6 gap-y-2 bg-surface-2/60 px-5 pb-4 pt-1 text-[13px] sm:grid-cols-2 md:grid-cols-4">
                    <Field label="Location" value={`${item.location} · ${CATEGORY[item.category]}`} className="md:hidden" />
                    <Field label="Support" value={`${item.support.name} · ${item.support.phone}`} className="md:hidden" />
                    <Field label="Installed" value={item.installed} />
                    {item.lastServiced && <Field label="Last serviced" value={item.lastServiced} />}
                    {item.warrantyUntil && <Field label="Warranty until" value={item.warrantyUntil} />}
                    {item.support.costPerCallout !== undefined && (
                      <Field label="Call-out cost" value={item.support.costPerCallout ? `£${item.support.costPerCallout}` : "Included"} />
                    )}
                    {item.notes && <Field label="Steward's notes" value={item.notes} className="sm:col-span-2 md:col-span-4" />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-ink-3">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
