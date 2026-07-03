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
  /** Longer context shown in the update detail panel. */
  detail: string;
  /** People this update touches. */
  connectionIds: string[];
  /** Projects this update touches. */
  projectIds: string[];
};

export type Subtask = { id: string; label: string; done: boolean };

export type Task = {
  id: string;
  label: string;
  done: boolean;
  due?: string;
  /** Optional longer context, revealed on demand. */
  description?: string;
  /** Optional checklist nested under the task, revealed on demand. */
  subtasks?: Subtask[];
};

/** A project stage that spans a date range; stages routinely overlap. */
export type Phase = {
  id: string;
  label: string;
  tone: Tone;
  /** ISO date (YYYY-MM-DD), inclusive. */
  start: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  end: string;
};

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
  phases: Phase[];
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
    detail:
      "Sam asked for the deck by Friday plus a 3-line traction update. Pull the latest numbers from the Lumen dashboard before sending.",
    connectionIds: ["sam-whitfield"],
    projectIds: ["lumen"],
  },
  {
    id: "u2",
    icon: "coffee",
    title: "Coffee check-in with Priya Raman",
    kind: "Check-in",
    tone: "blue",
    when: "in 2 days",
    detail:
      "Follow up on her onboarding-flow feedback and see if she'd co-sign the Northwind pilot scope.",
    connectionIds: ["priya-raman"],
    projectIds: ["lumen", "northwind-pilot"],
  },
  {
    id: "u3",
    icon: "cake",
    title: "David Okafor's birthday",
    kind: "Birthday",
    tone: "purple",
    when: "Jul 9",
    detail:
      "Grab dinner with your co-founder — he's been heads-down on the eval dataset. Good moment to unblock him too.",
    connectionIds: ["david-okafor"],
    projectIds: ["lumen"],
  },
  {
    id: "u4",
    icon: "calendarCheck",
    title: "Weekly sync — Lumen",
    kind: "Meeting",
    tone: "green",
    when: "Fri 3:00",
    detail:
      "Standing team sync. Agenda: onboarding v2 ship date, eval dataset status, and the Alder deck.",
    connectionIds: ["david-okafor", "priya-raman"],
    projectIds: ["lumen"],
  },
  {
    id: "u5",
    icon: "star",
    title: "Fellowship decisions announced",
    kind: "Milestone",
    tone: "amber",
    when: "Jul 31",
    detail:
      "Founders Fellowship decisions go out end of month. Make sure Elena has the updated one-pager well before then.",
    connectionIds: ["elena-mora", "grace-liu"],
    projectIds: ["founders-fellowship"],
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
      {
        id: "t1",
        label: "Ship onboarding v2",
        done: false,
        due: "Jul 8",
        description:
          "Incorporate Priya's feedback on the first-run flow — fewer steps, clearer value prop on screen one.",
        subtasks: [
          { id: "t1a", label: "Rewrite welcome copy", done: true },
          { id: "t1b", label: "Cut the setup wizard to 3 steps", done: false },
          { id: "t1c", label: "QA on mobile", done: false },
        ],
      },
      {
        id: "t2",
        label: "Finalize eval dataset with David",
        done: false,
        due: "Jul 10",
        description:
          "Blocker for the ranking model. Needs a labeled set of ~500 practice questions across three subjects.",
        subtasks: [
          { id: "t2a", label: "Agree on labeling rubric", done: false },
          { id: "t2b", label: "Label first 200", done: false },
        ],
      },
      { id: "t3", label: "Send updated deck to Alder", done: false, due: "Jul 4" },
      { id: "t4", label: "Draft campus pilot outreach", done: true },
      { id: "t5", label: "Set up analytics dashboard", done: true },
    ],
    phases: [
      { id: "lp1", label: "Fall pilot planning", tone: "green", start: "2026-06-18", end: "2026-07-31" },
      { id: "lp2", label: "Onboarding v2", tone: "blue", start: "2026-06-24", end: "2026-07-08" },
      { id: "lp3", label: "Eval dataset", tone: "purple", start: "2026-06-28", end: "2026-07-10" },
      { id: "lp4", label: "Alder fundraise", tone: "red", start: "2026-07-01", end: "2026-07-04" },
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
    phases: [
      { id: "fp1", label: "Application", tone: "amber", start: "2026-06-12", end: "2026-06-19" },
      { id: "fp2", label: "One-pager revision", tone: "blue", start: "2026-06-30", end: "2026-07-06" },
      { id: "fp3", label: "Decision window", tone: "slate", start: "2026-07-06", end: "2026-07-31" },
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
    phases: [
      { id: "np1", label: "Scoping", tone: "teal", start: "2026-06-16", end: "2026-06-19" },
      { id: "np2", label: "On hold", tone: "slate", start: "2026-06-19", end: "2026-07-31" },
    ],
  },
];

export const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
