/**
 * Dynamic tile background for the landing page. A fixed grid of hairline tiles
 * (matching the "borders, not shadows" language) where a deterministic subset
 * slowly pulses a faint sage — enough motion to feel alive, calm enough to sit
 * behind content. Positions/timing come from a seeded sine hash so server and
 * client render identically (no hydration mismatch), letting this stay a plain
 * server component with pure-CSS animation.
 */

const TILE = 32; // px per cell (quarter the area of the original 64px tile)
const COUNT = 2100; // enough to cover large viewports; overflow is clipped

/** Deterministic pseudo-random in [0, 1) — stable across server/client. */
function rand(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function TileBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-50"
      style={{
        maskImage:
          "radial-gradient(125% 115% at 50% 100%, black 45%, transparent 92%)",
        WebkitMaskImage:
          "radial-gradient(125% 115% at 50% 100%, black 45%, transparent 92%)",
      }}
    >
      <div
        className="grid h-[calc(100%+32px)] w-[calc(100%+32px)]"
        style={{
          gridTemplateColumns: `repeat(auto-fill, ${TILE}px)`,
          gridAutoRows: `${TILE}px`,
        }}
      >
        {Array.from({ length: COUNT }).map((_, i) => {
          const lit = rand(i, 1) > 0.3;
          return (
            <div key={i} className="border-r border-b border-border/40">
              {lit ? (
                <div
                  className="sfrm-tile size-full bg-primary"
                  style={
                    {
                      // Desync each tile; cycle is at quickest 2s, up to ~6s.
                      animationDelay: `${(rand(i, 2) * 10).toFixed(2)}s`,
                      animationDuration: `${(2 + rand(i, 4) * 10).toFixed(2)}s`,
                      "--tile-peak": (0.02 + rand(i, 4) * 0.12).toFixed(3),
                    } as React.CSSProperties
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
