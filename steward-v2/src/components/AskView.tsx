"use client";

import { useEffect, useRef, useState } from "react";
import { type ReportedTicket } from "@/lib/adapt";
import { diagnose, type Diagnosis } from "@/lib/agent";
import type { Report, Ticket } from "@/lib/data";
import { speak, stopSpeaking, VOICES } from "@/lib/voice";
import { Card, DupChip, Icon, SeverityBadge, StewardMark } from "./ui";

const EXAMPLES = [
  "Coffee machine is broken",
  "Fuse has gone in the kitchen",
  "Wifi is down in meeting rooms",
  "Printer is not working",
  "Dishwasher shows E24",
  "Office plants are dying",
  "Kitchen bin is overflowing",
  "Just Eat lunch needs to go out",
  "Screens need to be installed",
];

type Stage = "idle" | "running" | "result";

export function AskView({
  nextId,
  tickets,
  onCreate,
  onMerge,
  onOpenTicket,
  onReport,
}: {
  nextId: string;
  tickets: Ticket[];
  onCreate: (t: Ticket) => void;
  onMerge: (id: string, r: Report) => void;
  onOpenTicket: (id: string) => void;
  onReport?: (text: string) => Promise<ReportedTicket | null>;
}) {
  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ url: string; video: boolean; name: string } | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Diagnosis | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [dupOf, setDupOf] = useState<Ticket | null>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => stopSpeaking(), []);

  const pipeline = result
    ? [
        media ? `${media.video ? "Video" : "Photo"} received from your phone` : "Message received",
        "Posted to #office-help on Slack",
        "Analysed with vision + your office context",
        `Matched to inventory: ${result.item.name} (${result.item.model})`,
        dupOf ? `Duplicate detected: matches ${dupOf.id}. Your report was merged.` : `No duplicates found. Ticket ${ticketId} created.`,
      ]
    : [];

  const run = () => {
    if (!text.trim() && !media) return;
    const reportText = text.trim() || media?.name || "";
    const d = diagnose(reportText, !!media);
    const existing = tickets.find((t) => t.itemId === d.item.id && t.status !== "done") ?? null;
    setDupOf(null);
    setResult(d);
    setTicketId(existing?.id ?? nextId);
    setStage("running");
    setStep(0);
    const pending = onReport?.(reportText);
    let i = 0;
    const finish = (api: ReportedTicket | null) => {
      const spoken = api?.voiceLine || d.voiceLine;
      const severity = api?.severity ?? d.severity;
      if (api) {
        setTicketId(api.id);
        setDupOf(api.merged ? (tickets.find((ticket) => ticket.id === api.id) ?? existing) : null);
        if (api.summary) {
          setResult({
            ...d,
            summary: api.summary,
            steps: api.steps?.length ? api.steps : d.steps,
            voiceLine: spoken,
            severity,
            canSelfFix: api.canSelfFix ?? d.canSelfFix,
          });
        }
      } else if (existing) {
        setDupOf(existing);
        onMerge(existing.id, { reporter: "You", minsAgo: 0, source: "app", text: reportText || "Sent a photo" });
      } else {
        const id = nextId;
        setTicketId(id);
        onCreate({
          id,
          title: reportText || `${d.item.name} issue`,
          itemId: d.item.id,
          severity: d.severity,
          status: "new",
          source: "app",
          reporter: "You",
          assignee: d.canSelfFix ? "You" : d.item.support.name,
          minsAgo: 0,
          diagnosis: d.summary,
          steps: d.steps,
          photo: media && !media.video ? media.url : undefined,
        });
      }
      setStep(5);
      setStage("result");
      setSpeaking(true);
      speak(spoken, severity, () => setSpeaking(false));
    };
    const tick = () => {
      i += 1;
      if (i < 5) {
        setStep(i);
        setTimeout(tick, 650);
        return;
      }
      setStep(4);
      void Promise.resolve(pending)
        .then((api) => finish(api ?? null))
        .catch(() => finish(null));
    };
    setTimeout(tick, 500);
  };

  const reset = () => {
    stopSpeaking();
    setSpeaking(false);
    setStage("idle");
    setText("");
    setMedia(null);
    setResult(null);
    setTicketId(null);
    setDupOf(null);
  };

  const mockListen = () => {
    if (listening) return;
    setListening(true);
    setTimeout(() => {
      setText("The kitchen sockets have all gone dead, I think a fuse has tripped");
      setListening(false);
    }, 1600);
  };


  const canSend = !!text.trim() || !!media;

  return (
    <div className="mx-auto max-w-xl">
      {stage === "idle" && (
        <section
          className="flex min-h-[560px] flex-col gap-5 rounded-[30px] p-5 shadow-soft"
          style={{ background: "linear-gradient(to bottom, #ffffff 0%, #f7f5d2 40%, #e9f37e 100%)" }}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-[30px] place-items-center rounded-full bg-ink text-surface">
              <Icon name="bolt" className="size-4" />
            </span>
            <span className="flex-1 text-[16px] font-medium">Steward</span>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setMedia({ url: URL.createObjectURL(f), video: f.type.startsWith("video"), name: f.name });
            }}
          />

          <p className="mt-6 text-[28px] font-light leading-[1.2] tracking-[-0.03em]">
            Just say what&apos;s wrong. I&apos;ll find <b className="font-medium">the task</b>, <b className="font-medium">what happened before</b> and{" "}
            <b className="font-medium">who to call</b>.
          </p>

          {media && (
            <div className="relative overflow-hidden rounded-3xl bg-surface-2">
              {media.video ? (
                <video src={media.url} className="max-h-64 w-full object-cover" controls />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt="Uploaded" className="max-h-64 w-full object-cover" />
              )}
              <button onClick={() => setMedia(null)} className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-ink/70 text-white" aria-label="Remove">
                <Icon name="x" className="size-4" />
              </button>
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
            rows={2}
            aria-label="Describe the problem"
            placeholder={listening ? "Listening…" : "Describe the problem…"}
            className="min-h-[64px] w-full resize-none rounded-3xl bg-white/70 px-5 py-4 text-[16px] outline-none placeholder:text-ink-2 focus:bg-white focus:ring-2 focus:ring-ink/15"
          />

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => setText(e)}
                className="rounded-full bg-white/70 px-4 py-2.5 text-[15px] font-medium text-ink-2 transition hover:bg-white hover:text-ink"
              >
                {e}
              </button>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-between pt-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="grid size-12 place-items-center rounded-2xl bg-white/60 text-ink transition hover:bg-white"
              aria-label="Take a photo or upload a video"
              title="Take a photo or upload a video"
            >
              <Icon name="camera" className="size-5" />
            </button>
            <button
              onClick={mockListen}
              className={`relative grid size-[76px] place-items-center rounded-3xl bg-ink text-surface shadow-[0_12px_30px_rgba(18,20,18,0.25)] transition hover:brightness-125 ${listening ? "pulse-ring" : ""}`}
              aria-label="Speak"
              aria-pressed={listening}
            >
              <Icon name="mic" className="size-[30px]" />
            </button>
            <button
              onClick={run}
              disabled={!canSend}
              className={`grid size-12 place-items-center rounded-2xl transition ${canSend ? "bg-ink text-surface hover:brightness-125" : "bg-white/60 text-ink-2 opacity-60"}`}
              aria-label="Ask Steward"
            >
              <Icon name="arrow" className="size-5" />
            </button>
          </div>
        </section>
      )}

      {stage !== "idle" && result && (
        <div className="space-y-3">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-medium text-ink-2">
              <Icon name="spark" className="size-4" /> Steward pipeline
            </div>
            <ol className="space-y-3">
              {pipeline.map((p, i) => {
                const state = i < step ? "done" : i === step && stage === "running" ? "active" : "todo";
                return (
                  <li key={i} className={`flex items-center gap-3 text-[15px] transition ${state === "todo" ? "text-ink-faint" : ""}`}>
                    <span
                      className={`grid size-[22px] shrink-0 place-items-center rounded-full ${
                        state === "done" ? "bg-ink text-surface" : state === "active" ? "border-2 border-ink" : "border-2 border-line"
                      }`}
                    >
                      {state === "done" && <Icon name="check" className="size-3" />}
                      {state === "active" && <span className="size-1.5 animate-ping rounded-full bg-ink" />}
                    </span>
                    {p}
                  </li>
                );
              })}
            </ol>
          </Card>

          {stage === "result" && dupOf && (
            <div className="flex items-start gap-3 rounded-3xl bg-memory p-4 text-[15px]">
              <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-ink text-surface">
                <Icon name="copy" className="size-4" />
              </span>
              <div className="flex-1">
                <div className="font-semibold">Already reported. You&apos;re not the only one.</div>
                <div>
                  {dupOf.reporter}
                  {dupOf.duplicates?.length ? ` and ${dupOf.duplicates.length} other${dupOf.duplicates.length > 1 ? "s" : ""}` : ""} reported this as{" "}
                  <span className="font-mono">{dupOf.id}</span>. Steward added you to it instead of opening a new ticket. You&apos;ll get a ping when it&apos;s fixed.
                </div>
              </div>
              <DupChip n={(dupOf.duplicates?.length ?? 0) + 2} />
            </div>
          )}

          {stage === "result" && (
            <Card className="overflow-hidden">
              <div className="flex items-start gap-3 border-b border-line p-5">
                <StewardMark className={`size-11 ${speaking ? "pulse-ring relative" : ""}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge s={result.severity} />
                    <span className="text-[13px] text-ink-2">{Math.round(result.confidence * 100)}% confident</span>
                    {result.canSelfFix && result.etaMins > 0 && <span className="text-[13px] text-good">You can fix this · ~{result.etaMins} min</span>}
                  </div>
                  <p className="mt-2 text-[17px] leading-relaxed">&ldquo;{result.voiceLine}&rdquo;</p>
                  <button
                    onClick={() => {
                      if (speaking) {
                        stopSpeaking();
                        setSpeaking(false);
                      } else {
                        setSpeaking(true);
                        speak(result.voiceLine, result.severity, () => setSpeaking(false));
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent"
                  >
                    <Icon name={speaking ? "stop" : "speaker"} className="size-3.5" />
                    {speaking ? "Stop" : "Replay"} · voice: {VOICES[result.severity].label}
                  </button>
                </div>
              </div>
              <div className="p-5">
                <p className="mb-4 text-[15px] text-ink-2">{result.summary}</p>
                <ol className="space-y-2.5">
                  {result.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-[16px]">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-medium text-ink-2">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button onClick={() => ticketId && onOpenTicket(ticketId)} className="btn btn-primary">
                    {dupOf ? "View" : "Open"} ticket {ticketId}
                  </button>
                  {!result.canSelfFix || result.severity === "critical" ? (
                    <a href={`tel:${result.item.support.phone.replace(/\s/g, "")}`} className="btn btn-secondary">
                      <Icon name="phone" className="size-4" /> Call {result.item.support.name}
                    </a>
                  ) : null}
                  <button onClick={reset} className="rounded-full px-4 py-3 text-[15px] font-medium text-ink-2 hover:bg-surface-2">
                    Report something else
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
