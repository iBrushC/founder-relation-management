import type { IconKey } from "@/lib/icons";

export type Tone =
  | "red"
  | "amber"
  | "blue"
  | "green"
  | "purple"
  | "teal"
  | "slate";

export type Tag = { label: string; tone: Tone };

export type Interaction = { label: string; when: string };

export type Connection = {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarTone: Tone;
  tags: Tag[];
  /** Human label for last interaction */
  last: string;
  /** Lower = more recent. Used only for display ordering of demo data. */
  rank: number;
  email: string;
  phone: string;
  location: string;
  birthday: string;
  note: string;
  timeline: Interaction[];
};

export type Update = {
  id: string;
  icon: IconKey;
  title: string;
  kind: string;
  tone: Tone;
  when: string;
};

export type Task = { id: string; label: string; done: boolean; due?: string };

export type Project = {
  id: string;
  name: string;
  icon: IconKey;
  tone: Tone;
  summary: string;
  description: string;
  status: Tag;
  connectionIds: string[];
  tasks: Task[];
  timeline: Interaction[];
};

/* ------------------------------------------------------------------ */
/*  Demo data — Maya Chen, a student founder                           */
/* ------------------------------------------------------------------ */

export const me = { name: "Maya Chen", role: "Founder · Lumen", initials: "MC" };

export const connections: Connection[] = [
  {
    id: "priya-raman",
    name: "Priya Raman",
    role: "Design Lead",
    company: "Northwind",
    avatarTone: "green",
    tags: [
      { label: "Advisor", tone: "green" },
      { label: "Design", tone: "teal" },
    ],
    last: "2h ago",
    rank: 1,
    email: "priya@northwind.co",
    phone: "+1 (415) 555-0142",
    location: "San Francisco, CA",
    birthday: "Mar 22",
    note: "Met at the Founders mixer. Offered to review our onboarding flow — strong on B2B design systems. Warm and fast over text.",
    timeline: [
      { label: "Reviewed onboarding mockups", when: "2 hours ago" },
      { label: "Intro call", when: "5 days ago" },
      { label: "Connected at Founders mixer", when: "Jun 18" },
    ],
  },
  {
    id: "sam-whitfield",
    name: "Sam Whitfield",
    role: "Partner",
    company: "Alder Ventures",
    avatarTone: "blue",
    tags: [{ label: "Investor", tone: "blue" }],
    last: "Yesterday",
    rank: 2,
    email: "sam@alder.vc",
    phone: "+1 (628) 555-0199",
    location: "Menlo Park, CA",
    birthday: "—",
    note: "Leads pre-seed at Alder. Wants the deck by Friday plus a 3-line traction update. Prefers concise email, no calls.",
    timeline: [
      { label: "Requested pitch deck", when: "Yesterday" },
      { label: "Warm intro from Grace", when: "Jun 30" },
    ],
  },
  {
    id: "david-okafor",
    name: "David Okafor",
    role: "Co-founder",
    company: "Lumen",
    avatarTone: "purple",
    tags: [{ label: "Team", tone: "purple" }],
    last: "3 days ago",
    rank: 3,
    email: "david@lumen.study",
    phone: "+1 (312) 555-0177",
    location: "Chicago, IL",
    birthday: "Jul 9",
    note: "Co-founder on Lumen, owns the ML side. Birthday next week — grab dinner. Currently blocked on the eval dataset.",
    timeline: [
      { label: "Pushed ranking model v2", when: "3 days ago" },
      { label: "Sprint planning", when: "1 week ago" },
    ],
  },
  {
    id: "grace-liu",
    name: "Grace Liu",
    role: "Product Manager",
    company: "Figma",
    avatarTone: "amber",
    tags: [{ label: "Mentor", tone: "amber" }],
    last: "1 week ago",
    rank: 4,
    email: "grace.liu@figma.com",
    phone: "+1 (206) 555-0110",
    location: "Seattle, WA",
    birthday: "Nov 3",
    note: "Mentor from the accelerator. Great for GTM and positioning. Check in roughly monthly.",
    timeline: [
      { label: "Monthly mentor call", when: "1 week ago" },
      { label: "Sent positioning notes", when: "Jun 12" },
    ],
  },
  {
    id: "tobias-reyes",
    name: "Tobias Reyes",
    role: "Engineer",
    company: "Independent",
    avatarTone: "slate",
    tags: [{ label: "Peer", tone: "slate" }],
    last: "2 weeks ago",
    rank: 5,
    email: "tobi@hey.com",
    phone: "+1 (971) 555-0166",
    location: "Portland, OR",
    birthday: "Aug 14",
    note: "Fellow student founder building in fintech. Good to trade notes with. Owes me a Figma intro.",
    timeline: [
      { label: "Traded investor lists", when: "2 weeks ago" },
      { label: "Hack night", when: "May 28" },
    ],
  },
  {
    id: "elena-mora",
    name: "Elena Mora",
    role: "Program Director",
    company: "Founders Fellowship",
    avatarTone: "teal",
    tags: [
      { label: "Program", tone: "teal" },
      { label: "Advisor", tone: "green" },
    ],
    last: "3 weeks ago",
    rank: 6,
    email: "elena@foundersfellowship.org",
    phone: "+1 (617) 555-0121",
    location: "Boston, MA",
    birthday: "Feb 2",
    note: "Runs the fellowship we applied to. Decisions go out end of month. Send the updated one-pager.",
    timeline: [
      { label: "Submitted application", when: "3 weeks ago" },
      { label: "Info session", when: "May 15" },
    ],
  },
];

