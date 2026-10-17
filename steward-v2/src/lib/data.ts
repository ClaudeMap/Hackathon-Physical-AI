// Mock data for the prototype. Everything here would come from Steward's
// backend (inventory DB, ticket store, activity log) in the real build.

export type Severity = "critical" | "high" | "normal" | "low";
export type Status = "new" | "in_progress" | "waiting" | "escalated" | "done";
export type Source = "slack" | "app" | "voice";

export type Contact = {
  name: string;
  role: string;
  phone: string;
  costPerCallout?: number;
};

export type Item = {
  id: string;
  name: string;
  model: string;
  category: "kitchen" | "av" | "electrical" | "network" | "printing" | "facilities" | "services";
  location: string;
  installed: string;
  lastServiced?: string;
  warrantyUntil?: string;
  support: Contact;
  notes?: string;
};

export type Ticket = {
  id: string;
  title: string;
  itemId: string;
  severity: Severity;
  status: Status;
  source: Source;
  reporter: string;
  assignee: string;
  minsAgo: number;
  diagnosis: string;
  steps: string[];
  escalated?: boolean;
  urgent?: boolean;
  // Set when the manager reorders by hand; lower = higher in the list.
  manualRank?: number;
  photo?: string;
  // Extra reports Steward merged into this ticket (duplicate detection).
  duplicates?: Report[];
  // Per-step progress, notes and "happened before" history (keyed by step index).
  stepsDone?: boolean[];
  stepNotes?: string[];
  history?: Record<number, string>;
  // Spoken line from the API, when the queue has one. The local playbook is the fallback.
  voiceLine?: string;
  canSelfFix?: boolean;
};

export const stepStats = (t: Ticket) => {
  const total = t.steps.length;
  const done = t.status === "done" ? total : (t.stepsDone ?? []).filter(Boolean).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
};

export type Report = { reporter: string; minsAgo: number; source: Source; text: string };

const U = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

export type Activity = {
  id: string;
  minsAgo: number;
  kind: "order" | "report" | "ticket" | "booking" | "fix";
  text: string;
};

export const OFFICE = {
  name: "Transition",
  floor: "2nd floor, 42 people",
  manager: "Nikolaj Buhl",
};

