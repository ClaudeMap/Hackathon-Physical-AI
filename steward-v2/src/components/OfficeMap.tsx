"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { DESKS, ROOMS, type Item, type Pin, type Severity, type Ticket } from "@/lib/data";
import { Icon, SeverityBadge } from "./ui";

// A CSS-3D floor plan. The floor is a 600×400 plane tilted with rotateX and
// spun with rotateZ; walls and desks stand up out of it, and pins counter-rotate
// so they always face the viewer.

const FLOOR_W = 600;
const FLOOR_H = 400;
const WALL = 30;
const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, normal: 2, low: 3 };
const PIN_BG: Record<Severity | "ok", string> = {
  critical: "var(--ink)",
  high: "var(--ink)",
  normal: "var(--ink)",
  low: "var(--ink)",
  ok: "var(--surface)",
};

// The bot walks the aisles and stops at the Wi-Fi access point, the plants and the printer.
// Percentages are cumulative walking time at ~55px/s plus a 2s pause at each stop.
const P = (x: number, y: number) => `transform:translate3d(${x}px,${y}px,2px)`;
const PATROL_CSS = `@keyframes steward-patrol{
0%{${P(205, 135)}}8.8%,15.5%{${P(350, 135)}}18.3%{${P(397, 135)}}25.6%,32.2%{${P(397, 255)}}39.7%{${P(397, 378)}}50.6%,57.3%{${P(577, 378)}}72%{${P(577, 135)}}94.5%,100%{${P(205, 135)}}}
@keyframes steward-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.steward-bot{animation:steward-patrol 30s linear infinite}
.steward-bot-body{animation:steward-bob .7s ease-in-out infinite}`;

const abs: CSSProperties = { position: "absolute", transformStyle: "preserve-3d" };

function Wall({ x, y, len, axis, h = WALL }: { x: number; y: number; len: number; axis: "x" | "y"; h?: number }) {
  const style: CSSProperties =
    axis === "x"
      ? { ...abs, left: x, top: y, width: len, height: h, transformOrigin: "top", transform: "rotateX(90deg)" }
      : { ...abs, left: x, top: y, width: h, height: len, transformOrigin: "left", transform: "rotateY(-90deg)" };
  return <div style={{ ...style, background: "color-mix(in oklab, var(--ink-3) 22%, var(--surface))", border: "1px solid color-mix(in oklab, var(--ink-3) 45%, var(--surface))", opacity: 0.92 }} />;
}

// A box standing on the floor (or lifted by `z`). `front` colours the south face, e.g. a screen.
function Box({ x, y, w, d, h, z = 0, top, side, front }: { x: number; y: number; w: number; d: number; h: number; z?: number; top: string; side: string; front?: string }) {
  const face = (s: CSSProperties, bg = side) => <div style={{ ...abs, background: bg, ...s }} />;
  const lift = z ? `translateZ(${z}px) ` : "";
  return (
    <>
      {face({ left: x, top: y + d, width: w, height: h, transformOrigin: "top", transform: `${lift}rotateX(90deg)` }, front ?? side)}
      {face({ left: x, top: y, width: w, height: h, transformOrigin: "top", transform: `${lift}rotateX(90deg)` })}
      {face({ left: x, top: y, width: h, height: d, transformOrigin: "left", transform: `${lift}rotateY(-90deg)` })}
      {face({ left: x + w, top: y, width: h, height: d, transformOrigin: "left", transform: `${lift}rotateY(-90deg)` })}
      <div style={{ ...abs, left: x, top: y, width: w, height: d, background: top, transform: `translateZ(${z + h}px)`, borderRadius: 3 }} />
    </>
  );
}

const DESK_SIDE = "color-mix(in oklab, var(--ink-3) 35%, var(--surface))";
const CHAIR_SIDE = "color-mix(in oklab, var(--ink-2) 70%, black)";
const SCREEN = "linear-gradient(135deg, #b5e3ff, #4a8df0)";