export const connectionsById = Object.fromEntries(
  connections.map((c) => [c.id, c]),
);

export const updates: Update[] = [
  {
    id: "u1",
    icon: "flag",
    title: "Send pitch deck to Alder Ventures",
    kind: "Deadline",
    tone: "red",
    when: "Tomorrow",
  },
  {
    id: "u2",
    icon: "coffee",
    title: "Coffee check-in with Priya Raman",
    kind: "Check-in",
    tone: "blue",
    when: "in 2 days",
  },
  {
    id: "u3",
    icon: "cake",
    title: "David Okafor's birthday",
    kind: "Birthday",
    tone: "purple",
    when: "Jul 9",
  },
  {
    id: "u4",
    icon: "calendarCheck",
    title: "Weekly sync — Lumen",
    kind: "Meeting",
    tone: "green",
    when: "Fri 3:00",
  },
  {
    id: "u5",
    icon: "star",
    title: "Fellowship decisions announced",
    kind: "Milestone",
    tone: "amber",
    when: "Jul 31",
  },
];

export const projects: Project[] = [
  {
    id: "lumen",
    name: "Lumen",
    icon: "sparkles",
    tone: "green",
    summary: "AI study companion for students",
    description:
      "An AI study companion that turns lecture notes and readings into adaptive practice. Pre-seed, two co-founders, aiming for a campus pilot this fall.",
    status: { label: "On track", tone: "green" },
    connectionIds: ["david-okafor", "priya-raman", "sam-whitfield", "grace-liu"],
    tasks: [
      { id: "t1", label: "Ship onboarding v2", done: false, due: "Jul 8" },
      { id: "t2", label: "Finalize eval dataset with David", done: false, due: "Jul 10" },
      { id: "t3", label: "Send updated deck to Alder", done: false, due: "Jul 4" },
      { id: "t4", label: "Draft campus pilot outreach", done: true },
      { id: "t5", label: "Set up analytics dashboard", done: true },
    ],
    timeline: [
      { label: "Priya reviewed onboarding mockups", when: "2 hours ago" },
      { label: "Ranking model v2 shipped", when: "3 days ago" },
      { label: "Alder requested the deck", when: "Yesterday" },
      { label: "Kicked off fall pilot planning", when: "Jun 24" },
    ],
  },
  {
    id: "founders-fellowship",
    name: "Founders Fellowship",
    icon: "target",
    tone: "amber",
    summary: "Application & outreach campaign",
    description:
      "The application push for the Founders Fellowship — tracking the people, materials, and dates that get us from applied to accepted.",
    status: { label: "Due soon", tone: "amber" },
    connectionIds: ["elena-mora", "grace-liu"],
    tasks: [
      { id: "f1", label: "Send updated one-pager to Elena", done: false, due: "Jul 6" },
      { id: "f2", label: "Line up two references", done: true },
    ],
    timeline: [
      { label: "Application submitted", when: "3 weeks ago" },
      { label: "Info session with Elena", when: "May 15" },
    ],
  },
  {
    id: "northwind-pilot",
    name: "Northwind Pilot",
    icon: "briefcase",
    tone: "slate",
    summary: "Design partner pilot program",
    description:
      "A design-partner pilot with Northwind to validate the B2B angle. Paused until the fall pilot ships, but keeping the thread warm.",
    status: { label: "Paused", tone: "slate" },
    connectionIds: ["priya-raman"],
    tasks: [{ id: "n1", label: "Revisit scope after fall pilot", done: false }],
    timeline: [{ label: "Scoping call with Priya", when: "Jun 18" }],
  },
];

export const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