export const ITEMS: Item[] = [
  {
    id: "coffee",
    name: "Coffee machine",
    model: "Sage Barista Pro",
    category: "kitchen",
    location: "Kitchen",
    installed: "Mar 2024",
    lastServiced: "Jul 2026",
    warrantyUntil: "Mar 2027",
    support: { name: "BeanWorks Service", role: "Coffee machine servicing", phone: "01223 555 014", costPerCallout: 95 },
    notes: "Descale every 8 weeks. Grinder jams if hopper is overfilled.",
  },
  {
    id: "screens",
    name: "Meeting room screens",
    model: "Samsung QM55C ×4",
    category: "av",
    location: "Meeting rooms 1–4",
    installed: "Pending",
    support: { name: "Clearview AV", role: "AV installation", phone: "01223 555 210", costPerCallout: 180 },
    notes: "Two units delivered, wall brackets in comms cupboard.",
  },
  {
    id: "fuse",
    name: "Consumer unit (fuse board)",
    model: "Hager 18-way RCBO",
    category: "electrical",
    location: "Comms cupboard",
    installed: "Jan 2022",
    lastServiced: "Jan 2026",
    support: { name: "Spark & Co Electrical", role: "Emergency electrician", phone: "01223 555 777", costPerCallout: 140 },
    notes: "Circuit 7 = kitchen sockets. Circuit 12 = meeting rooms.",
  },
  {
    id: "wifi",
    name: "Wi-Fi network",
    model: "UniFi Dream Machine + 3× U6 Pro",
    category: "network",
    location: "Comms cupboard / ceiling",
    installed: "Sep 2023",
    support: { name: "TechDesk IT", role: "Managed IT", phone: "01223 555 300", costPerCallout: 120 },
    notes: "ISP router is the black box on shelf 2. AP-3 drops under load.",
  },
  {
    id: "printer",
    name: "Printer",
    model: "HP Color LaserJet M479fdw",
    category: "printing",
    location: "Open plan, by window",
    installed: "Jun 2023",
    lastServiced: "Feb 2026",
    support: { name: "PrintCare UK", role: "Printer lease", phone: "0800 555 432", costPerCallout: 0 },
    notes: "Leased; call-outs included. Spare toner in stationery cupboard.",
  },
  {
    id: "dishwasher",
    name: "Dishwasher",
    model: "Bosch Serie 6 SMV6",
    category: "kitchen",
    location: "Kitchen",
    installed: "Mar 2024",
    warrantyUntil: "Mar 2026",
    support: { name: "HomeFix Appliances", role: "Appliance repair", phone: "01223 555 650", costPerCallout: 85 },
    notes: "E24 = drain blocked. Filter under bottom basket.",
  },
  {
    id: "plants",
    name: "Office plants",
    model: "14 plants (mixed)",
    category: "facilities",
    location: "Across office",
    installed: "Ongoing",
    lastServiced: "Aug 2026",
    support: { name: "GreenSpace Plant Care", role: "Plant maintenance", phone: "01223 555 818", costPerCallout: 60 },
    notes: "The palm in the open plan needs a deep water weekly; its leaf tips brown if it dries out. Snake plants monthly.",
  },
  {
    id: "bin",
    name: "Waste & recycling drawer",
    model: "Under-counter pull-out",
    category: "facilities",
    location: "Kitchen",
    installed: "Mar 2024",
    support: { name: "BrightSpace Cleaning", role: "Office cleaning", phone: "01223 555 909", costPerCallout: 45 },
    notes: "Cleaners empty it Mon, Wed and Fri evenings. After Friday lunch it fills up fast.",
  },
  {
    id: "justeat",
    name: "Team lunch (Just Eat)",
    model: "Business account",
    category: "services",
    location: "Reception",
    installed: "—",
    support: { name: "Just Eat for Business", role: "Food ordering", phone: "0800 555 101" },
    notes: "Fridays: team lunch for ~20. Two vegan, one nut allergy.",
  },
];

