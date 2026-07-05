import Link from "next/link";
import type { Metadata } from "next";
import { LandingDemo } from "@/components/marketing/landing-demo";
import { TileBackground } from "@/components/marketing/tile-background";

export const metadata: Metadata = {
  title: "SFRM. Keep every founder relationship warm",
  description:
    "A simple rolodex for student founders: people, projects, and follow-ups in one place.",
};

const SCHOOLS = ["Cornell", "Harvard", "Stanford", "MIT"];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-full flex-col">
      <TileBackground />

      {/* Top bar */}
      <header
        className="landing-fade mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5"
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-primary font-heading text-sm font-bold text-primary-foreground">
            S
          </span>
          <span className="font-heading text-sm font-bold tracking-tight">SFRM</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6">
        <section
          className="landing-fade flex max-w-2xl flex-col items-center py-16 text-center sm:py-24"
          style={{ animationDelay: "0.05s" }}
        >
          <span className="eyebrow">Student Founder Relationship Management</span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Keep every founder relationship warm.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
            A calm, single place for the people, projects, and events you need to maintain and grow your network.
            Never miss an opportunity.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
          <p className="mt-3 max-w-xl text-xs text-muted-foreground opacity-[0.5] text-pretty sm:text-lg">
            (it&apos;s completely free)
          </p>
        </section>

        {/* Social proof */}
        <section
          className="landing-fade w-full max-w-2xl pb-6"
          style={{ animationDelay: "0.11s" }}
        >
          <p className="eyebrow mb-4 text-center">Trusted by founders at</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {SCHOOLS.map((school) => (
              <span
                key={school}
                className="font-heading text-lg font-bold tracking-[0.1em] text-muted-foreground/70 uppercase"
              >
                {school}
              </span>
            ))}
          </div>
        </section>

        {/* Interactive product demo */}
        <section
          className="landing-fade w-full max-w-3xl pt-6 pb-20"
          style={{ animationDelay: "0.17s" }}
        >
          <p className="eyebrow mb-3 text-center">Simple, easy, and free. The way it should be</p>
          <LandingDemo />
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8">
        <p className="text-xs text-muted-foreground">
          Student Founder Relation Management
        </p>
      </footer>
    </div>
  );
}
