// Parametric model of the Steward Bot handheld. All dimensions in millimetres.
// Front of the device faces +Z, top is +Y, right-hand edge is +X.
// Materials and details follow the brand guidelines: anodised aluminium body,
// stainless tools, Signal Yellow keys, visible Torx fasteners, etched icons.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const DIM = {
  W: 66, // width
  H: 112, // height
  SHELL_D: 14, // electronics shell depth, z from -5 to +9
  SHELL_Z: 2, // shell centre z
  TOOL_LEN: 46,
  PIVOT_Y: 49, // tool pivot distance from centre, top and bottom
  PLATE_H: 84,
};

export type ToolId = "driver" | "pry" | "grabber" | "voltage" | "soil" | "brush";

export type ToolSpec = {
  id: ToolId;
  name: string;
  end: "bottom" | "top";
  layer: 0 | 1 | 2; // 0 = outermost (visible through the cover)
  openAngle: number; // radians, positive = counter-clockwise
  fixes: string;
};

// Bottom three pivot from the bottom end, top three from the top end. Each end
// stacks three tools in the same z-layers, exactly like a Swiss Army knife.
export const TOOLS: ToolSpec[] = [
  { id: "driver", name: "Bit driver", end: "bottom", layer: 2, openAngle: Math.PI, fixes: "Screens need to be installed" },
  { id: "pry", name: "Pry tool", end: "bottom", layer: 1, openAngle: 2.45, fixes: "Panels, kick-plates, ceiling tiles" },
  { id: "grabber", name: "Jam grabber", end: "bottom", layer: 0, openAngle: -2.45, fixes: "Printer is not working" },
  { id: "voltage", name: "Voltage probe", end: "top", layer: 2, openAngle: Math.PI, fixes: "Fuse has gone" },
  { id: "soil", name: "Soil probe", end: "top", layer: 1, openAngle: 2.45, fixes: "Office plants are dying" },
  { id: "brush", name: "Brush & pick", end: "top", layer: 0, openAngle: -2.45, fixes: "Coffee machine is broken" },
];

export type ColourwayId = "natural" | "graphite" | "yellow" | "green";

// Anodised body colours from the brand guidelines. `key` is the push-to-talk key.
export const COLOURWAYS: { id: ColourwayId; name: string; body: number; metal: number; rough: number; key: number }[] = [
  { id: "natural", name: "Natural", body: 0xc4c9cd, metal: 0.9, rough: 0.5, key: 0xfcd303 },
  { id: "graphite", name: "Graphite", body: 0x4a4e52, metal: 0.85, rough: 0.55, key: 0xfcd303 },
  { id: "yellow", name: "Signal Yellow", body: 0xfcd303, metal: 0.5, rough: 0.5, key: 0x25282a },
  { id: "green", name: "Steward Green", body: 0x1f6f5c, metal: 0.5, rough: 0.5, key: 0xfcd303 },
];

const LAYER_Z = [-8.5, -7.3, -6.1]; // tool centre z, layer 0 is furthest back
const TOOL_T = 1.0;

export type Model = {
  root: THREE.Group;
  tools: Record<ToolId, THREE.Group>;
  barrel: THREE.Group;
  wheel: THREE.Group;
  parts: { obj: THREE.Object3D; explode: THREE.Vector3; base: THREE.Vector3 }[];
  shellMat: THREE.MeshPhysicalMaterial;
  voltageTip: THREE.MeshStandardMaterial;
  dock: THREE.Group;
  dockWheels: THREE.Object3D[];
  labels: { text: string; anchor: THREE.Vector3; normal: THREE.Vector3 }[];
  setColourway: (id: ColourwayId) => void;
  dispose: () => void;
};

