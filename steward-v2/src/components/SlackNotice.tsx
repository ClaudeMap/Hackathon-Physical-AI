"use client";

import { useEffect } from "react";
import { OFFICE, type Ticket } from "@/lib/data";
import { Icon, SlackLogo, StewardMark } from "./ui";

// Preview of the message Steward posts to #office-help when a task is fixed.
// The real build sends this via Slack chat.postMessage in the original thread.
export function SlackNotice({ t, onClose }: { t: Ticket; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 9000);
    return () => clearTimeout(id);
  }, [onClose]);

  const reporters = [t.reporter, ...(t.duplicates ?? []).map((d) => d.reporter)].filter((r) => r !== "You" && !r.startsWith("Steward"));
  const fixer = t.assignee === "Unassigned" ? OFFICE.manager : t.assignee;

  return (
    <div className="fixed inset-x-3 bottom-20 z-30 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]" role="status">
      <div className="overflow-hidden rounded-3xl bg-surface shadow-float">
        <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-2 text-[13px] text-ink-2">
          <span className="flex items-center gap-2 font-medium">
            <SlackLogo className="size-3.5" /> Posted to #office-help
          </span>
          <button onClick={onClose} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Dismiss">
            <Icon name="x" className="size-3.5" />
          </button>
        </div>
        <div className="flex gap-3 p-4">
          <StewardMark className="size-9 shrink-0" />
          <div className="min-w-0 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">Steward</span>
              <span className="rounded bg-surface-2 px-1 text-[10px] font-medium text-ink-3">APP</span>
              <span className="text-[13px] text-ink-3">now</span>
            </div>
            <p className="mt-0.5">
              <span className="font-medium text-good">✓ Fixed:</span> {t.title} <span className="font-mono text-[13px] text-ink-3">{t.id}</span>
            </p>
            <p className="mt-1 text-ink-2">
              Resolved by {fixer}.{" "}
              {reporters.length > 0 && (
                <>
                  Thanks for reporting,{" "}
                  {reporters.map((r, i) => (
                    <span key={r}>
                      <span className="rounded bg-norm-soft px-0.5 text-norm">@{r.split(" ")[0]}</span>
                      {i < reporters.length - 1 ? " " : ""}
                    </span>
                  ))}
                  .
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
