// Mocked Steward agent. In the real build this is an OpenAI vision call that
// gets the photo plus the office inventory as context. Here it matches on
// keywords so the demo flow runs offline.

import { ITEMS, type Item, type Severity } from "./data";

export type Diagnosis = {
  item: Item;
  confidence: number;
  severity: Severity;
  summary: string;
  steps: string[];
  canSelfFix: boolean;
  etaMins: number;
  voiceLine: string;
};

export const KEYWORDS: Record<string, string[]> = {
  coffee: ["coffee", "espresso", "grinder", "latte", "sage", "beans"],
  screens: ["screen", "tv", "monitor", "display", "install", "bracket", "hdmi"],
  fuse: ["fuse", "power", "socket", "tripped", "electric", "lights", "breaker"],
  wifi: ["wifi", "wi-fi", "internet", "network", "router", "connection", "slow"],
  printer: ["print", "printer", "toner", "paper", "jam", "scan"],
  dishwasher: ["dishwasher", "dishes", "e24", "drain", "bosch"],
  plants: ["plant", "plants", "palm", "dying", "leaves", "monstera", "water"],
  bin: ["bin", "rubbish", "trash", "waste", "overflowing", "recycling", "smell"],
  justeat: ["lunch", "food", "just eat", "justeat", "order", "delivery"],
};

const PLAYBOOK: Record<string, Omit<Diagnosis, "item" | "confidence">> = {
  coffee: {
    severity: "normal",
    summary: "The screen shows 'Grinder jammed'. The hopper is overfilled, which is the most common fault on this machine.",
    steps: [
      "Switch off and lift out the bean hopper.",
      "Empty the beans until it is about two-thirds full.",
      "Clear the burr with the brush in the side drawer.",
      "Refit the hopper and pull one test shot.",
    ],
    canSelfFix: true,
    etaMins: 5,
    voiceLine: "Looks like the grinder's jammed. Take the hopper off, tip out a third of the beans, and give the burr a quick brush. Five minutes, tops.",
  },
  screens: {
    severity: "low",
    summary: "This is an install job, not a fault. Clearview AV already have the brackets on site.",
    steps: ["Book Clearview AV (next free slot: Tue 9:00).", "Block meeting rooms 1 and 2 for that morning."],
    canSelfFix: false,
    etaMins: 0,
    voiceLine: "This one's a job for Clearview. I can book them for Tuesday morning and block the meeting rooms. Shall I?",
  },
  fuse: {
    severity: "critical",
    summary: "Circuit 7 (kitchen sockets) has tripped. This is almost always one faulty appliance.",
    steps: [
      "Unplug every appliance in the kitchen.",
      "Go to the comms cupboard. Find switch 7, labelled 'Kitchen sockets'.",
      "Push it fully down, then back up.",
      "Plug appliances back in one at a time. The one that trips it is faulty.",
      "If it trips with nothing plugged in, stop. I'll call Spark & Co.",
    ],
    canSelfFix: true,
    etaMins: 10,
    voiceLine: "Okay. It's just one circuit, and it's safe to reset. First, unplug everything in the kitchen. Then go to the comms cupboard and find switch seven. I'll walk you through the rest.",
  },
  wifi: {
    severity: "high",
    summary: "Access point AP-3 above meeting room 2 is offline. The other two are healthy.",
    steps: [
      "Power-cycle AP-3: unplug port 3 on the switch for 10 seconds.",
      "Wait two minutes for the light to turn solid blue.",
      "If it is still offline, I'll escalate to TechDesk IT with the logs.",
    ],
    canSelfFix: true,
    etaMins: 4,
    voiceLine: "It's only the meeting room access point. Unplug port three on the switch for ten seconds. If that doesn't do it, I'll get TechDesk on it.",
  },
  printer: {
    severity: "normal",
    summary: "Cyan toner is empty and the queue has paused. There is a spare in the stationery cupboard.",
    steps: ["Open the front panel and swap the cyan cartridge.", "Press 'Resume' on the printer screen."],
    canSelfFix: true,
    etaMins: 3,
    voiceLine: "Cyan toner's out. There's a spare in the stationery cupboard. Swap it in and hit resume.",
  },
  dishwasher: {
    severity: "normal",
    summary: "Error E24 means the drain filter is blocked. It is a two-minute fix.",
    steps: ["Remove the bottom basket.", "Twist out the filter and rinse it under the tap.", "Refit it and run a short cycle."],
    canSelfFix: true,
    etaMins: 6,
    voiceLine: "E24, so the filter's blocked. Pull out the bottom basket, twist the filter out and give it a rinse.",
  },
  plants: {
    severity: "low",
    summary: "The palm's leaf tips are browning and one frond has died. It's under-watered and the plant care visit is 9 weeks overdue.",
    steps: ["Give the palm a long, slow drink until water runs out of the bottom.", "Cut the dead fronds off at the base.", "Book a GreenSpace visit (I can do it now)."],
    canSelfFix: true,
    etaMins: 10,
    voiceLine: "The palm's thirsty. Give it a long, slow drink and trim the dead fronds. I'll book GreenSpace for a proper visit.",
  },
  bin: {
    severity: "normal",
    summary: "The waste drawer is overflowing with takeaway boxes and cans and can't close. The cleaners aren't due until the evening.",
    steps: ["Bag up the food waste and cans and take it to the main bins.", "Wipe out the drawer and fit a fresh liner.", "Check the recycling bin isn't full too."],
    canSelfFix: true,
    etaMins: 10,
    voiceLine: "The kitchen drawer's overflowing. Bag it up and take it down, then pop in a fresh liner. I'll ask BrightSpace to do an extra clean on Fridays.",
  },
  justeat: {
    severity: "normal",
    summary: "21 people said yes in Slack. I've adjusted last Friday's order for two vegans and one nut allergy.",
    steps: ["Review the drafted basket (£268).", "Approve it to place the order for 12:30 delivery."],
    canSelfFix: true,
    etaMins: 1,
    voiceLine: "Lunch is drafted for twenty-one. I've handled the dietary bits. Just approve it and I'll send it.",
  },
};

export function diagnose(text: string, hasImage: boolean): Diagnosis {
  const q = text.toLowerCase();
  let best = { id: "", score: 0 };
  for (const [id, words] of Object.entries(KEYWORDS)) {
    const score = words.filter((w) => q.includes(w)).length;
    if (score > best.score) best = { id, score };
  }
  // Without a keyword hit, fall back to the coffee machine (the demo photo).
  const id = best.id || "coffee";
  const item = ITEMS.find((i) => i.id === id)!;
  const confidence = Math.min(0.97, 0.62 + best.score * 0.12 + (hasImage ? 0.15 : 0));
  return { item, confidence, ...PLAYBOOK[id] };
}
