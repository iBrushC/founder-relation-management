# SFRM Style Guide

The design language for the Student Founder Relationship Management dashboard. Keep it calm, dense, and legible — a working tool, not a landing page.

## Principles

1. **Neutral ground, one accent.** Surfaces are true neutral (zero green). A single desaturated sage is the only brand hue; everything else earns color only to carry meaning.
2. **Borders, not shadows.** Separation comes from hairline borders and surface contrast. No drop shadows on cards, sheets, menus, or popovers.
3. **Dense but breathable.** Tight vertical rhythm and small controls; lean on whitespace between sections, not inside rows.
4. **One way to do a thing.** A row hover, a tag, a status badge, a panel — each has a single canonical form reused everywhere.
5. **Restraint with color.** Semantic tones are muted grounds with saturated ink. Only `destructive` runs vivid.

## Color

Defined as OKLCH CSS variables in [`app/globals.css`](app/globals.css). Reference tokens, never raw values, in components.

- **Background** — `--background` is pure neutral (`oklch(0.985 0 0)`), **no green**. Cards sit a hair brighter (`--card`).
- **Primary** — the lone sage accent (`--primary`, ~0.066 chroma). Used for the brand mark, primary buttons, focus rings, and the timeline "today" marker. Never as a large fill.
- **Neutrals** — `--secondary` / `--muted` / `--border` / `--input` are near-zero chroma. `--muted` is the hover/fill surface.
- **Accent** — a faint sage tint reserved for menu/select focus states only.
- **Sidebar** — fully neutral, including the active-nav highlight. No green on any sidebar surface.
- **Semantic tones** — seven hues (`red, amber, blue, green, purple, teal, slate`) as soft-ground + ink pairs. Set via the `.tone-{hue}` (fill) and `.tone-{hue}-ink` (text) classes; map from data with `toneBg` / `toneInk` in [`lib/tone.ts`](lib/tone.ts). Greens are deliberately desaturated.
- **Destructive** — the one vivid red; use for remove/delete affordances only.

## Typography

Wired in [`app/layout.tsx`](app/layout.tsx); utilities in `globals.css`.

- **Body** — IBM Plex Sans (`font-sans`). Default for all content.
- **Headers** — Space Mono, **all-caps only** (`font-heading`): page titles, table column heads, and the `.eyebrow` section label (0.14em tracking, uppercase, muted).
- **Numbers** — always `tabular-nums` for counts, dates, and metadata.
- **Scale** — page title `text-lg`; body `text-sm`; metadata/eyebrows `text-xs`/`11px`. Titles `font-semibold`/`font-bold`, body `font-medium` for emphasis.

## Shape & Elevation

- **Radius** — minimal. `--radius: 0.375rem`; tags/badges use `rounded-[5px]`. Nothing pill-shaped — no `rounded-full` on inputs or bars (avatars/dots excepted).
- **Elevation** — none. Borders (`border-border`) and `bg-muted` do the separating. This is enforced globally in `globals.css`.

## Spacing & Density

- **Page frame** — content is centered at `max-w-5xl`, `px-6`. A single pinned top bar (search + global actions); the page header is in-flow, not a second sticky bar.
- **Sections** — `Section` with an `.eyebrow` label + divider rule; ~`gap-7` between sections, `gap-2.5` within.
- **Rows** — compact padding (`py-2`, `px-3`–`px-4`). Controls are small: buttons `h-7`–`h-9`, `size="icon-sm"` for row icons.

## Interaction

- **Row hover** — every table row and list-row element (connections, projects, tasks, updates, panel links) uses the **same** hover: `hover:bg-muted/50` with `transition-colors`. Do not invent per-surface hovers.
- **Cursor** — all interactive controls show `cursor-pointer` (baked into the button and select-trigger variants).
- **Focus** — visible ring via `focus-visible:ring-ring/50`; never remove outlines without a replacement.
- **Detail on demand** — secondary content hides behind an affordance and reveals in place or in a right-side `Sheet`:
  - Clicking a **connection** or **update** row opens a right `Sheet` with related people/projects.
  - **Tasks** hide descriptions/subtasks behind a comment icon that only appears when detail exists.
- **Promote frequent actions.** High-use row actions (Edit, Log) live inline as tooltip icon-buttons; rare/destructive ones (Remove) stay in the `⋯` menu.
- **Optimistic & reactive.** Adding or removing a record must feel instant — never make the user wait on a server round-trip to see their change.
  - **Optimistic:** assume the write succeeds and update the UI immediately. On add, insert a stand-in row now (built to mirror the row the server will return) and let the Server Action persist + revalidate in the background; the real row swaps in on commit. On remove, drop the row now.
  - **Reactive:** mark every appearance/disappearance with a minimal pop — a brief fade + slight rise on enter, a fade + slight shrink on leave (~0.16–0.18s). Enough to register the change, never enough to slow it down. Honors `prefers-reduced-motion`.
  - **One system.** Route all list add/remove through `useReactiveList` + `popProps` ([`components/app/reactive-list.tsx`](components/app/reactive-list.tsx)); the header's Add control and the body's table share one optimistic list via a per-record context ([`list-contexts.tsx`](components/app/list-contexts.tsx)). Motion is the `.sfrm-pop-in` / `.sfrm-pop-out` pair in `globals.css`. Don't hand-roll per-surface optimism or animation.
  - **Enter is for the new, not the routine.** Only user-added rows pop in — initial load and filtering stay still, in keeping with the calm working-tool feel.

## Components

- **Primitives** — shadcn/ui (new-york) in [`components/ui/`](components/ui); app compositions in [`components/app/`](components/app). Prefer composing existing primitives over new CSS.
- **Icons** — MynaUI via the `Icons` map in [`lib/icons.tsx`](lib/icons.tsx); reference by key, size `size-4` in rows.
- **Tag / StatusBadge / InitialsAvatar** — the canonical small tokens ([`components/app/primitives.tsx`](components/app/primitives.tsx)). Status badges add a leading dot; avatars are tone-grounded initials.
- **Tables & rows** — bordered container, `font-heading` uppercase column heads, clickable rows open a detail `Sheet`.
- **Overlays** — right `Sheet` for record detail; centered `Dialog` for focused input (e.g. General Add). Both borderless-shadow, border-defined.
- **Timeline** — two forms: a stacked-card list for point-in-time activity (connection "Recent"), and a **Gantt** for project stages — days on the horizontal axis, each stage a tone-colored block spanning start→end, with weekly gridlines and a "today" marker. Overflows scroll horizontally inside their own container; the page never scrolls sideways.

## Content

- **Voice** — plain, second-person, action-first ("Send the deck", "Line up two references"). No filler.
- **Dates** — human labels in lists ("2h ago", "Jul 9"); real ISO dates only where computed (Gantt).
- **Empty/placeholder** — one muted sentence, centered in the container.

## Checklist for new UI

- [ ] Neutral surfaces; color only where it means something
- [ ] Bordered, shadow-free, minimally rounded
- [ ] `font-heading` uppercase for titles/eyebrows; `tabular-nums` for numbers
- [ ] Rows use `hover:bg-muted/50`; controls are `cursor-pointer`
- [ ] Tokens over raw values; reuse `Tag`/`StatusBadge`/`Icons`
- [ ] Secondary detail hidden behind an affordance, not always-on
- [ ] Add/remove is optimistic + pops via `useReactiveList`/`popProps`; no waiting on the server to reflect the change
