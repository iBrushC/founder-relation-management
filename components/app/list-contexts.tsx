"use client";

import type { Connection, EventItem, Project } from "@/lib/data";
import { createListContext } from "@/components/app/reactive-list";

/**
 * Shared optimistic-list contexts, one per record type. Kept in their own module
 * so the page (Provider), the Add dialog (`add`), and the table view (`items` /
 * `remove`) can all reach the same instance without importing each other.
 *
 * The `*Provider` components are exported directly (not as `SomeList.Provider`)
 * so server components — the pages — can render them across the client boundary.
 * A nested property off an exported object doesn't resolve as a client reference.
 */
export const ConnectionsList = createListContext<Connection>();
export const EventsList = createListContext<EventItem>();
export const ProjectsList = createListContext<Project>();

export function ConnectionsProvider(props: {
  server: Connection[];
  children: React.ReactNode;
}) {
  return <ConnectionsList.Provider {...props} />;
}

export function EventsProvider(props: {
  server: EventItem[];
  children: React.ReactNode;
}) {
  return <EventsList.Provider {...props} />;
}

export function ProjectsProvider(props: {
  server: Project[];
  children: React.ReactNode;
}) {
  return <ProjectsList.Provider {...props} />;
}
