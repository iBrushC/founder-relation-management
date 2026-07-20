import Link from "next/link";
import type { Metadata } from "next";
import { LandingDemo } from "@/components/marketing/landing-demo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TileBackground } from "@/components/marketing/tile-background";

export const metadata: Metadata = {
  title: "SFRM. Keep every founder relationship warm",
  description:
    "A simple rolodex for student founders: people, projects, and follow-ups in one place.",
};

type School = { name: string; src: string; height?: number };

const SCHOOLS: School[] = [
  { name: "Cornell", src: "/500px-Cornell_University_Logo.png", height: 28*2 },
  { name: "Harvard", src: "/500px-Harvard_University_shield.png", height: 30*2 },
  { name: "Stanford", src: "/Seal_of_Leland_Stanford_Junior_University.svg", height: 28*2 },
  { name: "MIT", src: "/MIT_logo_2003-2023.svg", height: 20*2 },
];

type Plan = {
  name: string;
  price: { value: string; suffix?: string };
  badge?: { label: string; tone: "primary" | "neutral" };
  body: string;
  cta: { label: string; href: string; variant: "primary" | "secondary" };
};

const PLANS: Plan[] = [
  {
    name: "Free",
    price: { value: "$0" },
    badge: { label: "Works for most people", tone: "neutral" },
    body: "All core functionality. Unlimited connections, projects, events, and reminders.",
    cta: { label: "Get started", href: "/signup", variant: "primary" },
  },
  {
    name: "Speedy",
    price: { value: "$1", suffix: "/wk" },
    body: "Everything in Free, plus quick-add and Gmail integration.",
    cta: { label: "Get started", href: "/signup", variant: "secondary" },
  },
  {
    name: "Discovery",
    price: { value: "$1", suffix: "/wk" },
    body: "Everything in Speedy, plus AI features for finding events, finding people, and searching your connections and interactions.",
    cta: { label: "Get started", href: "/signup", variant: "secondary" },
  },
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-full flex-col">
      <TileBackground />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6">
        {/* Hero */}
        <section
          className="landing-fade flex max-w-2xl flex-col items-center py-20 text-center sm:py-28"
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
            <Link
              href="/login"
              className="rounded-md border border-input px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              Log in
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
          <p className="eyebrow mb-5 text-center">Trusted by founders at</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {SCHOOLS.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element -- static brand mark from /public
              <img
                key={s.name}
                src={s.src}
                alt={s.name}
                style={{ height: s.height }}
                className="w-auto opacity-60 grayscale"
              />
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

        {/* Pricing */}
        <section
          className="landing-fade w-full max-w-5xl pb-24"
          style={{ animationDelay: "0.23s" }}
        >
          <div className="text-center">
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              100% Free For Most, Extra Features if You Want
            </h2>
            <p className="mt-3 text-sm text-muted-foreground text-pretty sm:text-base">
              Start free. Add power features when you need them.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className="flex flex-col rounded-xl border border-border bg-card p-6 min-h-[26rem]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-bold tracking-[0.14em] uppercase">
                    {plan.name}
                  </h3>
                  {plan.badge ? (
                    <span
                      className={
                        plan.badge.tone === "primary"
                          ? "inline-flex h-5 items-center rounded-[5px] bg-primary px-2 text-[10px] font-semibold text-primary-foreground"
                          : "inline-flex h-5 items-center rounded-[5px] bg-secondary px-2 text-[10px] font-semibold text-secondary-foreground"
                      }
                    >
                      {plan.badge.label}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">{plan.price.value}</span>
                  {plan.price.suffix ? (
                    <span className="text-sm text-muted-foreground">{plan.price.suffix}</span>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {plan.body}
                </p>

                <Link
                  href={plan.cta.href}
                  className={
                    plan.cta.variant === "primary"
                      ? "mt-auto inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      : "mt-auto inline-flex items-center justify-center rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                  }
                >
                  {plan.cta.label}
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter className="mx-auto w-full max-w-5xl px-6 py-8" />
    </div>
  );
}
