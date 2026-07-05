import type { IconKey } from "@/lib/icons";
import type { Project, Tone } from "@/lib/data";

/** A project a connection is linked to — enough to render a chip that links out. */
export type ProjectLink = {
  id: string;
  name: string;
  tone: Tone;
  icon: IconKey;
};

/**
 * Invert the project → connections relation into connection id → the projects it
 * belongs to, so a connection's detail view can list its projects. Pure; shared
 * by the dashboard and connections pages.
 */
export function projectLinksByConnection(
  projects: Project[],
): Record<string, ProjectLink[]> {
  const out: Record<string, ProjectLink[]> = {};
  for (const p of projects) {
    const link: ProjectLink = {
      id: p.id,
      name: p.name,
      tone: p.tone,
      icon: p.icon,
    };
    for (const cid of p.connectionIds) {
      (out[cid] ??= []).push(link);
    }
  }
  return out;
}