export const TICKETS: Ticket[] = [
  {
    id: "STW-118",
    history: { 2: "Breaker tripped in March: two heaters and the kettle." },
    urgent: true,
    photo: U("photo-1544724569-5f546fd6f2b5"),
    title: "Fuse has gone – kitchen sockets dead",
    itemId: "fuse",
    severity: "critical",
    status: "in_progress",
    source: "slack",
    reporter: "Priya S.",
    assignee: "Nikolaj Buhl",
    minsAgo: 12,
    diagnosis: "Circuit 7 (kitchen sockets) RCBO has tripped. Likely the kettle or toaster.",
    duplicates: [
      { reporter: "Ben O.", minsAgo: 10, source: "slack", text: "Kettle and toaster both dead??" },
      { reporter: "Aisha M.", minsAgo: 7, source: "voice", text: "No power at the kitchen sockets" },
    ],
    steps: [
      "Unplug every appliance in the kitchen.",
      "Open the comms cupboard. Find switch 7, labelled 'Kitchen sockets'.",
      "Push it fully down, then back up.",
      "Plug appliances back in one at a time. The one that trips it is faulty.",
    ],
  },
  {
    id: "STW-117",
    stepsDone: [true, false],
    stepNotes: ["Light stayed off after the restart."],
    history: { 0: "Dropped twice last month. IT replaced the cable." },
    photo: U("photo-1606904825846-647eb07f5be2"),
    title: "Wi-Fi is down in meeting rooms",
    itemId: "wifi",
    severity: "high",
    status: "escalated",
    source: "slack",
    reporter: "Tom H.",
    assignee: "TechDesk IT",
    minsAgo: 48,
    diagnosis: "AP-3 is offline. Restart did not help, so it may be a PoE port fault.",
    duplicates: [
      { reporter: "Aisha M.", minsAgo: 45, source: "slack", text: "Wifi keeps dropping in Room 2" },
      { reporter: "Chris D.", minsAgo: 41, source: "app", text: "Can't join the call from meeting room 2, no internet" },
      { reporter: "Lena B.", minsAgo: 33, source: "slack", text: "Is the wifi down for anyone else?" },
    ],
    steps: ["Power-cycled AP-3 (done).", "Escalated to TechDesk IT with the AP logs."],
    escalated: true,
  },
  {
    id: "STW-116",
    stepsDone: [true, false, false, false],
    stepNotes: ["Hopper was packed to the brim."],
    history: { 1: "Same fault reported 3 weeks ago. Emptying the hopper fixed it; the burr was sticking." },
    photo: "/photos/coffee.jpg",
    title: "Coffee machine is broken",
    itemId: "coffee",
    severity: "normal",
    status: "new",
    source: "app",
    reporter: "Jamie L.",
    assignee: "Unassigned",
    minsAgo: 65,
    diagnosis: "The screen photo shows 'Grinder jammed'. The hopper is overfilled.",
    duplicates: [{ reporter: "Mo R.", minsAgo: 52, source: "slack", text: "Coffee machine says grinder jammed" }],
    steps: [
      "Switch off and remove the bean hopper.",
      "Empty the beans until it is about two-thirds full.",
      "Clear the burr with the brush stored in the side drawer.",
      "Refit and run one shot to test.",
    ],
  },
  {
    id: "STW-115",
    photo: U("photo-1612815154858-60aa4c59eaa6"),
    title: "Printer not working",
    itemId: "printer",
    severity: "normal",
    status: "waiting",
    source: "voice",
    reporter: "Sam K.",
    assignee: "Nikolaj Buhl",
    minsAgo: 140,
    diagnosis: "The display shows 'Toner low – Cyan'. The print queue is paused.",
    steps: ["Swap the cyan toner (spare in the stationery cupboard).", "Resume the queue from the printer panel."],
  },
  {
    id: "STW-114",
    photo: U("photo-1586024486164-ce9b3d87e09f"),
    title: "Screens need to be installed",
    itemId: "screens",
    severity: "low",
    status: "waiting",
    source: "app",
    reporter: "Nikolaj Buhl",
    assignee: "Clearview AV",
    minsAgo: 1440,
    diagnosis: "Two of the four screens have arrived. Brackets are in the comms cupboard.",
    steps: ["Clearview AV booked Tue 21 Oct, 9:00.", "Book meeting rooms 1 and 2 out for the morning."],
    escalated: true,
  },
  {
    id: "STW-113",
    title: "Just Eat team lunch needs to go out",
    itemId: "justeat",
    severity: "normal",
    status: "new",
    source: "app",
    reporter: "Steward (scheduled)",
    assignee: "Nikolaj Buhl",
    minsAgo: 30,
    diagnosis: "Friday team lunch: 21 people said yes in Slack. Two are vegan and one has a nut allergy.",
    steps: ["Re-order last Friday's basket, adjusted for 21 people.", "Place the order by 11:30 for 12:30 delivery."],
  },
  {
    id: "STW-112",
    photo: "/photos/plant.jpg",
    title: "Office plants are dying",
    itemId: "plants",
    severity: "low",
    status: "new",
    source: "slack",
    reporter: "Mo R.",
    assignee: "Unassigned",
    minsAgo: 300,
    diagnosis: "The photo shows a palm with brown, crispy leaf tips and a dead frond at the base. The soil looks dry, so it is under-watered.",
    steps: ["Give the palm a long, slow drink until water runs out of the bottom.", "Cut the dead fronds off at the base.", "Book a GreenSpace visit, now 9 weeks overdue."],
  },
  {
    id: "STW-119",
    photo: "/photos/bin.jpg",
    title: "Kitchen bin is overflowing",
    itemId: "bin",
    severity: "normal",
    status: "new",
    source: "slack",
    reporter: "Chris D.",
    assignee: "Unassigned",
    minsAgo: 20,
    diagnosis: "The waste drawer by the coffee machine is full of takeaway boxes, cans and tissue and can't close. It needs emptying today.",
    steps: [
      "Bag up the food waste and cans and take it to the main bins.",
      "Wipe out the drawer and fit a fresh liner.",
      "Check the recycling bin isn't full too.",
    ],
    history: { 0: "Overflowed twice in the last fortnight, both after Friday lunch." },
  },
  {
    id: "STW-111",
    photo: U("photo-1581622558663-b2e33377dfb2"),
    title: "Dishwasher is broken (E24)",
    itemId: "dishwasher",
    severity: "normal",
    status: "done",
    source: "slack",
    reporter: "Lena B.",
    assignee: "Lena B.",
    minsAgo: 2880,
    diagnosis: "Error E24: the drain filter is blocked.",
    steps: ["Remove the bottom basket.", "Twist out the filter and rinse it.", "Refit and run a short cycle."],
  },
];

