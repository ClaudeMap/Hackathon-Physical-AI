import { useId } from "react";
import type { Severity, Status, Source, Tone } from "@/lib/data";

const PATHS: Record<string, string> = {
  tasks: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  ask: "M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  camera: "M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  insights: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  office: "M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  speaker: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M19 6a8 8 0 010 12",
  stop: "M7 7h10v10H7z",
  check: "M5 12l5 5L20 7",
  up: "M12 19V5M5 12l7-7 7 7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  arrowur: "M7 17L17 7M8 7h9v9",
  back: "M15 6l-6 6 6 6",
  slack: "M10 3L8 21M16 3l-2 18M4 8h16M4 16h16",
  mic: "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3",
  x: "M6 6l12 12M18 6L6 18",
  rotl: "M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5",
  rotr: "M21 12a9 9 0 11-9-9 9.7 9.7 0 016.7 2.8L21 8M21 3v5h-5",
  copy: "M8 8h12v12H8zM4 16V4h12",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7.5M22 21v-1a6 6 0 00-4-5.6",
  plus: "M12 5v14M5 12h14",
  plug: "M9 2v6M15 2v6M6 8h12v4a6 6 0 01-12 0zM12 18v4",
  receipt: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  history: "M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5M12 7v5l3 2",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  chat: "M4 5h16v11H9l-5 4z",
};

export function Icon({ name, className = "size-5" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---- Priority & Signal ---------------------------------------------------- */

// The Figma file shows priorities 1 to 5. Steward's four severities map onto the top of that scale.
export const PRIORITY: Record<Severity, number> = { critical: 5, high: 4, normal: 3, low: 2 };

export type SignalState = "calm" | "pulse" | "urgent";

export const signalFor = (sev: Severity, urgent?: boolean): SignalState =>
  urgent || sev === "critical" ? "urgent" : sev === "low" ? "calm" : "pulse";

export const SIGNAL_COLOR: Record<SignalState, string> = { calm: "var(--ink-faint)", pulse: "var(--ink-2)", urgent: "var(--ink)" };
export const SIGNAL_LABEL: Record<SignalState, string> = { calm: "On track", pulse: "Needs attention", urgent: "Urgent" };
export const SIGNAL_TINT: Record<SignalState, string> = { calm: "var(--surface-2)", pulse: "var(--surface-2)", urgent: "var(--surface-2)" };

// Solid dot = urgent, ring = needs attention, faint = on track. Shape, not colour.
export function Signal({ state, className = "size-6" }: { state: SignalState; className?: string }) {
  return (
    <span className={`signal signal-${state} ${className}`} role="img" aria-label={SIGNAL_LABEL[state]}>
      <span className="signal-dot" />
    </span>
  );
}

export function SignalPill({ state }: { state: SignalState }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3 text-[15px] font-medium" style={{ background: SIGNAL_TINT[state] }}>
      <Signal state={state} className="size-4" />
      {SIGNAL_LABEL[state]}
    </span>
  );
}

const SEV: Record<Severity, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-surface-2 font-semibold text-ink" },
  high: { label: "High", cls: "bg-surface-2 text-ink" },
  normal: { label: "Normal", cls: "bg-surface-2 text-ink-2" },
  low: { label: "Low", cls: "bg-surface-2 text-ink-3" },
};

export function SeverityBadge({ s }: { s: Severity }) {
  const v = SEV[s];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium ${v.cls}`}>{v.label}</span>;
}

const STATUS: Record<Status, string> = {
  new: "New",
  in_progress: "In progress",
  waiting: "Waiting",
  escalated: "Escalated",
  done: "Completed",
};

// Figma Pill/Status
export function StatusPill({ s, className = "" }: { s: Status; className?: string }) {
  const tone = s === "done" ? "text-good" : s === "escalated" ? "text-high" : "text-ink";
  return <span className={`inline-flex items-center rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-medium ${tone} ${className}`}>{STATUS[s]}</span>;
}

// Figma Pill/Details
export function DetailsPill({ label = "Details" }: { label?: string }) {
  return <span className="inline-flex items-center rounded-full bg-surface-2 px-3.5 py-1.5 text-[13px] font-medium text-ink">{label}</span>;
}

// The small ink circle with an arrow, used on alert rows.
export function ArrowBadge({ className = "size-[22px]", light }: { className?: string; light?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${light ? "bg-surface text-ink" : "bg-ink text-surface"} ${className}`}>
      <Icon name="arrowur" className="size-3" />
    </span>
  );
}

/* ---- Source ---------------------------------------------------------------- */

const SOURCE_LABEL: Record<Source, string> = { slack: "Slack", app: "App", voice: "Voice" };

