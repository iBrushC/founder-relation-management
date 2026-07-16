import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
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
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <article
          className="max-w-3xl text-sm leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-9 [&_h2]:mb-2.5 [&_h2]:font-heading [&_h2]:text-sm [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:uppercase [&_li]:my-1 [&_p]:my-2.5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-5"
        >
          {children}
        </article>
      </main>

      <SiteFooter className="mx-auto w-full max-w-5xl border-t border-border px-6 py-8" />
    </div>
  );
}