export const ACTIVITY: Activity[] = [
  { id: "a1", minsAgo: 12, kind: "ticket", text: "Logged STW-118 from a Slack photo in #office-help" },
  { id: "a2", minsAgo: 30, kind: "order", text: "Drafted the Friday Just Eat order for 21 people" },
  { id: "a3", minsAgo: 48, kind: "ticket", text: "Escalated Wi-Fi AP-3 to TechDesk IT" },
  { id: "a4", minsAgo: 95, kind: "report", text: "Created weekly facilities report for the COO" },
  { id: "a5", minsAgo: 180, kind: "booking", text: "Confirmed Clearview AV install for Tue 21 Oct" },
  { id: "a6", minsAgo: 2880, kind: "fix", text: "Lena fixed the dishwasher with Steward's guidance in 6 min" },
];

// 8 weeks of history for the "are we getting better?" view.
export const WEEKS = [
  { label: "W35", reported: 19, selfFixed: 5, medianHrs: 26, interruptions: 31, calloutSpend: 860 },
  { label: "W36", reported: 22, selfFixed: 7, medianHrs: 22, interruptions: 29, calloutSpend: 780 },
  { label: "W37", reported: 17, selfFixed: 7, medianHrs: 19, interruptions: 24, calloutSpend: 620 },
  { label: "W38", reported: 21, selfFixed: 10, medianHrs: 17, interruptions: 22, calloutSpend: 540 },
  { label: "W39", reported: 18, selfFixed: 10, medianHrs: 14, interruptions: 17, calloutSpend: 465 },
  { label: "W40", reported: 20, selfFixed: 12, medianHrs: 12, interruptions: 15, calloutSpend: 400 },
  { label: "W41", reported: 16, selfFixed: 11, medianHrs: 9, interruptions: 11, calloutSpend: 260 },
  { label: "W42", reported: 15, selfFixed: 11, medianHrs: 7, interruptions: 9, calloutSpend: 225 },
];

// Inventory learned from the API. Mock ITEMS stay so the office map and escalate shortcuts keep their ids.
const extraItems: Item[] = [];

export function registerItems(items: Item[]) {
  extraItems.splice(0, extraItems.length, ...items);
}

const UNKNOWN_ITEM: Item = {
  id: "unknown",
  name: "Office item",
  model: "Not in the inventory yet",
  category: "facilities",
  location: "Office",
  installed: "—",
  support: { name: "Office manager", role: "On-site staff", phone: "" },
};

export function itemById(id: string): Item {
  return extraItems.find((item) => item.id === id) ?? ITEMS.find((item) => item.id === id) ?? UNKNOWN_ITEM;
}

