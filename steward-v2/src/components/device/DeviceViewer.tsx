"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { buildModel, TOOLS, type ColourwayId, type ToolId } from "./model";

export type ViewerState = {
  exploded: boolean;
  open: Record<ToolId, boolean>;
  cameraDeg: number; // barrel rotation
  docked: boolean;
  labels: boolean;
  spin: boolean;
  colourway: ColourwayId;
};

export type ViewerHandle = { exportSTL: () => void; resetView: () => void };

type Props = { state: ViewerState; onToolClick: (id: ToolId) => void };

const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));

export const DeviceViewer = forwardRef<ViewerHandle, Props>(function DeviceViewer({ state, onToolClick }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const labelLayer = useRef<HTMLDivElement>(null);
  const live = useRef({ state, onToolClick });
  live.current = { state, onToolClick };
  const api = useRef<ViewerHandle>({ exportSTL: () => {}, resetView: () => {} });
  useImperativeHandle(ref, () => ({ exportSTL: () => api.current.exportSTL(), resetView: () => api.current.resetView() }), []);

  useEffect(() => {
    const el = host.current!;
    const layer = labelLayer.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(80, 140, 160);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(32, 1, 5, 2000);
    const HOME = new THREE.Vector3(130, 80, 290);
    camera.position.copy(HOME);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 120;
    controls.maxDistance = 700;
    controls.autoRotateSpeed = 1.1;

    const model = buildModel();
    scene.add(model.root);

    // Soft contact shadow under the device
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const sg = shadowCanvas.getContext("2d")!;
    const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, "rgba(0,0,0,0.18)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -128;
    scene.add(shadow);

    // Labels
    const labelEls = model.labels.map((l) => {
      const d = document.createElement("div");
      d.style.cssText = "position:absolute;left:0;top:0;display:flex;align-items:center;gap:6px;white-space:nowrap;opacity:0;transition:opacity .25s;will-change:transform";
      const dot = document.createElement("span");
      dot.style.cssText = "width:8px;height:8px;margin-left:-4px;border-radius:9999px;background:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)";
      const txt = document.createElement("span");
      txt.textContent = l.text;
      txt.style.cssText =
        "padding:3px 9px;border-radius:9999px;background:var(--surface);border:1px solid var(--line);color:var(--ink);font-size:11px;font-weight:500;box-shadow:0 2px 8px rgb(0 0 0/.08)";
      d.append(dot, txt);
      layer.appendChild(d);
      return d;
    });

    // --- animation state ---
    const cur = { explode: 0, cam: 0, dock: 0, wheelSpin: 0 };
    const toolAngle: Record<string, number> = Object.fromEntries(TOOLS.map((t) => [t.id, 0]));
    let zoomFrames = 0;
    let lastFraming = "";
    let lastColourway: ColourwayId = "natural";
    let last = performance.now();
    let raf = 0;
    const tmp = new THREE.Vector3();
    const tmpN = new THREE.Vector3();

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = live.current.state;

      if (s.colourway !== lastColourway) {
        lastColourway = s.colourway;
        model.setColourway(s.colourway);
      }

      cur.explode = damp(cur.explode, s.exploded ? 1 : 0, 5, dt);
      cur.cam = damp(cur.cam, THREE.MathUtils.degToRad(s.cameraDeg), 7, dt);
      cur.dock = damp(cur.dock, s.docked ? 1 : 0, 4, dt);

      for (const p of model.parts) p.obj.position.copy(p.base).addScaledVector(p.explode, cur.explode);

      for (const t of TOOLS) {
        toolAngle[t.id] = damp(toolAngle[t.id], s.open[t.id] ? t.openAngle : 0, 6, dt);
        const holder = model.tools[t.id];
        holder.rotation.z = (holder.userData.fold as number) + toolAngle[t.id];
      }

      model.barrel.rotation.x = cur.cam;
      model.wheel.rotation.z = Math.sin(now / 900) * 0.25 * (s.exploded ? 0 : 1) + cur.wheelSpin;

      // shell turns see-through when exploded so the internals show
      model.shellMat.opacity = THREE.MathUtils.lerp(1, 0.16, cur.explode);
      model.shellMat.depthWrite = cur.explode < 0.1;

      // voltage probe tip pulses while open
      model.voltageTip.emissiveIntensity = 0.25 + (s.open.voltage ? 0.9 + Math.sin(now / 160) * 0.7 : 0);

      // dock
      model.dock.visible = cur.dock > 0.02;
      model.dock.scale.setScalar(Math.max(0.001, cur.dock));
      model.dock.position.y = (1 - cur.dock) * -30;
      model.dockWheels.forEach((w) => (w.rotation.x = now / 700 * cur.dock));
      model.root.position.set(0, 0, 0);
      const dockLift = cur.dock * 0;
      model.root.position.y = dockLift;

      // camera follow + auto-zoom when the shape of the model changes
      const openCount = TOOLS.filter((t) => s.open[t.id]).length;
      const want = s.docked ? 480 : s.exploded ? 400 : openCount >= 3 ? 390 : openCount > 0 ? 340 : 290;
      if (want !== Number(lastFraming)) {
        lastFraming = String(want);
        zoomFrames = 100;
      }
      const targetY = -22 * cur.dock;
      controls.target.y = damp(controls.target.y, targetY, 4, dt);
      if (zoomFrames > 0) {
        zoomFrames--;
        const dist = camera.position.distanceTo(controls.target);
        const next = damp(dist, want, 4, dt);
        camera.position.sub(controls.target).setLength(next).add(controls.target);
      }
      controls.autoRotate = s.spin;
      controls.update();

      renderer.render(scene, camera);

      // project labels
      const w = el.clientWidth;
      const h = el.clientHeight;
      model.labels.forEach((l, i) => {
        const d = labelEls[i];
        tmp.copy(l.anchor);
        model.root.localToWorld(tmp);
        const facing = tmpN.copy(l.normal).normalize().dot(camera.position.clone().sub(tmp).normalize());
        tmp.project(camera);
        const visible = s.labels && facing > 0.12 && cur.explode < 0.2 && tmp.z < 1;
        d.style.opacity = visible ? "1" : "0";
        d.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px)`;
      });
    };
    raf = requestAnimationFrame(loop);

    // click-to-toggle a tool, without hijacking orbit drags
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const toolMeshes: THREE.Object3D[] = Object.values(model.tools);
    const pick = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(toolMeshes, true)[0];
      return hit ? (hit.object.userData.toolId as ToolId | undefined) : undefined;
    };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
        const id = pick(e);
        if (id) live.current.onToolClick(id);
      }
      down = null;
    };
    const onMove = (e: PointerEvent) => {
      renderer.domElement.style.cursor = !down && pick(e) ? "pointer" : "";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    api.current = {
      resetView: () => {
        camera.position.copy(HOME);
        controls.target.set(0, 0, 0);
      },
      exportSTL: () => {
        const exporter = new STLExporter();
        const hidden: THREE.Object3D[] = [];
        // export the device only: no dock, no glass/cover panes
        if (model.dock.visible) {
          model.dock.visible = false;
          hidden.push(model.dock);
        }
        const data = exporter.parse(model.root, { binary: true }) as unknown as DataView;
        hidden.forEach((o) => (o.visible = true));
        const blob = new Blob([data.buffer as ArrayBuffer], { type: "model/stl" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "steward-bot.stl";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      controls.dispose();
      model.dispose();
      shadowTex.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelEls.forEach((d) => d.remove());
    };
  }, []);

  return (
    <div className="relative size-full overflow-hidden">
      <div ref={host} className="absolute inset-0" />
      <div ref={labelLayer} className="pointer-events-none absolute inset-0" />
    </div>
  );
});