const mat = {
  // Anodised aluminium, bead-blasted: metallic but matt.
  shell: () => new THREE.MeshPhysicalMaterial({ color: 0xc4c9cd, roughness: 0.5, metalness: 0.9, transparent: true }),
  graphite: () => new THREE.MeshStandardMaterial({ color: 0x25282a, roughness: 0.55, metalness: 0.3 }),
  // Brushed stainless steel.
  steel: () => new THREE.MeshStandardMaterial({ color: 0xc9ced1, roughness: 0.38, metalness: 1 }),
  darkSteel: () => new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.4, metalness: 1 }),
  // Polished steel: only on the pivot pins and the camera lens rings.
  polished: () => new THREE.MeshStandardMaterial({ color: 0xe3e6e8, roughness: 0.08, metalness: 1 }),
  copper: () => new THREE.MeshStandardMaterial({ color: 0xc87a4a, roughness: 0.3, metalness: 1 }),
  // Signal Yellow, anodised.
  signal: () => new THREE.MeshStandardMaterial({ color: 0xfcd303, roughness: 0.45, metalness: 0.35 }),
  black: () => new THREE.MeshStandardMaterial({ color: 0x0a0b0c, roughness: 0.25, metalness: 0.2 }),
  etch: () => new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0x0b0f12, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.35 }),
};

function makeMats() {
  return {
    shell: mat.shell(),
    graphite: mat.graphite(),
    steel: mat.steel(),
    darkSteel: mat.darkSteel(),
    polished: mat.polished(),
    copper: mat.copper(),
    signal: mat.signal(),
    black: mat.black(),
    etch: mat.etch(),
    glass: mat.glass(),
  };
}

