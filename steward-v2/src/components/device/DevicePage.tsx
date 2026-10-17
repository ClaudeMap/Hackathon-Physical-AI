"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon, StewardMark } from "../ui";
import { DeviceViewer, type ViewerHandle, type ViewerState } from "./DeviceViewer";
import { COLOURWAYS, TOOLS, type ToolId } from "./model";

const SWATCH: Record<ToolId, string> = {
  driver: "#c9ced1",
  pry: "#c9ced1",
  grabber: "#c9ced1",
  voltage: "#fcd303",
  soil: "#c87a4a",
  brush: "#25282a",
};

const SPECS: [string, string][] = [
  ["Body", "66 × 112 × 19 mm, anodised aluminium"],
  ["Display", "2.8″ portrait touch, card-stack UI"],
  ["Camera", "Rotating barrel, dual fisheye (360°)"],
  ["Controls", "Scroll wheel + push-to-talk key"],
  ["Audio", "4 mics, speaker, voice by severity"],
  ["Connectivity", "Wi-Fi, SIM/eSIM, USB-C"],
  ["Tools", "6 stainless tools, 3 per end, etched icons"],
  ["Dock", "Clips onto the Steward rover base"],
];

const allClosed = Object.fromEntries(TOOLS.map((t) => [t.id, false])) as Record<ToolId, boolean>;
const allOpen = Object.fromEntries(TOOLS.map((t) => [t.id, true])) as Record<ToolId, boolean>;

export function DevicePage() {
  const viewer = useRef<ViewerHandle>(null);
  const [s, setS] = useState<ViewerState>({ exploded: false, open: { ...allClosed, voltage: true }, cameraDeg: 0, docked: false, labels: true, spin: true, colourway: "natural" });
  const patch = (p: Partial<ViewerState>) => setS((x) => ({ ...x, ...p }));
  const toggleTool = (id: ToolId) => setS((x) => ({ ...x, spin: false, open: { ...x.open, [id]: !x.open[id] } }));
  const anyOpen = Object.values(s.open).some(Boolean);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StewardMark className="size-9" />
          <div>
            <div className="text-xs text-ink-3">Steward · hardware concept</div>
            <h1 className="text-xl font-semibold leading-tight">Steward Bot</h1>
          </div>
        </div>
        <Link href="/" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink">
          ← Back to app
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <div className="relative h-[480px] overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_50%_35%,var(--surface),var(--surface-2))] sm:h-[600px]">
            <DeviceViewer ref={viewer} state={s} onToolClick={toggleTool} />
            <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-ink-3">Drag to orbit · scroll to zoom · click a tool to open it</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip on={s.exploded} onClick={() => patch({ exploded: !s.exploded, spin: false })}>Exploded view</Chip>
            <Chip on={anyOpen} onClick={() => patch({ open: anyOpen ? allClosed : allOpen, spin: false })}>
              {anyOpen ? "Fold tools" : "Fan out tools"}
            </Chip>
            <Chip on={s.docked} onClick={() => patch({ docked: !s.docked })}>Robot dock</Chip>
            <Chip on={s.labels} onClick={() => patch({ labels: !s.labels })}>Callouts</Chip>
            <Chip on={s.spin} onClick={() => patch({ spin: !s.spin })}>Auto-rotate</Chip>
            <span className="grow" />
            <button onClick={() => viewer.current?.resetView()} className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">
              Reset view
            </button>
            <button
              onClick={() => viewer.current?.exportSTL()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink hover:brightness-110"
            >
              <Icon name="receipt" className="size-4" /> Export STL
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 text-sm text-ink-2">Colourway</span>
            {COLOURWAYS.map((c) => (
              <button
                key={c.id}
                onClick={() => patch({ colourway: c.id })}
                aria-pressed={s.colourway === c.id}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                  s.colourway === c.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:text-ink"
                }`}
              >
                <span className="size-3.5 rounded-full border border-line" style={{ background: `#${c.body.toString(16).padStart(6, "0")}` }} />
                {c.name}
              </button>
            ))}
          </div>

          <label className="mt-4 flex max-w-md items-center gap-3 text-sm text-ink-2">
            <span className="w-28 shrink-0">Camera tilt</span>
            <input
              type="range"
              min={-100}
              max={30}
              value={s.cameraDeg}
              onChange={(e) => patch({ cameraDeg: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
              aria-label="Camera tilt"
            />
            <span className="w-14 text-right font-mono text-xs tabular-nums text-ink-3">{s.cameraDeg}°</span>
          </label>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-medium">A pocket multi-tool that sees, speaks and fixes</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              The office manager carries Steward instead of waiting at a desk. The barrel camera looks under desks and into cupboards, the screen shows the fix, and the
              tools in the spine handle the common faults without a call-out.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-3">Tools · what each one fixes</div>
            <ul className="divide-y divide-line">
              {TOOLS.map((t) => (
                <li key={t.id}>
                  <button onClick={() => toggleTool(t.id)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-surface-2">
                    <span className="size-3 shrink-0 rounded-full border border-line" style={{ background: SWATCH[t.id] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t.name}</span>
                      <span className="block truncate text-xs text-ink-3">{t.fixes}</span>
                    </span>
                    <span className={`text-xs font-medium ${s.open[t.id] ? "text-accent" : "text-ink-3"}`}>{s.open[t.id] ? "Open" : "Folded"}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-3">Wi-Fi faults are handled by the built-in scanner, and Just Eat orders by voice, so neither needs a tool.</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-3">Concept targets</h3>
            <dl className="space-y-1.5 text-sm">
              {SPECS.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-ink-3">Dimensions are design targets for this concept model, not engineered or tested figures.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
