import Link from "next/link";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <p>Student Founder Relation Management</p>
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="transition-colors hover:text-foreground">
          Terms
        </Link>
      </div>
    </footer>
  );
}
