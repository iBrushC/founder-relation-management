/**
 * Static patterned background for the landing page.
 *
 * Two layered, deterministic CSS patterns — a faint dot grid and a softer
 * diagonal hairline — masked with a radial fade from the bottom so the hero
 * stays clean. No `@keyframes`, no per-tile animation, no JS: server and
 * client render identically and `prefers-reduced-motion` is honored by
 * virtue of there being nothing to disable.
 */

const DOT_SIZE = 24; // px — dot grid cell
const STRIPE_SIZE = 96; // px — diagonal stripe tile

export function TileBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        maskImage:
          "radial-gradient(125% 115% at 50% 100%, black 45%, transparent 92%)",
        WebkitMaskImage:
          "radial-gradient(125% 115% at 50% 100%, black 45%, transparent 92%)",
      }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: `radial-gradient(oklch(0.53 0.066 152 / 0.18) 1px, transparent 1px)`,
          backgroundSize: `${DOT_SIZE}px ${DOT_SIZE}px`,
          backgroundPosition: `0 0`,
        }}
      />

      {/* Diagonal hairline stripes */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            135deg,
            transparent 0,
            transparent ${STRIPE_SIZE - 1}px,
            oklch(0.53 0.066 152 / 0.12) ${STRIPE_SIZE - 1}px,
            oklch(0.53 0.066 152 / 0.12) ${STRIPE_SIZE}px
          )`,
        }}
      />
    </div>
  );
}