// The device screen: a black card stack. One red card for the urgent job on top,
// aluminium cards for the rest with a severity dot, and a yellow hold-to-talk bar.
function drawScreen(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 520;
  c.height = 640;
  const g = c.getContext("2d")!;
  const sans = "system-ui, -apple-system, sans-serif";
  const mono = "ui-monospace, Menlo, monospace";
  g.fillStyle = "#050606";
  g.fillRect(0, 0, c.width, c.height);

  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  g.font = `600 34px ${sans}`;
  g.fillText("12:21", 28, 44);
  g.fillStyle = "#fcd303";
  g.beginPath();
  g.arc(452, 44, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.fillRect(470, 36, 26, 16);

  // Urgent card
  g.fillStyle = "#b4372b";
  g.beginPath();
  g.roundRect(24, 84, 472, 124, 22);
  g.fill();
  g.fillStyle = "#fff";
  g.font = `500 20px ${mono}`;
  g.globalAlpha = 0.85;
  g.fillText("CRITICAL · STW-118", 48, 112);
  g.globalAlpha = 1;
  g.font = `700 36px ${sans}`;
  g.fillText("Fuse tripped", 48, 150);
  g.font = `500 22px ${sans}`;
  g.globalAlpha = 0.9;
  g.fillText("Circuit 7 · 3 reports", 48, 184);
  g.globalAlpha = 1;

  const cards: [string, string, string][] = [
    ["#a8650c", "Wi-Fi, meeting rooms", "STW-117"],
    ["#3a5f8f", "Coffee machine", "STW-116"],
    ["#3a5f8f", "Printer", "STW-115"],
    ["#6b6e74", "Office plants", "STW-112"],
    ["#6b6e74", "Screens install", "STW-114"],
  ];
  let y = 224;
  for (const [dot, label, id] of cards) {
    g.fillStyle = "#e3e5e6";
    g.beginPath();
    g.roundRect(24, y, 472, 84, 24);
    g.fill();
    g.strokeStyle = "#050606";
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = dot;
    g.beginPath();
    g.arc(58, y + 30, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1c1d1f";
    g.textAlign = "left";
    g.font = `600 30px ${sans}`;
    g.fillText(label, 82, y + 30);
    g.textAlign = "right";
    g.fillStyle = "#55575c";
    g.font = `500 20px ${mono}`;
    g.fillText(id, 476, y + 30);
    g.textAlign = "left";
    y += 60;
  }

  // Hold-to-talk bar
  g.fillStyle = "#fcd303";
  g.beginPath();
  g.roundRect(24, 566, 472, 54, 27);
  g.fill();
  g.fillStyle = "#1c1d1f";
  g.beginPath();
  g.arc(70, 593, 9, 0, Math.PI * 2);
  g.fill();
  g.font = `600 26px ${sans}`;
  g.fillText("hold to talk", 96, 594);
  return c;
}

// The laser-etched mark and serial on the cover window, drawn as a transparent decal.
function drawDecal(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 560;
  c.height = 100;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(52, 50, 32, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(52, 50, 15, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = "destination-out";
  g.lineWidth = 5;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(44, 58);
  g.lineTo(60, 42);
  g.stroke();
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "600 40px ui-monospace, Menlo, monospace";
  g.textBaseline = "middle";
  g.fillText("No. 0042  steward", 112, 52);
  return c;
}

const poly = (pts: [number, number][]) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};

function plate(shape: THREE.Shape, m: THREE.Material, y0 = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: TOOL_T, bevelEnabled: false });
  geo.translate(0, y0, -TOOL_T / 2);
  const mesh = new THREE.Mesh(geo, m);
  return mesh;
}

// A set of polylines turned into thin flat quads: the etched line icons.
function strokeGeo(lines: [number, number][][], w = 0.45) {
  const pos: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i];
      const [x1, y1] = line[i + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * (w / 2);
      const ny = (dx / len) * (w / 2);
      pos.push(x0 + nx, y0 + ny, 0, x0 - nx, y0 - ny, 0, x1 + nx, y1 + ny, 0, x1 + nx, y1 + ny, 0, x0 - nx, y0 - ny, 0, x1 - nx, y1 - ny, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

const circle = (r: number, n = 18): [number, number][] => Array.from({ length: n + 1 }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r]);

// One icon per tool, in a single consistent line style. The jam grabber's is a
// frowning sheet of paper.
const ICONS: Record<ToolId, { y: number; lines: [number, number][][] }> = {
  voltage: { y: 14, lines: [[[1.2, 5], [-2.2, -0.4], [0.6, -0.4], [-1.2, -5], [2.4, 0.4], [-0.4, 0.4], [1.2, 5]]] },
  driver: { y: 14, lines: [circle(3.4), [[-1.8, 0], [1.8, 0]], [[0, -1.8], [0, 1.8]]] },
  pry: { y: 14, lines: [[[-3, -3], [3, -3], [0, 3], [-3, -3]]] },
  grabber: {
    y: 12,
    lines: [
      [[-2.4, -4], [2.4, -4], [2.4, 4], [-2.4, 4], [-2.4, -4]],
      [[-1.1, 1.4], [-1.1, 2.2]],
      [[1.1, 1.4], [1.1, 2.2]],
      [[-1.4, -1.6], [-0.7, -0.8], [0.7, -0.8], [1.4, -1.6]],
    ],
  },
  soil: { y: 12.5, lines: [[[0, 4.6], [-2.5, 0.4], [-2.5, -1.4], [0, -3.8], [2.5, -1.4], [2.5, 0.4], [0, 4.6]]] },
  brush: { y: 14, lines: [[[-2.5, -3], [-2.5, 3]], [[0, -3], [0, 3]], [[2.5, -3], [2.5, 3]]] },
};

function buildTool(spec: ToolSpec, mats: ReturnType<typeof makeMats>): { group: THREE.Group; tip?: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const steel = mats.steel;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, TOOL_T, 28).rotateX(Math.PI / 2), steel);
  g.add(head);
  let tip: THREE.MeshStandardMaterial | undefined;

  switch (spec.id) {
    case "driver":
      g.add(plate(poly([[-4, 0], [4, 0], [4, 26], [2.2, 46], [-2.2, 46], [-4, 26]]), steel));
      break;
    case "pry":
      g.add(plate(poly([[-4, 0], [4, 0], [4, 30], [7, 38], [7, 46], [-7, 46], [-7, 38], [-4, 30]]), steel));
      break;
    case "grabber":
      g.add(plate(poly([[-4, 0], [4, 0], [4, 46], [1.2, 46], [1.2, 22], [-1.2, 22], [-1.2, 46], [-4, 46]]), steel));
      break;
    case "voltage": {
      g.add(plate(poly([[-4, 0], [4, 0], [4, 34], [3, 36], [-3, 36], [-4, 34]]), steel));
      // The probe tip glows Signal Yellow when it senses voltage ("live" state).
      tip = new THREE.MeshStandardMaterial({ color: 0xfcd303, emissive: 0xfcd303, emissiveIntensity: 0.2, roughness: 0.4 });
      g.add(plate(poly([[-2.8, 36], [2.8, 36], [2.8, 46], [-2.8, 46]]), tip));
      break;
    }
    case "soil":
      g.add(plate(poly([[-4, 0], [4, 0], [4, 18], [1.2, 20], [-1.2, 20], [-4, 18]]), steel));
      g.add(plate(poly([[-1.2, 19], [1.2, 19], [1.2, 46], [0, 48 - 2], [-1.2, 46]]), mats.copper));
      break;
    case "brush":
      g.add(plate(poly([[-4, 0], [4, 0], [4, 24], [-4, 24]]), steel));
      g.add(plate(poly([[-4, 24], [4, 24], [4, 38], [-4, 38]]), mats.black));
      g.add(plate(poly([[-1, 38], [1, 38], [1, 46], [0, 46]]), steel));
      break;
  }
  // Pin hole disc
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, TOOL_T + 0.05, 16).rotateX(Math.PI / 2), mats.darkSteel);
  g.add(hole);

  // Etched icon on the face you see from the back of the device (-z). Mirrored
  // in x so it reads correctly when viewed from behind.
  const icon = ICONS[spec.id];
  const etch = new THREE.Mesh(strokeGeo(icon.lines), mats.etch);
  etch.position.set(0, icon.y, -TOOL_T / 2 - 0.02);
  etch.scale.x = -1;
  g.add(etch);
  return { group: g, tip };
}

