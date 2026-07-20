"use client";

import { useEffect, useRef } from "react";

type Blob = {
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  color: string;
};

const BLOBS: readonly Blob[] = [
  {
    size: 60,
    x: 12,
    y: 8,
    duration: 18,
    delay: 0,
    color: "oklch(0.62 0.09 152)",
  },
  {
    size: 50,
    x: 82,
    y: 22,
    duration: 22,
    delay: -4,
    color: "oklch(0.58 0.08 200)",
  },
  {
    size: 65,
    x: 72,
    y: 86,
    duration: 20,
    delay: -8,
    color: "oklch(0.40 0.07 158)",
  },
  {
    size: 45,
    x: 28,
    y: 78,
    duration: 24,
    delay: -12,
    color: "oklch(0.55 0.10 180)",
  },
] as const;

export function AnimatedGradientMesh() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const blobs = Array.from(
      root.querySelectorAll<HTMLDivElement>("[data-blob]"),
    );
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      for (const blob of blobs) {
        const duration = Number(blob.dataset.duration) || 20;
        const radius = Number(blob.dataset.radius) || 18;
        const phase = (t / duration) * Math.PI * 2;
        const x = Math.sin(phase) * radius;
        const y = Math.cos(phase * 0.8) * radius * 0.7;
        blob.style.transform = `translate(${x}vw, ${y}vh)`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} aria-hidden className="absolute inset-0 overflow-hidden">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          data-blob
          data-duration={b.duration}
          data-radius={18}
          className="absolute rounded-full blur-3xl"
          style={{
            width: `${b.size}%`,
            height: `${b.size}%`,
            left: `${b.x}%`,
            top: `${b.y}%`,
            background: `radial-gradient(closest-side, ${b.color} 0%, transparent 70%)`,
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}