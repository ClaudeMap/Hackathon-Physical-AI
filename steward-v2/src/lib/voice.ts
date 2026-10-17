// Voice output. The real build calls ElevenLabs with a voice chosen per
// severity. The prototype uses the browser's speech engine with the same
// profiles so the demo works offline.

import type { Severity } from "./data";

export type VoiceProfile = { label: string; rate: number; pitch: number };

export const VOICES: Record<Severity, VoiceProfile> = {
  critical: { label: "Calm & steady", rate: 0.88, pitch: 0.9 },
  high: { label: "Clear & focused", rate: 0.95, pitch: 0.95 },
  normal: { label: "Friendly", rate: 1.02, pitch: 1.0 },
  low: { label: "Light & casual", rate: 1.06, pitch: 1.05 },
};

export function speak(text: string, severity: Severity, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const p = VOICES[severity];
  u.rate = p.rate;
  u.pitch = p.pitch;
  const en = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en-GB"));
  if (en) u.voice = en;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