export function ago(mins: number) {
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  const d = Math.round(mins / 1440);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

// ---- Connectors -----------------------------------------------------------

export type Connector = {
  id: string;
  name: string;
  group: "Messaging" | "HR & people" | "Invoicing & finance" | "Ordering" | "Calendar" | "AI & voice" | "Hardware";
  blurb: string;
  connected: boolean;
  detail?: string;
};

export const CONNECTORS: Connector[] = [
  { id: "slack", name: "Slack", group: "Messaging", blurb: "Picks up photos posted in #office-help and replies in the thread.", connected: true, detail: "#office-help · 42 members" },
  { id: "teams", name: "Microsoft Teams", group: "Messaging", blurb: "The same flow for offices on Teams.", connected: false },
  { id: "hibob", name: "HiBob", group: "HR & people", blurb: "Knows who's in, who's on leave and who's starting. Routes issues to people who are actually in the office.", connected: true, detail: "42 people · synced daily" },
  { id: "bamboohr", name: "BambooHR", group: "HR & people", blurb: "The same people sync for BambooHR.", connected: false },
  { id: "personio", name: "Personio", group: "HR & people", blurb: "The same people sync for Personio.", connected: false },
  { id: "xero", name: "Xero", group: "Invoicing & finance", blurb: "Matches supplier invoices to tickets and flags charges that shouldn't be there.", connected: true, detail: "Synced 4 min ago · 23 bills this quarter" },
  { id: "quickbooks", name: "QuickBooks", group: "Invoicing & finance", blurb: "Bills and supplier payments for QuickBooks offices.", connected: false },
  { id: "justeat", name: "Just Eat for Business", group: "Ordering", blurb: "Drafts team lunches from Slack RSVPs and dietary notes.", connected: true, detail: "Business account · Fridays" },
  { id: "gcal", name: "Google Calendar", group: "Calendar", blurb: "Books supplier visits and blocks rooms during installs.", connected: true, detail: "Meeting rooms 1–4" },
  { id: "openai", name: "OpenAI Vision", group: "AI & voice", blurb: "Reads photos and videos: error screens, labels, model plates.", connected: true },
  { id: "elevenlabs", name: "ElevenLabs", group: "AI & voice", blurb: "Speaks fixes aloud, with a calmer voice for critical issues.", connected: true, detail: "4 voices mapped to severity" },
  { id: "robot", name: "Steward Bot", group: "Hardware", blurb: "A mobile robot that maps the office and checks on reported issues.", connected: false, detail: "Pilot · waitlist" },
];

export type Invoice = {
  id: string;
  supplier: string;
  amount: number;
  date: string;
  ticketId?: string;
  status: "matched" | "needs_approval" | "flagged";
  note: string;
};

export const INVOICES: Invoice[] = [
  { id: "INV-2291", supplier: "PrintCare UK", amount: 85, date: "14 Oct", ticketId: "STW-109", status: "flagged", note: "Call-out charged, but it's covered by your lease. Steward drafted a dispute." },
  { id: "INV-2288", supplier: "TechDesk IT", amount: 120, date: "17 Oct", ticketId: "STW-117", status: "needs_approval", note: "AP-3 call-out. It matches the escalation and the agreed rate." },
  { id: "INV-2275", supplier: "Spark & Co Electrical", amount: 140, date: "9 Oct", ticketId: "STW-104", status: "matched", note: "Emergency call-out, matched to ticket and timesheet." },
  { id: "INV-2270", supplier: "Just Eat for Business", amount: 268, date: "10 Oct", status: "matched", note: "Friday team lunch, 21 people. Within the £300 budget." },
  { id: "INV-2262", supplier: "BeanWorks Service", amount: 190, date: "3 Oct", ticketId: "STW-098", status: "flagged", note: "Billed for 2 visits. The ticket shows one, fixed on the first visit." },
  { id: "INV-2254", supplier: "GreenSpace Plant Care", amount: 60, date: "29 Sep", status: "matched", note: "Monthly visit, matched to the contract." },
];

// ---- 3D office map --------------------------------------------------------
// Floor plan in map units (the floor is 600 × 400).

export type Room = { id: string; name: string; x: number; y: number; w: number; h: number };

export const ROOMS: Room[] = [
  { id: "kitchen", name: "Kitchen", x: 0, y: 0, w: 180, h: 150 },
  { id: "comms", name: "Comms", x: 0, y: 150, w: 90, h: 90 },
  { id: "reception", name: "Reception", x: 0, y: 290, w: 180, h: 110 },
  { id: "mr1", name: "Room 1", x: 200, y: 0, w: 100, h: 110 },
  { id: "mr2", name: "Room 2", x: 300, y: 0, w: 100, h: 110 },
  { id: "mr3", name: "Room 3", x: 400, y: 0, w: 100, h: 110 },
  { id: "mr4", name: "Room 4", x: 500, y: 0, w: 100, h: 110 },
];

export type Pin = { itemId: string; x: number; y: number; label?: string };

export const PINS: Pin[] = [
  { itemId: "coffee", x: 50, y: 40 },
  { itemId: "dishwasher", x: 130, y: 40 },
  { itemId: "bin", x: 90, y: 100 },
  { itemId: "fuse", x: 45, y: 195 },
  { itemId: "wifi", x: 350, y: 60, label: "AP-3" },
  { itemId: "screens", x: 250, y: 30 },
  { itemId: "printer", x: 560, y: 360 },
  { itemId: "plants", x: 420, y: 250 },
  { itemId: "justeat", x: 90, y: 345 },
];

export const DESKS: { x: number; y: number }[] = Array.from({ length: 12 }, (_, i) => ({
  x: 240 + (i % 4) * 85,
  y: 160 + Math.floor(i / 4) * 70,
}));

// ---- HR sync ----------------------------------------------------------------

export const PEOPLE_TODAY = {
  inOffice: 31,
  headcount: 42,
  onLeave: [
    { name: "Tom H.", until: "Mon 20 Oct" },
    { name: "Jamie L.", until: "Wed 22 Oct" },
    { name: "Priya S.", until: "PM only" },
  ],
  starters: [{ name: "Dana K.", role: "Product designer", date: "Mon 20 Oct", tasks: ["Desk 7 set up", "Laptop + monitor ordered", "Building pass requested", "Added to Friday lunch"] }],
  leavers: [{ name: "Sam K.", date: "Fri 24 Oct", tasks: ["Collect laptop and pass", "Free up desk 3"] }],
};

// ---- Agents -----------------------------------------------------------------
// Steward is the lead agent. It hands jobs to specialist agents by item category.

export type Tone = "accent" | "high" | "norm" | "low" | "good";

export type Agent = { id: string; name: string; role: string; tone: Tone; categories: Item["category"][] };

export const AGENTS: Agent[] = [
  { id: "steward", name: "Steward", role: "Office manager · all jobs", tone: "accent", categories: [] },
  { id: "facilities", name: "Facilities Bot", role: "Kitchen, power, plants, AV", tone: "high", categories: ["kitchen", "electrical", "facilities", "av"] },
  { id: "it", name: "IT Bot", role: "Wi-Fi and printing", tone: "norm", categories: ["network", "printing"] },
  { id: "lunch", name: "Lunch Bot", role: "Food and deliveries", tone: "good", categories: ["services"] },
];

export const agentForItem = (itemId: string): Agent => {
  const cat = itemById(itemId)?.category;
  return AGENTS.find((a) => a.categories.some((c) => c === cat)) ?? AGENTS[0];
};

// ---- Office re-scan (mock) -----------------------------------------------------
// What a re-scan "finds" that isn't in the inventory yet. New items start off the map.

export const SCAN_FINDS: Item[] = [
  {
    id: "extinguisher",
    name: "Fire extinguisher",
    model: "6kg CO₂",
    category: "facilities",
    location: "By reception",
    installed: "Unknown",
    lastServiced: "Mar 2026",
    support: { name: "SafeGuard Fire", role: "Fire safety", phone: "01223 555 120", costPerCallout: 70 },
    notes: "Steward read the service tag in the photo. Next service due Mar 2027.",
  },
  {
    id: "kettle",
    name: "Kettle",
    model: "Dualit Classic",
    category: "kitchen",
    location: "Kitchen",
    installed: "Unknown",
    support: { name: "HomeFix Appliances", role: "Appliance repair", phone: "01223 555 650", costPerCallout: 85 },
    notes: "Plugged into the kitchen sockets on circuit 7, the one that keeps tripping.",
  },
];

// ---- Issues per day -------------------------------------------------------------
// New issues reported each day, 4 to 16 Oct. Today's count is computed from live tasks.

export const ISSUES_PER_DAY: { day: number; n: number }[] = [
  { day: 4, n: 0 },
  { day: 5, n: 4 },
  { day: 6, n: 3 },
  { day: 7, n: 5 },
  { day: 8, n: 2 },
  { day: 9, n: 4 },
  { day: 10, n: 0 },
  { day: 11, n: 1 },
  { day: 12, n: 5 },
  { day: 13, n: 3 },
  { day: 14, n: 4 },
  { day: 15, n: 2 },
  { day: 16, n: 3 },
];
export const TODAY = 17;