export function buildModel(): Model {
  const { W, H, SHELL_D, SHELL_Z, PIVOT_Y, PLATE_H } = DIM;
  const mats = makeMats();
  const root = new THREE.Group();
  const parts: Model["parts"] = [];
  const disposables: { dispose: () => void }[] = Object.values(mats);

  const addPart = (obj: THREE.Object3D, explode: [number, number, number]) => {
    root.add(obj);
    parts.push({ obj, explode: new THREE.Vector3(...explode), base: obj.position.clone() });
  };
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material) => {
    disposables.push(geo);
    return new THREE.Mesh(geo, m);
  };

  // The push-to-talk key changes with the colourway (dark on the yellow body).
  const keyMat = mats.signal.clone();
  disposables.push(keyMat);

  // --- Shell -------------------------------------------------------------
  const shell = new THREE.Group();
  const shellBody = mesh(new RoundedBoxGeometry(W, H, SHELL_D, 6, 6.5), mats.shell);
  shellBody.position.z = SHELL_Z;
  shell.add(shellBody);
  // mic holes + speaker slots below the screen
  const holeGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.4, 12).rotateX(Math.PI / 2);
  for (const x of [-22, -17, 17, 22]) {
    const h = mesh(holeGeo, mats.black);
    h.position.set(x, -46, 9.05);
    shell.add(h);
  }
  const slotGeo = new THREE.BoxGeometry(1.1, 6, 0.4);
  for (let i = -3; i <= 3; i++) {
    const s = mesh(slotGeo, mats.black);
    s.position.set(i * 3, -46, 9.05);
    shell.add(s);
  }
  // status LED
  const led = mesh(new THREE.CylinderGeometry(1, 1, 0.4, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6cc68a, emissive: 0x6cc68a, emissiveIntensity: 1.2 }));
  led.position.set(0, -38, 9.05);
  shell.add(led);
  // USB-C on the left edge, SIM pinhole
  const usb = mesh(new RoundedBoxGeometry(0.8, 3.2, 9, 2, 1.2), mats.black);
  usb.position.set(-W / 2 + 0.1, -22, SHELL_Z);
  shell.add(usb);
  const usbIn = mesh(new THREE.BoxGeometry(0.9, 1.6, 6.5), mats.darkSteel);
  usbIn.position.set(-W / 2 - 0.05, -22, SHELL_Z);
  shell.add(usbIn);
  const sim = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.6, 12).rotateZ(Math.PI / 2), mats.black);
  sim.position.set(-W / 2, 12, SHELL_Z);
  shell.add(sim);
  addPart(shell, [0, 0, 0]);

  // --- Display module ----------------------------------------------------
  const display = new THREE.Group();
  const bezel = mesh(new RoundedBoxGeometry(58, 74, 1.4, 4, 3), mats.black);
  bezel.position.set(0, 6, 9.4);
  display.add(bezel);
  const tex = new THREE.CanvasTexture(drawScreen());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  disposables.push(tex);
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  disposables.push(screenMat);
  const screen = mesh(new THREE.PlaneGeometry(52, 64), screenMat);
  screen.position.set(0, 6, 10.12);
  display.add(screen);
  const glass = mesh(new RoundedBoxGeometry(58, 74, 0.3, 2, 0.14), mats.glass);
  glass.position.set(0, 6, 10.3);
  display.add(glass);
  addPart(display, [0, 0, 36]);

  // --- Internals (visible when exploded) --------------------------------
  const pcb = new THREE.Group();
  const board = mesh(new THREE.BoxGeometry(54, 96, 1.4), new THREE.MeshStandardMaterial({ color: 0x14573f, roughness: 0.6 }));
  disposables.push(board.material as THREE.Material);
  pcb.add(board);
  const chipMat = new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.4 });
  disposables.push(chipMat);
  for (const [x, y, w, h] of [[-8, 22, 14, 14], [12, 28, 9, 9], [-14, -4, 8, 12], [10, -10, 12, 8], [0, -32, 20, 6]] as number[][]) {
    const chip = mesh(new THREE.BoxGeometry(w, h, 1.2), chipMat);
    chip.position.set(x, y, 1.2);
    pcb.add(chip);
  }
  pcb.position.set(0, 0, 3.4);
  addPart(pcb, [0, 0, 18]);

  const battery = mesh(new RoundedBoxGeometry(48, 62, 4.5, 2, 1.2), new THREE.MeshStandardMaterial({ color: 0xcfd3d5, roughness: 0.5, metalness: 0.6 }));
  disposables.push(battery.material as THREE.Material);
  battery.position.set(0, -4, -1.5);
  addPart(battery, [0, 0, -13]);

  // --- 360 camera barrel (dual fisheye): brushed steel, polished lens rings ---
  const barrel = new THREE.Group();
  const cyl = mesh(new THREE.CylinderGeometry(7, 7, 34, 40).rotateZ(Math.PI / 2), mats.steel);
  barrel.add(cyl);
  for (const sx of [-1, 1]) {
    const cap = mesh(new THREE.CylinderGeometry(7.4, 7.4, 1.2, 40).rotateZ(Math.PI / 2), mats.darkSteel);
    cap.position.x = sx * 17.4;
    barrel.add(cap);
  }
  for (const sz of [-1, 1]) {
    const ring = mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.8, 32).rotateX(Math.PI / 2), mats.polished);
    ring.position.set(0, 0, sz * 7.0);
    barrel.add(ring);
    const lens = mesh(new THREE.SphereGeometry(3.4, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(sz > 0 ? Math.PI / 2 : -Math.PI / 2), mats.black);
    lens.position.set(0, 0, sz * 7.2);
    barrel.add(lens);
    const glint = mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.1, metalness: 0.6 }));
    glint.scale.set(1, 1, 0.3);
    glint.position.set(0.8, 0.8, sz * 10.2);
    barrel.add(glint);
  }
  barrel.position.set(0, H / 2 - 4, 4);
  addPart(barrel, [0, 24, 6]);

  // --- Scroll wheel (knurled steel) + push-to-talk key -------------------
  const wheel = new THREE.Group();
  const wheelBody = mesh(new THREE.CylinderGeometry(7, 7, 6, 40).rotateX(Math.PI / 2), mats.steel);
  wheel.add(wheelBody);
  const ridgeGeo = new THREE.BoxGeometry(1.1, 1.4, 6.2);
  disposables.push(ridgeGeo);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = new THREE.Mesh(ridgeGeo, mats.darkSteel);
    r.position.set(Math.cos(a) * 7, Math.sin(a) * 7, 0);
    r.rotation.z = a;
    wheel.add(r);
  }
  const hub = mesh(new THREE.CylinderGeometry(2.6, 2.6, 6.4, 24).rotateX(Math.PI / 2), mats.signal);
  wheel.add(hub);
  const wheelHolder = new THREE.Group();
  wheelHolder.add(wheel);
  wheelHolder.position.set(W / 2 - 3, 12, SHELL_Z);
  addPart(wheelHolder, [24, 0, 0]);

  const ptt = mesh(new RoundedBoxGeometry(3.4, 18, 8, 3, 1.4), keyMat);
  ptt.position.set(W / 2 + 0.3, -14, SHELL_Z);
  const grooveGeo = new THREE.BoxGeometry(0.3, 0.5, 6.4);
  disposables.push(grooveGeo);
  for (let i = -3; i <= 3; i++) {
    const gr = new THREE.Mesh(grooveGeo, mats.graphite);
    gr.position.set(1.7, i * 2.2, 0);
    ptt.add(gr);
  }
  addPart(ptt, [24, 0, 0]);

  // --- Tool spine --------------------------------------------------------
  const toolGroups = {} as Record<ToolId, THREE.Group>;
  let voltageTip!: THREE.MeshStandardMaterial;
  const pinGeo = new THREE.CylinderGeometry(1.5, 1.5, 5.6, 20).rotateX(Math.PI / 2);
  const headGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.8, 24).rotateX(Math.PI / 2);
  disposables.push(pinGeo, headGeo);

  for (const spec of TOOLS) {
    const { group, tip } = buildTool(spec, mats);
    if (tip) {
      voltageTip = tip;
      disposables.push(tip);
    }
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.userData.toolId = spec.id;
        disposables.push((o as THREE.Mesh).geometry);
      }
    });
    const holder = new THREE.Group();
    const sign = spec.end === "bottom" ? -1 : 1;
    holder.position.set(0, sign * PIVOT_Y, LAYER_Z[spec.layer]);
    holder.rotation.z = spec.end === "bottom" ? 0 : Math.PI; // folded
    holder.add(group);
    holder.userData.fold = holder.rotation.z;
    toolGroups[spec.id] = holder;
    addPart(holder, [0, 0, -30 - (2 - spec.layer) * 4]);
  }
  // pivot pins (one per end), polished heads
  for (const sign of [-1, 1]) {
    const pin = mesh(pinGeo, mats.darkSteel);
    pin.position.set(0, sign * PIVOT_Y, -7.8);
    const ph = mesh(headGeo, mats.polished);
    ph.position.set(0, sign * PIVOT_Y, -10.6);
    const pg = new THREE.Group();
    pg.add(pin, ph);
    pg.position.set(0, 0, 0);
    addPart(pg, [0, 0, -52]);
  }

  // Cover window with four Torx screws and the etched mark. The screws sit at
  // x = +-30, y = +-10, outside the arc every tool sweeps through.
  const coverGroup = new THREE.Group();
  const coverMat = new THREE.MeshPhysicalMaterial({ color: 0x0f1513, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.62, clearcoat: 1 });
  disposables.push(coverMat);
  const cover = mesh(new RoundedBoxGeometry(W - 1, PLATE_H, 1.4, 3, 0.6), coverMat);
  cover.position.set(0, 0, -9.9);
  coverGroup.add(cover);

  const screwHeadGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.8, 24).rotateX(Math.PI / 2);
  const postGeo = new THREE.CylinderGeometry(1, 1, 5.6, 16).rotateX(Math.PI / 2);
  const starPts: [number, number][] = Array.from({ length: 12 }, (_, i) => {
    const r = i % 2 ? 0.7 : 1.25;
    const a = (i / 12) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  const starGeo = new THREE.ShapeGeometry(poly(starPts));
  disposables.push(screwHeadGeo, postGeo, starGeo);
  for (const sx of [-30, 30]) {
    for (const sy of [-10, 10]) {
      const head = new THREE.Mesh(screwHeadGeo, mats.steel);
      head.position.set(sx, sy, -11.0);
      const post = new THREE.Mesh(postGeo, mats.darkSteel);
      post.position.set(sx, sy, -7.8);
      const star = new THREE.Mesh(starGeo, mats.etch);
      star.position.set(sx, sy, -11.42);
      coverGroup.add(head, post, star);
    }
  }

  const decalTex = new THREE.CanvasTexture(drawDecal());
  decalTex.colorSpace = THREE.SRGBColorSpace;
  decalTex.anisotropy = 8;
  disposables.push(decalTex);
  const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  disposables.push(decalMat);
  const decal = mesh(new THREE.PlaneGeometry(56, 10), decalMat);
  decal.rotation.y = Math.PI; // faces -z so it reads correctly from the back
  decal.position.set(0, 0, -10.64);
  coverGroup.add(decal);
  addPart(coverGroup, [0, 0, -42]);

  // --- Robot dock (rover base) ------------------------------------------
  const dock = new THREE.Group();
  const chassis = mesh(new RoundedBoxGeometry(128, 30, 96, 6, 9), mats.graphite);
  chassis.position.set(0, -88, 8);
  dock.add(chassis);
  const topPlate = mesh(new RoundedBoxGeometry(92, 8, 40, 4, 3), mats.shell);
  topPlate.position.set(0, -70, -2);
  dock.add(topPlate);
  const cradleL = mesh(new RoundedBoxGeometry(4, 22, 26, 2, 1.5), mats.shell);
  cradleL.position.set(-37, -62, SHELL_Z - 2);
  const cradleR = cradleL.clone();
  cradleR.position.x = 37;
  dock.add(cradleL, cradleR);
  const lidar = mesh(new THREE.CylinderGeometry(15, 15, 9, 40), mats.black);
  lidar.position.set(0, -69, 40);
  const lidarRing = mesh(new THREE.TorusGeometry(15.2, 1, 12, 48).rotateX(Math.PI / 2), mats.signal);
  lidarRing.position.set(0, -66, 40);
  dock.add(lidar, lidarRing);
  const dockWheels: THREE.Object3D[] = [];
  const wheelGeo = new THREE.CylinderGeometry(17, 17, 12, 36).rotateZ(Math.PI / 2);
  const tyreGeo = new THREE.TorusGeometry(16, 3.2, 12, 40).rotateY(Math.PI / 2);
  disposables.push(wheelGeo, tyreGeo);
  for (const sx of [-1, 1]) {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(wheelGeo, mats.darkSteel), new THREE.Mesh(tyreGeo, mats.black));
    w.position.set(sx * 68, -92, 8);
    dock.add(w);
    dockWheels.push(w);
  }
  dock.visible = false;
  root.add(dock);

  const labels: Model["labels"] = [
    { text: "360° dual-fisheye camera", anchor: new THREE.Vector3(0, H / 2 + 3, 8), normal: new THREE.Vector3(0, 1, 0.5) },
    { text: "2.8″ touch display", anchor: new THREE.Vector3(-22, 30, 10.5), normal: new THREE.Vector3(0, 0, 1) },
    { text: "Scroll wheel", anchor: new THREE.Vector3(W / 2 + 4, 12, SHELL_Z), normal: new THREE.Vector3(1, 0, 0) },
    { text: "Push-to-talk", anchor: new THREE.Vector3(W / 2 + 2, -14, SHELL_Z), normal: new THREE.Vector3(1, 0, 0) },
    { text: "Mics + speaker", anchor: new THREE.Vector3(-16, -46, 9.2), normal: new THREE.Vector3(0, 0, 1) },
    { text: "USB-C", anchor: new THREE.Vector3(-W / 2 - 0.5, -22, SHELL_Z), normal: new THREE.Vector3(-1, 0, 0) },
    { text: "Tool spine (6 tools)", anchor: new THREE.Vector3(0, -30, -10.8), normal: new THREE.Vector3(0, 0, -1) },
    { text: "Torx screws", anchor: new THREE.Vector3(30, 10, -11.6), normal: new THREE.Vector3(0, 0, -1) },
  ];

  const setColourway = (id: ColourwayId) => {
    const cw = COLOURWAYS.find((c) => c.id === id) ?? COLOURWAYS[0];
    mats.shell.color.setHex(cw.body);
    mats.shell.metalness = cw.metal;
    mats.shell.roughness = cw.rough;
    keyMat.color.setHex(cw.key);
  };
  setColourway("natural");

  return {
    root,
    tools: toolGroups,
    barrel,
    wheel,
    parts,
    shellMat: mats.shell,
    voltageTip,
    dock,
    dockWheels,
    labels,
    setColourway,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
