"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SCAN_FINDS, type Item } from "@/lib/data";
import { Icon } from "./ui";

// Mock office re-scan: upload photos or video, or send Steward Bot round. Nothing is
// really analysed; it plays the pipeline and "finds" the items in SCAN_FINDS.

type Mode = "upload" | "bot";
type Stage = "choose" | "scanning" | "result";
type Upload = { url: string; video: boolean; name: string };

const STEP_COUNT = 5;

export function ScanSheet({
  known,
  onClose,
  onDone,
}: {
  known: Item[];
  onClose: () => void;
  onDone: (r: { found: Item[]; by: string }) => void;
}) {
  const [stage, setStage] = useState<Stage>("choose");
  const [mode, setMode] = useState<Mode>("upload");
  const [files, setFiles] = useState<Upload[]>([]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const input = useRef<HTMLInputElement>(null);

  const found = useMemo(() => SCAN_FINDS.filter((f) => !known.some((k) => k.id === f.id)), [known]);

  const steps =
    mode === "upload"
      ? [
          `Uploaded ${files.length} ${files.length === 1 ? "file" : "files"}`,
          "Finding furniture and equipment",
          "Reading labels and model plates",
          `Matching against your ${known.length} known items`,
          "Updating the map",
        ]
      : [
          "Steward Bot is walking the aisles",
          "Photographing each room",
          "Reading labels and model plates",
          `Matching against your ${known.length} known items`,
          "Updating the map",
        ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (stage !== "scanning") return;
    const id = setInterval(() => setStep((s) => s + 1), 750);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (stage !== "scanning" || step < STEP_COUNT) return;
    const id = setTimeout(() => {
      setPicked(Object.fromEntries(found.map((f) => [f.id, true])));
      setStage("result");
    }, 500);
    return () => clearTimeout(id);
  }, [stage, step, found]);

  const start = (m: Mode, f: Upload[]) => {
    setMode(m);
    setFiles(f);
    setStep(0);
    setStage("scanning");
  };

  const chosen = found.filter((f) => picked[f.id]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Re-scan your office"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[94dvh] w-full max-w-[470px] space-y-3 overflow-y-auto rounded-t-[30px] bg-bg p-3 md:rounded-[30px]">
        <div className="flex items-start justify-between gap-3 px-2 pt-2">
          <div>
            <p className="text-[15px] text-ink-2">Office</p>
            <h2 className="text-heading font-medium">Re-scan your office</h2>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-surface text-ink-2 shadow-card hover:text-ink" aria-label="Close">
            <Icon name="x" className="size-4" />
          </button>
        </div>

        {stage === "choose" && (
          <>
            <p className="px-2 text-[15px] text-ink-2">
              Update what Steward knows. It spots new equipment, reads labels and matches everything to your inventory and the map.
            </p>
            <input
              ref={input}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                if (list.length) start("upload", list.map((f) => ({ url: URL.createObjectURL(f), video: f.type.startsWith("video"), name: f.name })));
              }}
            />
            <button
              onClick={() => input.current?.click()}
              className="flex w-full items-center gap-4 rounded-3xl bg-surface p-5 text-left shadow-card transition hover:shadow-soft"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2">
                <Icon name="upload" className="size-5" />
              </span>
              <span>
                <span className="block text-[17px] font-medium">Upload photos or video</span>
                <span className="block text-[14px] text-ink-2">Film a walk round, or add a few photos of each room.</span>
              </span>
            </button>
            <button
              onClick={() => start("bot", [])}
              className="flex w-full items-center gap-4 rounded-3xl bg-surface p-5 text-left shadow-card transition hover:shadow-soft"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-surface">
                <Icon name="spark" className="size-5" />
              </span>
              <span>
                <span className="block text-[17px] font-medium">Send Steward Bot</span>
                <span className="block text-[14px] text-ink-2">It walks the aisles on its own. About 6 minutes.</span>
              </span>
            </button>
          </>
        )}

        {stage === "scanning" && (
          <section className="rounded-3xl bg-surface p-5 shadow-card">
            {files.length > 0 && (
              <div className="mb-4 flex gap-2 overflow-x-auto">
                {files.slice(0, 6).map((f) =>
                  f.video ? (
                    <video key={f.url} src={f.url} className="size-16 shrink-0 rounded-2xl object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={f.url} src={f.url} alt={f.name} className="size-16 shrink-0 rounded-2xl object-cover" />
                  ),
                )}
              </div>
            )}
            <ol className="space-y-3">
              {steps.map((label, i) => {
                const state = i < step ? "done" : i === step ? "active" : "todo";
                return (
                  <li key={label} className={`flex items-center gap-3 text-[15px] ${state === "todo" ? "text-ink-faint" : ""}`}>
                    <span
                      className={`grid size-[22px] shrink-0 place-items-center rounded-full ${
                        state === "done" ? "bg-ink text-surface" : state === "active" ? "border-2 border-ink" : "border-2 border-line"
                      }`}
                    >
                      {state === "done" && <Icon name="check" className="size-3" />}
                      {state === "active" && <span className="size-1.5 animate-ping rounded-full bg-ink" />}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {stage === "result" && (
          <>
            <section className="rounded-3xl bg-surface p-5 shadow-card">
              <h3 className="text-section">
                {found.length ? `Found ${found.length} new ${found.length === 1 ? "item" : "items"}` : "Nothing new"}
              </h3>
              <p className="mt-1 text-[14px] text-ink-2">
                {known.length} items you already had are unchanged.
                {found.length ? " New items start off the map. Place them with Edit layout." : " Your map is up to date."}
              </p>
              <ul className="mt-4 space-y-2">
                {found.map((f) => (
                  <li key={f.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-2 p-3.5">
                      <input
                        type="checkbox"
                        checked={!!picked[f.id]}
                        onChange={() => setPicked((p) => ({ ...p, [f.id]: !p[f.id] }))}
                        className="mt-1 size-4 accent-[var(--accent)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[16px] font-medium">{f.name}</span>
                        <span className="block text-[13px] text-ink-2">
                          {f.model} · {f.location}
                        </span>
                        {f.notes && <span className="mt-1 block text-[13px] text-ink-2">{f.notes}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
            <div className="sticky bottom-0 flex gap-2 rounded-full bg-surface p-1.5 shadow-float">
              <button onClick={onClose} className="btn btn-secondary flex-1">
                {found.length ? "Skip" : "Close"}
              </button>
              {found.length > 0 && (
                <button
                  onClick={() => {
                    onDone({ found: chosen, by: mode === "upload" ? "you" : "Steward Bot" });
                    onClose();
                  }}
                  disabled={chosen.length === 0}
                  className="btn btn-primary flex-1"
                >
                  Add {chosen.length} {chosen.length === 1 ? "item" : "items"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
