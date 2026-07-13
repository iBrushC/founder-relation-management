import "server-only";

import { listConnections, listEvents, listProjects } from "@/lib/data/crm";

/**
 * A single result in the global (top-bar) search. Flattened from the CRM read
 * types into just what the command palette needs to render and navigate: a
 * label, a bit of context, where selecting it goes, and extra `keywords` so a
 * match can hit fields we don't show (tags, notes, organizers, emails…).
 */
export type SearchItem = {
  id: string;
  type: "connection" | "project" | "event";
  title: string;
  subtitle: string;
  href: string;
  /** Extra text folded into matching but not displayed. */
  keywords: string;
};

/**
 * Build the signed-in user's searchable index across people, projects, and
 * events. Small enough for a prototype to ship whole to the client and filter
 * there (cmdk), which keeps results instant and typo-tolerant.
 */
export async function buildSearchIndex(): Promise<SearchItem[]> {
  const [connections, projects, events] = await Promise.all([
    listConnections(),
    listProjects(),
    listEvents(),
  ]);

  const items: SearchItem[] = [];

  for (const c of connections) {
    items.push({
      id: c.id,
      type: "connection",
      title: c.name,
      subtitle: [c.role, c.company].filter(Boolean).join(" · "),
      href: `/connections?focus=${encodeURIComponent(c.id)}`,
      keywords: [
        c.email,
        c.location,
        c.note,
        ...c.tags.map((t) => t.label),
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  for (const p of projects) {
    items.push({
      id: p.id,
      type: "project",
      title: p.name,
      subtitle: p.summary,
      href: `/projects/${encodeURIComponent(p.id)}`,
      keywords: [
        p.description,
        p.status.label,
        ...p.tasks.map((t) => t.label),
        ...p.outreach.map((o) => o.label),
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  for (const e of events) {
    items.push({
      id: e.id,
      type: "event",
      title: e.name,
      subtitle: [e.when, e.where].filter(Boolean).join(" · "),
      href: `/events?focus=${encodeURIComponent(e.id)}`,
      keywords: [e.note, ...e.organizers, ...(e.metGuests ?? [])]
        .filter(Boolean)
        .join(" "),
    });
  }

  return items;
}