// A 60×34 desk with a monitor and keyboard on it and a chair pulled up on the south side.
function Desk({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box x={x} y={y} w={60} d={34} h={12} top="var(--surface)" side={DESK_SIDE} />
      <Box x={x + 27} y={y + 8} w={6} d={4} h={3} z={12} top="#2a2c2f" side="#2a2c2f" />
      <Box x={x + 15} y={y + 5} w={30} d={2} h={14} z={15} top="#2a2c2f" side="#2a2c2f" front={SCREEN} />
      <Box x={x + 18} y={y + 20} w={24} d={8} h={1.5} z={12} top="#d9dcd5" side="#b8bcb4" />
      <Box x={x + 28} y={y + 45} w={4} d={4} h={8} top={CHAIR_SIDE} side={CHAIR_SIDE} />
      <Box x={x + 21} y={y + 38} w={18} d={18} h={3} z={8} top="var(--ink-2)" side={CHAIR_SIDE} />
      <Box x={x + 21} y={y + 53} w={18} d={3} h={12} z={11} top="var(--ink-2)" side={CHAIR_SIDE} />
    </>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function OfficeMap({
  tickets,
  items,
  pins,
  scanned,
  onMovePin,
  onPlace,
  onReset,
}: {
  tickets: Ticket[];
  items: Item[];
  pins: Pin[];
  scanned: string;
  onMovePin: (itemId: string, x: number, y: number) => void;
  onPlace: (itemId: string) => void;
  onReset: () => void;
}) {
  const [rot, setRot] = useState(-32);
  const [tilt, setTilt] = useState(56);
  const [selected, setSelected] = useState<string | null>("fuse");
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const floor = useRef<HTMLDivElement>(null);
  const prevView = useRef({ rot: -32, tilt: 56 });
  const grab = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const drag = useRef<{ x: number; y: number; rot: number; tilt: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.max(0.42, Math.min(1.05, e.contentRect.width / 920))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const worst = (itemId: string): Severity | "ok" => {
    const open = tickets.filter((t) => t.itemId === itemId && t.status !== "done");
    if (!open.length) return "ok";
    return open.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])[0].severity;
  };

  const billboard: CSSProperties = { ...abs, transform: `rotateZ(${-rot}deg) rotateX(${-tilt}deg)` };
  const itemOf = (id: string) => items.find((i) => i.id === id);
  const sel = selected && !editing ? itemOf(selected) : null;
  const unplaced = items.filter((i) => !pins.some((p) => p.itemId === i.id));

  // Edit layout works from a flat top-down view so a pointer maps straight onto the floor.
  const startEdit = () => {
    prevView.current = { rot, tilt };
    setRot(0);
    setTilt(0);
    setSelected(null);
    setSaved(false);
    setEditing(true);
  };
  const finishEdit = () => {
    setEditing(false);
    setRot(prevView.current.rot);
    setTilt(prevView.current.tilt);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const floorPoint = (e: React.PointerEvent, dx: number, dy: number) => {
    const r = floor.current!.getBoundingClientRect();
    const k = r.width / FLOOR_W;
    return {
      x: clamp(Math.round((e.clientX - dx - r.left) / k / 5) * 5, 8, FLOOR_W - 8),
      y: clamp(Math.round((e.clientY - dy - r.top) / k / 5) * 5, 8, FLOOR_H - 8),
    };
  };
  const selTickets = selected ? tickets.filter((t) => t.itemId === selected && t.status !== "done") : [];

  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="text-sm">
          <span className="font-medium">Floor 2</span>
          <span className="text-ink-3">
            {" "}
            · {editing ? "drag items to where they really are" : `mapped ${scanned} · ${pins.length} items on the map`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button onClick={onReset} className="btn btn-secondary btn-sm">
                Reset
              </button>
              <button onClick={finishEdit} className="btn btn-primary btn-sm">
                Done
              </button>
            </>
          ) : (
            <>
              {saved && <span className="mr-1 text-[13px] text-good">Layout saved (demo)</span>}
              <MapBtn onClick={() => setRot((r) => r - 45)} label="Rotate left"><Icon name="rotl" className="size-4" /></MapBtn>
              <MapBtn onClick={() => setRot((r) => r + 45)} label="Rotate right"><Icon name="rotr" className="size-4" /></MapBtn>
              <MapBtn onClick={() => setTilt((t) => (t > 10 ? 0 : 56))} label="Toggle top view">
                {tilt > 10 ? "2D" : "3D"}
              </MapBtn>
              <button onClick={startEdit} className="btn btn-secondary btn-sm ml-1">
                <Icon name="edit" className="size-4" /> Edit layout
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        <div
          ref={wrap}
          className={`relative h-[340px] touch-none select-none sm:h-[440px] ${editing ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
          style={{ perspective: 1600 }}
          onPointerDown={(e) => {
            if (editing) return;
            drag.current = { x: e.clientX, y: e.clientY, rot, tilt };
            setDragging(true);
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const d = drag.current;
            setRot(d.rot + (e.clientX - d.x) * 0.4);
            setTilt(Math.max(0, Math.min(70, d.tilt - (e.clientY - d.y) * 0.3)));
          }}
          onPointerUp={() => {
            drag.current = null;
            setDragging(false);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
          }}
        >
          <div
            ref={floor}
            style={{
              ...abs,
              left: "50%",
              top: "50%",
              width: FLOOR_W,
              height: FLOOR_H,
              marginLeft: -FLOOR_W / 2,
              marginTop: -FLOOR_H / 2,
              transform: `scale(${scale}) rotateX(${tilt}deg) rotateZ(${rot}deg)`,
              transition: dragging ? "none" : "transform 0.5s cubic-bezier(.2,.8,.2,1)",
            }}
          >
            {/* floor */}
            <div
              style={{
                ...abs,
                inset: 0,
                borderRadius: 6,
                background:
                  "repeating-linear-gradient(0deg, transparent 0 39px, var(--line) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, var(--line) 39px 40px), var(--surface-2)",
                boxShadow: "0 0 0 1px var(--line)",
              }}
            />

            {/* patrol route */}
            <svg width={FLOOR_W} height={FLOOR_H} style={{ ...abs, left: 0, top: 0, transform: "translateZ(0.5px)", pointerEvents: "none" }}>
              <polyline
                points="205,135 397,135 397,378 577,378 577,135 205,135"
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="6 6"
                opacity={0.5}
              />
            </svg>

            {ROOMS.map((r) => (
              <Fragment key={r.id}>
                <div
                  style={{
                    ...abs,
                    left: r.x,
                    top: r.y,
                    width: r.w,
                    height: r.h,
                    background: "var(--surface)",
                    transform: "translateZ(0.3px)",
                  }}
                >
                  <span style={{ position: "absolute", left: 8, top: 6, fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>{r.name}</span>
                </div>
                <Wall x={r.x} y={r.y} len={r.w} axis="x" />
                <Wall x={r.x} y={r.y + r.h} len={r.w} axis="x" h={r.id.startsWith("mr") ? WALL : 14} />
                <Wall x={r.x} y={r.y} len={r.h} axis="y" />
                <Wall x={r.x + r.w} y={r.y} len={r.h} axis="y" />
              </Fragment>
            ))}

            <span style={{ position: "absolute", left: 210, top: 120, fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>Open plan</span>

            {DESKS.map((d, i) => (
              <Desk key={i} x={d.x} y={d.y} />
            ))}
            <Box x={10} y={10} w={160} d={22} h={16} top="var(--surface)" side={DESK_SIDE} />

            {/* robot: a small lime bot that walks the patrol route */}
            <style>{PATROL_CSS}</style>
            <div className="steward-bot" style={{ ...abs, left: 0, top: 0, width: 0, height: 0 }}>
              <div style={{ ...abs, left: -13, top: -5, width: 26, height: 10, borderRadius: 999, background: "rgba(18,20,18,0.28)", filter: "blur(2px)", transform: "translateZ(0.6px)" }} />
              <div style={billboard}>
                <div className="steward-bot-body -translate-x-1/2 -translate-y-full">
                  <div className="mx-auto mb-1.5 w-fit whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-medium text-bg">Steward Bot</div>
                  <div className="relative mx-auto h-[26px] w-[30px] rounded-[10px] bg-lime ring-2 ring-ink">
                    <span className="absolute -top-[8px] left-1/2 h-[7px] w-[2px] -translate-x-1/2 bg-ink" />
                    <span className="absolute -top-[11px] left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-ink" />
                    <span className="absolute left-[7px] top-[9px] size-[4px] rounded-full bg-ink" />
                    <span className="absolute right-[7px] top-[9px] size-[4px] rounded-full bg-ink" />
                  </div>
                  <div className="mx-auto h-[4px] w-[22px] rounded-b-md bg-ink" />
                </div>
              </div>
            </div>

            {pins.map((p) => {
              const item = itemOf(p.itemId);
              if (!item) return null;
              const s = worst(p.itemId);
              const active = selected === p.itemId;
              return (
                <div key={p.itemId} style={{ ...abs, left: p.x, top: p.y, width: 0, height: 0, transform: `translateZ(${editing ? 40 : 2}px)` }}>
                  <div style={{ ...abs, left: -5, top: -5, width: 10, height: 10, borderRadius: 999, background: s === "ok" ? "var(--ink-faint)" : "var(--ink)", transform: "translateZ(1px)" }} />
                  <div style={billboard}>
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (!editing) return;
                        const r = floor.current!.getBoundingClientRect();
                        const k = r.width / FLOOR_W;
                        grab.current = { id: p.itemId, dx: e.clientX - (r.left + p.x * k), dy: e.clientY - (r.top + p.y * k) };
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setMoving(p.itemId);
                      }}
                      onPointerMove={(e) => {
                        const g = grab.current;
                        if (!editing || !g || g.id !== p.itemId) return;
                        const pt = floorPoint(e, g.dx, g.dy);
                        onMovePin(p.itemId, pt.x, pt.y);
                      }}
                      onPointerUp={() => {
                        grab.current = null;
                        setMoving(null);
                      }}
                      onPointerCancel={() => {
                        grab.current = null;
                        setMoving(null);
                      }}
                      onClick={() => !editing && setSelected(active ? null : p.itemId)}
                      aria-label={editing ? `Move ${item.name}` : item.name}
                      className={`flex -translate-x-1/2 -translate-y-full flex-col items-center ${editing ? "touch-none cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <span
                        className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium shadow-md transition ${
                          active ? "scale-110 ring-2 ring-ink" : ""
                        } ${editing ? "ring-2 ring-ink/40" : ""} ${moving === p.itemId ? "scale-110 ring-ink" : ""}`}
                        style={{ background: PIN_BG[s], color: s === "ok" ? "var(--ink)" : "#fff" }}
                      >
                        {s !== "ok" && s !== "low" && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
                        {p.label ?? item.name.split(" (")[0]}
                      </span>
                      <span className="h-7 w-px" style={{ background: s === "ok" ? "var(--ink-faint)" : "var(--ink)" }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {editing && (
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded-3xl bg-surface/95 p-3 text-[13px] shadow-float backdrop-blur">
            <span className="font-medium">Not on the map yet</span>
            {unplaced.length === 0 ? (
              <span className="text-ink-2">Everything is placed. Re-scan the office to find more.</span>
            ) : (
              unplaced.map((i) => (
                <button key={i.id} onClick={() => onPlace(i.id)} className="rounded-full bg-surface-2 px-3 py-1 font-medium hover:bg-line">
                  + {i.name}
                </button>
              ))
            )}
          </div>
        )}

        <div className={`pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-surface/90 px-2.5 py-1.5 text-[11px] text-ink-2 backdrop-blur ${editing ? "hidden" : ""}`}>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-ink" /> Open issue
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-surface ring-1 ring-ink-faint" /> All good
          </span>
          <span className="hidden text-ink-3 sm:inline">· drag to rotate</span>
        </div>

        {sel && (
          <div className="absolute right-3 top-3 w-64 max-w-[calc(100%-24px)] rounded-3xl bg-surface/95 p-4 text-[15px] shadow-float backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] text-ink-3">{sel.location}</div>
                <div className="font-medium">{sel.name}</div>
                <div className="text-[13px] text-ink-2">{sel.model}</div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded p-1 text-ink-3 hover:text-ink" aria-label="Close">
                <Icon name="x" className="size-3.5" />
              </button>
            </div>
            {selTickets.length ? (
              <ul className="mt-2 space-y-1.5 border-t border-line pt-2">
                {selTickets.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2">
                    <span className="text-[13px]">{t.title}</span>
                    <SeverityBadge s={t.severity} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 border-t border-line pt-2 text-[13px] text-good">No open issues</p>
            )}
            <div className="mt-2 text-[13px] text-ink-3">
              {sel.support.name} · <span className="font-mono">{sel.support.phone}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MapBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid h-9 min-w-9 place-items-center rounded-full bg-surface-2 px-2.5 text-[13px] font-medium text-ink-2 hover:bg-line hover:text-ink">
      {children}
    </button>
  );
}
