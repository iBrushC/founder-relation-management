import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AnimatedGradientMesh } from "@/components/marketing/animated-gradient-mesh";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full">
      {/* Form column — ~35% on desktop, full width on mobile */}
      <div className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-[35%] lg:min-w-[380px]">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark from /public */}
          <img
            src="/SFRM.png"
            alt="SFRM"
            className="size-7 shrink-0 rounded-md"
          />
          <span className="font-heading text-sm font-bold tracking-tight">
            SFRM
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <SiteFooter />
      </div>

      {/* Brand column — gradient patterns + quote, hidden on small screens */}
      <QuotePanel />
    </div>
  );
}

function QuotePanel() {
  return (
    <div className="relative hidden flex-1 overflow-hidden bg-primary lg:block">
      {/* Drifting sage/teal gradient blobs */}
      <AnimatedGradientMesh />
      {/* Faint grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(1 0 0 / 0.6) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(1 0 0 / 0.6) 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(100% 100% at 50% 40%, black 30%, transparent 90%)",
        }}
      />
      {/* Soft vignette for legibility */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 40%, oklch(0.30 0.05 155 / 0.35) 100%)" }}
      />

      <figure className="relative flex h-full flex-col justify-center px-14 xl:px-20">
        <blockquote className="max-w-xl text-[2rem] leading-[1.2] font-semibold tracking-tight text-primary-foreground xl:text-4xl xl:leading-[1.2]">
          &ldquo;Everyone you will ever meet knows something you don&rsquo;t.&rdquo;
        </blockquote>
        <figcaption className="mt-6 font-heading text-xs tracking-[0.14em] text-primary-foreground/70 uppercase">
          — Bill Nye
        </figcaption>
      </figure>
    </div>
  );
}