// Slack uses the Figma icon; the Figma Email icon is used for in-app reports.
export function SourceIcon({ s, className = "size-4" }: { s: Source; className?: string }) {
  if (s === "voice") {
    return (
      <span className={`grid shrink-0 place-items-center rounded-full bg-ink text-surface ${className}`}>
        <Icon name="mic" className="size-[65%]" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={s === "slack" ? "/figma/icon-slack.svg" : "/figma/icon-email.svg"} alt={SOURCE_LABEL[s]} className={`shrink-0 ${className}`} />;
}

export function SourceTag({ s }: { s: Source }) {
  return <span className="text-[13px] text-ink-2">{SOURCE_LABEL[s]}</span>;
}

/* ---- Layout pieces --------------------------------------------------------- */

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-3xl bg-surface shadow-card ${className}`}>{children}</div>;
}

export function PageTitle({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-2">
      <div>
        <p className="text-[15px] text-ink-2">{kicker}</p>
        <h1 className="text-title font-medium">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pt-5">
      <h2 className="text-section font-medium">{title}</h2>
      {meta && <span className="text-[15px] text-ink-2">{meta}</span>}
    </div>
  );
}

// Figma gauge: a half circle with a rounded value arc. Pass `gradient` for the Analytics version.
export function Gauge({
  pct,
  size = 52,
  color = "var(--ink)",
  gradient,
  stroke,
  children,
}: {
  pct: number;
  size?: number;
  color?: string;
  gradient?: [string, string];
  stroke?: number;
  children?: React.ReactNode;
}) {
  const gid = useId();
  const sw = stroke ?? Math.max(4, Math.round(size / 11));
  const r = (size - sw) / 2;
  const len = Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const d = `M ${sw / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - sw / 2} ${size / 2}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size / 2 + sw / 2 }} role="img" aria-label={`${Math.round(clamped)}%`}>
      <svg width={size} height={size / 2 + sw / 2} viewBox={`0 0 ${size} ${size / 2 + sw / 2}`} className="block overflow-visible">
        {gradient && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2={size} y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor={gradient[0]} />
              <stop offset="1" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <path d={d} fill="none" stroke="var(--line)" strokeWidth={sw} strokeLinecap="round" />
        {clamped > 0 && (
          <path
            d={d}
            fill="none"
            stroke={gradient ? `url(#${gid})` : color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${(len * clamped) / 100} ${len}`}
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">{children}</div>
    </div>
  );
}

/* ---- Brand ------------------------------------------------------------------ */

// The Steward logo from the Figma "App icon": the doorway mark on a white-to-lime tile.
export function StewardMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-[27%] ring-1 ring-ink/5 ${className}`}
      style={{ background: "linear-gradient(to bottom, #ffffff 0%, #f5f0d6 45%, #e9f37e 100%)" }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/mark-doorway.svg" alt="" className="size-1/2" />
    </span>
  );
}

export function SlackLogo({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Slack">
      <rect x="1" y="8.3" width="10.9" height="3.6" rx="1.8" fill="#36C5F0" />
      <rect x="8.3" y="1" width="3.6" height="5.4" rx="1.8" fill="#36C5F0" />
      <rect x="12.1" y="1" width="3.6" height="10.9" rx="1.8" fill="#2EB67D" />
      <rect x="17.6" y="8.3" width="5.4" height="3.6" rx="1.8" fill="#2EB67D" />
      <rect x="12.1" y="12.1" width="10.9" height="3.6" rx="1.8" fill="#ECB22E" />
      <rect x="12.1" y="17.6" width="3.6" height="5.4" rx="1.8" fill="#ECB22E" />
      <rect x="8.3" y="12.1" width="3.6" height="10.9" rx="1.8" fill="#E01E5A" />
      <rect x="1" y="12.1" width="5.4" height="3.6" rx="1.8" fill="#E01E5A" />
    </svg>
  );
}

export function UrgentPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface py-0.5 pl-2 pr-2.5 text-[13px] font-medium text-ink shadow-[0_2px_8px_rgba(18,20,18,0.12)]">
      <Signal state="urgent" className="size-3" />
      Urgent
    </span>
  );
}

export function DupChip({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-medium text-ink-2" title={`${n} people reported this`}>
      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7.5M22 21v-1a6 6 0 00-4-5.6" />
      </svg>
      {n} reports
    </span>
  );
}

// Every agent is Steward talking, so every agent is lime.
const TONE: Record<Tone, string> = { accent: "var(--lime)", high: "var(--lime)", norm: "var(--lime)", low: "var(--lime)", good: "var(--lime)" };

// A soft blob with two eyes. One per agent, colour-coded.
export function AgentAvatar({ tone = "accent", className = "size-10" }: { tone?: Tone; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-[38%] ${className}`} style={{ background: TONE[tone] }} aria-hidden>
      <span className="flex w-[44%] justify-between">
        {[0, 1].map((i) => (
          <span key={i} className="aspect-[1/1.7] w-[34%] rounded-full" style={{ background: "var(--ink)" }} />
        ))}
      </span>
    </span>
  );
}
