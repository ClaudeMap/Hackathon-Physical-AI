"use client";

import { useState } from "react";
import { ACTIVITY, ISSUES_PER_DAY, TODAY, WEEKS, ago, type Activity, type Ticket } from "@/lib/data";
import { Card, Icon, PageTitle, PRIORITY, SectionTitle } from "./ui";

const first = WEEKS[0];
const last = WEEKS[WEEKS.length - 1];
const pct = (a: number, b: number) => Math.round(((b - a) / a) * 100);
const selfFixRate = (w: (typeof WEEKS)[number]) => Math.round((w.selfFixed / w.reported) * 100);

export function InsightsView({ tickets }: { tickets: Ticket[] }) {
  const saved = WEEKS.reduce((s, w) => s + w.selfFixed * 35, 0); // ~35 min of manager time per self-fix

  // Everything below is computed from the live task list.
  const byPriority = [1, 2, 3, 4, 5].map((p) => tickets.filter((t) => PRIORITY[t.severity] === p).length);
  const days = [...ISSUES_PER_DAY, { day: TODAY, n: tickets.filter((t) => t.minsAgo < 1440).length }];

  return (
    <div className="space-y-4">
      <PageTitle kicker="Analytics" title="How the office is doing" />

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <IssuesPerDay days={days} />

        <section className="flex flex-col rounded-3xl bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-section">Issues by priority</h2>
            <span className="text-[13px]">All time</span>
          </div>
          <div className="mt-auto flex items-end gap-3 pt-10">
            {byPriority.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2" title={`Priority ${i + 1}: ${n} ${n === 1 ? "issue" : "issues"}`}>
                {n > 0 && <span className="rounded-full bg-ink px-2.5 py-[3px] text-[11px] font-medium text-surface">{n} {n === 1 ? "issue" : "issues"}</span>}
                <div
                  className="w-full rounded-lg transition-[height]"
                  style={{
                    height: 56 + n * 27,
                    background: n > 0 ? "var(--ink)" : "var(--line)",
                  }}
                />
                <span className="text-[13px]">P{i + 1}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <SectionTitle title="Are we getting better?" />
      <p className="-mt-2 px-1 text-[15px] text-ink-2">
        Yes. Over 8 weeks, issues are fixed <strong className="font-medium text-ink">{Math.abs(pct(first.medianHrs, last.medianHrs))}% faster</strong>, and staff get pulled
        in <strong className="font-medium text-ink">{Math.abs(pct(first.interruptions, last.interruptions))}% less</strong>.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Median time to fix" value={`${last.medianHrs}h`} delta={pct(first.medianHrs, last.medianHrs)} goodWhenDown />
        <Stat label="Fixed without a call-out" value={`${selfFixRate(last)}%`} delta={selfFixRate(last) - selfFixRate(first)} unit="pts" />
        <Stat label="Staff interruptions / wk" value={`${last.interruptions}`} delta={pct(first.interruptions, last.interruptions)} goodWhenDown />
        <Stat label="Manager time saved" value={`${Math.round(saved / 60)}h`} note="since August" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Median time to fix" unit="h" data={WEEKS.map((w) => ({ x: w.label, y: w.medianHrs }))} />
        <ChartCard title="Staff pulled into problems" unit="" data={WEEKS.map((w) => ({ x: w.label, y: w.interruptions }))} />
        <ChartCard title="Call-out spend (COO view)" unit="£" prefix data={WEEKS.map((w) => ({ x: w.label, y: w.calloutSpend }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl bg-memory p-3 pt-5">
          <div className="flex items-center justify-between px-2 pb-3">
            <h2 className="text-section">What Steward did for you</h2>
            <span className="text-[13px]">Today</span>
          </div>
          <ul className="space-y-2">
            {ACTIVITY.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-[20px] bg-surface py-3 pl-4 pr-3 text-[15px]">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                  <Icon name={ACT_ICON[a.kind]} className="size-4" />
                </span>
                <span className="flex-1 leading-snug">{a.text}</span>
                <span className="shrink-0 text-[13px] text-ink-3">{ago(a.minsAgo)}</span>
              </li>
            ))}
          </ul>
        </section>
        <Card className="p-5">
          <h2 className="mb-1 text-section">Steward&apos;s suggestions</h2>
          <p className="mb-4 text-[15px] text-ink-2">Patterns from 8 weeks of your office data.</p>
          <ul className="space-y-4 text-[15px]">
            <Suggestion title="Wi-Fi AP-3 has failed 4 times in 6 weeks" body="Replacing it (£180) costs less than two more TechDesk call-outs." />
            <Suggestion title="Coffee machine jams on Mondays" body="It's always after the weekend refill. Add a 'two-thirds full' label to the hopper." />
            <Suggestion title="Plant care lapsed in August" body="Set GreenSpace to a recurring monthly visit. I can book it." />
          </ul>
        </Card>
      </div>
    </div>
  );
}

const ACT_ICON: Record<Activity["kind"], string> = {
  order: "office",
  report: "insights",
  ticket: "tasks",
  booking: "phone",
  fix: "check",
};

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="text-section font-medium tabular-nums">{value}</dd>
    </div>
  );
}

