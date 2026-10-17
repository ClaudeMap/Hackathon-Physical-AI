"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { draftPlans, getContext, listMessages, listTasks, saveTicketPatch, seedQueue, submitReport } from "@/lib/api";
import { actionIdsFor, applyPrefs, findRelatedTicket, loadInventory, officeNameFrom, rememberPrefs, taskToTicket, type LocalPrefs } from "@/lib/adapt";
import { OFFICE, TICKETS, type Ticket } from "@/lib/data";
import { AgentView } from "./AgentView";
import { ConnectorsView } from "./ConnectorsView";
import { InsightsView } from "./InsightsView";
import { OfficeView } from "./OfficeView";
import { SlackNotice } from "./SlackNotice";
import { TasksView } from "./TasksView";
import { Icon, PageTitle, SourceIcon, StewardMark } from "./ui";

type View = "tasks" | "ask" | "insights" | "office" | "connectors";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "tasks", label: "Tasks", icon: "tasks" },
  { id: "ask", label: "Agent", icon: "mic" },
  { id: "insights", label: "Analytics", icon: "insights" },
  { id: "office", label: "Office", icon: "office" },
  { id: "connectors", label: "Connectors", icon: "plug" },
];

// The server renders a neutral greeting; the client swaps in the time of day.
const noop = () => () => {};
const hourGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export function App() {
  const [view, setView] = useState<View>("tasks");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Ticket | null>(null);
  const [officeName, setOfficeName] = useState(OFFICE.name);
  const [source, setSource] = useState<"loading" | "api" | "mock">("loading");
  const greeting = useSyncExternalStore(noop, hourGreeting, () => "Hello");
  const prefs = useRef<Record<string, LocalPrefs>>({});
  const sourceRef = useRef(source);
  const writes = useRef(0);
  sourceRef.current = source;

  const refresh = useCallback(async () => {
    const stamp = writes.current;
    try {
      let tasks = await listTasks(true);
      if (tasks.length === 0) {
        await seedQueue();
        tasks = await listTasks(true);
      }
      if (tasks.some((task) => task.action_items.length === 0 && (task.status === "queued" || task.status === "ready"))) {
        await draftPlans();
        tasks = await listTasks(true);
      }
      const [context, messages] = await Promise.all([getContext(), listMessages()]);
      if (stamp !== writes.current) return null;
      loadInventory(context);
      const next = tasks.map((task) => applyPrefs(taskToTicket(task, context, messages), prefs.current[task.id]));
      setOfficeName(officeNameFrom(context));
      setTickets(next);
      setSource("api");
      sourceRef.current = "api";
      return next;
    } catch {
      if (sourceRef.current !== "api") {
        setTickets(TICKETS);
        setOfficeName(OFFICE.name);
        setSource("mock");
        sourceRef.current = "mock";
      }
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const poll = window.setInterval(() => void refresh(), 4000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [refresh]);

  const numericIds = tickets.flatMap((ticket) => {
    const match = /^STW-(\d+)$/.exec(ticket.id);
    return match ? [Number(match[1])] : [];
  });
  const nextId = `STW-${(numericIds.length ? Math.max(...numericIds) : 110) + 1}`;
  const needsYou = tickets.filter((t) => t.status === "new" || t.status === "in_progress").length;

  const update = (id: string, patch: Partial<Ticket>) => {
    const current = tickets.find((ticket) => ticket.id === id);
    if (current && patch.status === "done" && current.status !== "done") setNotice({ ...current, ...patch });
    prefs.current[id] = rememberPrefs(prefs.current[id] ?? {}, patch);
    setTickets((ts) => ts.map((ticket) => (ticket.id === id ? { ...ticket, ...patch } : ticket)));
    if (source !== "api" || !current) return;
    const persists = patch.severity || patch.status === "done" || patch.status === "escalated" || patch.stepsDone || patch.stepNotes;
    if (!persists) return;
    writes.current += 1;
    void saveTicketPatch(current, patch, actionIdsFor(id)).then((wrote) => {
      if (wrote) void refresh();
    });
  };

  const report = async (text: string) => {
    const related = sourceRef.current === "api" ? findRelatedTicket(tickets, text) : undefined;
    try {
      const queued = await submitReport(text, related?.id);
      const next = await refresh();
      const created = queued.find((task) => task.id === related?.id) ?? queued[0];
      const ticket = next?.find((item) => item.id === (related?.id ?? created?.id));
      if (!ticket) return null;
      return {
        id: ticket.id,
        merged: Boolean(related),
        summary: ticket.diagnosis,
        steps: ticket.steps,
        voiceLine: ticket.voiceLine,
        severity: ticket.severity,
        canSelfFix: ticket.canSelfFix,
      };
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-[1240px] grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:px-8">
          <div className="flex items-center gap-3">
            <StewardMark className="size-11" />
            <div className="leading-tight">
              <div className="text-[17px] font-medium">Steward</div>
              <div className="text-[13px] text-ink-2">{officeName}</div>
            </div>
          </div>

          <nav aria-label="Main" className="hidden gap-1 rounded-full bg-surface p-1.5 shadow-float md:flex">
            {NAV.map((n) => {
              const on = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full px-4 py-3 text-[15px] font-medium transition ${on ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"}`}
                >
                  <Icon name={n.icon} className="size-5" />
                  {n.label}
                  {n.id === "tasks" && needsYou > 0 && (
                    <span className={`grid min-w-5 place-items-center rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-surface/20" : "bg-surface-2"}`}>{needsYou}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-3">
            <span className="hidden items-center gap-2 whitespace-nowrap rounded-full bg-surface px-3.5 py-2 text-[13px] text-ink-2 shadow-card min-[1560px]:inline-flex">
              <SourceIcon s="slack" className="size-4" />
              {source === "api" ? "Live task queue" : "Listening in #office-help"}
              <span className="size-2 rounded-full bg-ink" />
            </span>
            <button onClick={() => setView("ask")} className="btn btn-primary btn-sm">
              <Icon name="plus" className="size-4" />
              <span className="hidden sm:inline">Report a problem</span>
              <span className="sm:hidden">Report</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-32 pt-2 md:px-8 md:pb-16">
        {view === "tasks" && (
          <>
            <PageTitle kicker={greeting} title={`${officeName} desk`} />
            <TasksView
              tickets={tickets}
              onUpdate={update}
              selectedId={selectedId}
              onSelect={setSelectedId}
              sourceLabel={source === "api" ? "Live queue" : source === "loading" ? "Connecting" : "Demo data"}
            />
          </>
        )}
        {view === "ask" && (
          <AgentView
            tickets={tickets}
            nextId={nextId}
            onUpdate={update}
            onReport={report}
            onCreate={(t) => setTickets((ts) => [t, ...ts])}
            onMerge={(id, r) =>
              setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, duplicates: [...(t.duplicates ?? []), r] } : t)))
            }
          />
        )}
        {view === "insights" && <InsightsView tickets={tickets} />}
        {view === "office" && <OfficeView tickets={tickets} />}
        {view === "connectors" && <ConnectorsView />}
      </main>

      {notice && <SlackNotice key={notice.id} t={notice} onClose={() => setNotice(null)} />}

      <nav
        aria-label="Main"
        className="fixed bottom-3.5 left-1/2 z-30 flex w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 gap-1 rounded-full bg-surface p-1.5 shadow-float md:hidden"
      >
        {NAV.map((n) => {
          const on = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              aria-label={n.label}
              aria-current={on ? "page" : undefined}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-3.5 text-[15px] font-medium transition ${on ? "flex-[2.2] bg-ink text-surface" : "text-ink-2"}`}
            >
              <Icon name={n.icon} className="size-5" />
              {on && n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