// New issues reported per day, today highlighted. Hover a bar for the count.
function IssuesPerDay({ days }: { days: { day: number; n: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520;
  const H = 190;
  const pad = { t: 14, b: 26, l: 22 };
  const top = Math.max(6, Math.ceil(Math.max(...days.map((d) => d.n)) / 2) * 2);
  const slot = (W - pad.l) / days.length;
  const bw = Math.min(24, slot * 0.62);
  const lastI = days.length - 1;
  const today = days[lastI].n;
  const avg = days.reduce((a, d) => a + d.n, 0) / days.length;
  const busiest = days.reduce((m, d) => (d.n > m.n ? d : m), days[0]);
  const ticks = [0, top / 2, top];
  const y = (n: number) => H - pad.b - ((H - pad.t - pad.b) * n) / top;

  return (
    <section className="rounded-[30px] bg-surface p-5 shadow-soft">
      <h2 className="text-section">Issues per day</h2>
      <p className="text-[13px] text-ink-2">New issues reported over the last {days.length} days</p>

      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Issues reported per day">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={0} y={y(t) + 3} fontSize={10} fill="var(--ink-3)">
                {t}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = pad.l + i * slot + (slot - bw) / 2;
            const top_ = y(d.n);
            const emph = i === lastI || i === hover;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.l + i * slot} y={0} width={slot} height={H} fill="transparent" />
                {d.n > 0 && (
                  <path
                    d={`M${x},${H - pad.b} V${top_ + 5} Q${x},${top_} ${x + 5},${top_} H${x + bw - 5} Q${x + bw},${top_} ${x + bw},${top_ + 5} V${H - pad.b} Z`}
                    fill="var(--accent)"
                    opacity={emph ? 1 : 0.3}
                  />
                )}
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={10} fontWeight={i === lastI ? 600 : 400} fill={i === lastI ? "var(--ink)" : "var(--ink-3)"}>
                  {d.day}
                </text>
                {i === lastI && hover === null && (
                  <text x={x + bw / 2} y={top_ - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
                    {d.n}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded-full bg-ink px-2.5 py-1 text-xs text-surface shadow-card"
            style={{ left: `${((pad.l + (hover + 0.5) * slot) / W) * 100}%` }}
          >
            <span className="text-surface/60">{hover === lastI ? "Today" : `Oct ${days[hover].day}`}</span>{" "}
            <span className="font-medium tabular-nums">
              {days[hover].n} {days[hover].n === 1 ? "issue" : "issues"}
            </span>
          </div>
        )}
        <table className="sr-only">
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <th>Oct {d.day}</th>
                <td>{d.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 grid grid-cols-3 border-t border-line pt-4">
        <Fig label="Today" value={String(today)} />
        <Fig label="Daily average" value={(Math.round(avg * 10) / 10).toString()} />
        <Fig label="Busiest day" value={`${busiest.day === TODAY ? "Today" : `Oct ${busiest.day}`} · ${busiest.n}`} />
      </dl>
    </section>
  );
}

function Stat({ label, value, delta, goodWhenDown, unit = "%", note }: { label: string; value: string; delta?: number; goodWhenDown?: boolean; unit?: string; note?: string }) {
  const good = delta === undefined ? true : goodWhenDown ? delta < 0 : delta > 0;
  return (
    <Card className="p-4">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className="mt-1 text-[30px] font-light leading-tight tracking-[-0.03em] tabular-nums">{value}</div>
      {delta !== undefined ? (
        <div className={`mt-1 inline-flex items-center gap-1 text-[13px] font-medium ${good ? "text-good" : "text-crit-ink"}`}>
          <Icon name="up" className={`size-3 ${delta < 0 ? "rotate-180" : ""}`} />
          {Math.abs(delta)}
          {unit} vs 8 wks ago
        </div>
      ) : (
        <div className="mt-1 text-[13px] text-ink-3">{note}</div>
      )}
    </Card>
  );
}

function Suggestion({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lime text-ink">
        <Icon name="spark" className="size-3.5" />
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-ink-2">{body}</div>
      </div>
    </li>
  );
}

// Single-series bar chart: forest-green bars, latest bar emphasised, hover tooltip.
function ChartCard({ title, data, unit, prefix }: { title: string; data: { x: string; y: number }[]; unit: string; prefix?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300;
  const H = 140;
  const pad = { t: 22, b: 20 };
  const max = Math.max(...data.map((d) => d.y)) * 1.1;
  const slot = W / data.length;
  const bw = Math.min(22, slot * 0.55);
  const fmt = (v: number) => (prefix ? `${unit}${v}` : `${v}${unit}`);
  const lastI = data.length - 1;

  return (
    <Card className="p-5">
      <h2 className="text-[16px] font-medium">{title}</h2>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={`${title}, weekly`}>
          <line x1={0} x2={W} y1={H - pad.b} y2={H - pad.b} stroke="var(--line)" />
          {data.map((d, i) => {
            const h = ((H - pad.t - pad.b) * d.y) / max;
            const x = i * slot + (slot - bw) / 2;
            const y = H - pad.b - h;
            const emph = i === lastI || i === hover;
            return (
              <g key={d.x} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                <path
                  d={`M${x},${H - pad.b} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bw - 4} Q${x + bw},${y} ${x + bw},${y + 4} V${H - pad.b} Z`}
                  fill="var(--accent)"
                  opacity={emph ? 1 : 0.3}
                />
                <text x={i * slot + slot / 2} y={H - 5} textAnchor="middle" fontSize={9} fill="var(--ink-3)">
                  {d.x}
                </text>
                {i === lastI && hover === null && (
                  <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--ink)">
                    {fmt(d.y)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded-full bg-ink px-2.5 py-1 text-xs text-surface shadow-card"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
          >
            <span className="text-surface/60">{data[hover].x}</span> <span className="font-medium tabular-nums">{fmt(data[hover].y)}</span>
          </div>
        )}
        <table className="sr-only">
          <tbody>
            {data.map((d) => (
              <tr key={d.x}>
                <th>{d.x}</th>
                <td>{fmt(d.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
