import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — SFRM",
  description: "The rules for using SFRM, in plain language.",
};

const ISSUES_URL = "https://github.com/iBrushC/founder-relation-management/issues";
const LICENSE_URL = "https://creativecommons.org/licenses/by-nc/4.0/";

export default function TermsPage() {
  return (
    <>
      <h1 className="font-heading text-lg font-bold tracking-tight text-foreground uppercase">
        Terms of Service
      </h1>
      <p className="mt-1 text-xs tabular-nums">Last updated: July 16, 2026</p>

      <p className="mt-6">
        These terms cover the hosted version of SFRM at sfrm.network. Using it
        means you agree to them. They are deliberately short — SFRM is a small
        open-source tool, not an enterprise product.
      </p>

      <h2>Your account</h2>
      <p>
        Sign up with a real email address you control, and keep your password to
        yourself. You are responsible for what happens under your account. If you
        are under 13, you cannot use SFRM.
      </p>

      <h2>What you can and cannot do</h2>
      <p>
        Use SFRM to keep track of your own network and projects. Do not use it to
        store unlawful content, to harass anyone, to attack or overload the
        service, or to scrape or resell other people&rsquo;s information. Since
        SFRM is mostly a record of people who are not users themselves, you agree
        that you have a legitimate reason to keep what you record, that you will
        keep it accurate and reasonable, and that you will delete it on request
        from the person it describes.
      </p>

      <h2>Your data is yours</h2>
      <p>
        You keep ownership of everything you put into SFRM. You grant us only the
        permission needed to run the service for you — storing your records,
        showing them back to you, and passing them to the services named in the{" "}
        <a href="/privacy">Privacy Policy</a>. We do not claim any other rights to
        your content.
      </p>

      <h2>Pricing</h2>
      <p>
        The core of SFRM — connections, projects, events, tasks, and outreach — is
        free. The AI features are paid: <strong>$1 per week for basic AI</strong>{" "}
        and <strong>$3 per week for advanced AI</strong>, in US dollars. Paid
        plans are not being billed yet; until checkout is live, nothing is
        charged and no payment details are collected. When billing starts, plans
        renew weekly until you cancel, cancelling stops the next renewal but does
        not refund the current week, and we will give notice here before any price
        changes. Losing a paid plan never deletes records you already made.
      </p>

      <h2>AI features</h2>
      <p>
        Quick Add sends what you type to a language model, which then creates and
        edits records in your account on your behalf. Models get things wrong —
        check what it produced before relying on it. You are responsible for the
        records that result, and you can always edit or delete them.
      </p>

      <h2>The source code</h2>
      <p>
        SFRM is open source under the{" "}
        <a href={LICENSE_URL}>CC BY-NC 4.0 license</a>, which lets you share,
        adapt, and self-host it but not sell it. That license covers the code.
        These terms cover the hosted service, and the two are separate — running
        your own copy is governed by the license, not by this page.
      </p>

      <h2>No warranty, and limits</h2>
      <p>
        SFRM is provided as-is, with no guarantee that it will be available,
        error-free, or that your data will never be lost. Keep your own copy of
        anything you cannot afford to lose. To the fullest extent the law allows,
        we are not liable for lost data, lost opportunities, or other damages
        arising from your use of the service.
      </p>

      <h2>Ending things</h2>
      <p>
        You can stop using SFRM whenever you want and ask us to delete your
        account — see the <a href="/privacy">Privacy Policy</a>. We may suspend or
        remove an account that breaks these terms or puts the service or other
        people at risk.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If these terms change, the date above changes, and the history is public
        in the repository. Continuing to use SFRM after a change means you accept
        it. Questions: <a href={ISSUES_URL}>open an issue on GitHub</a>.
      </p>
    </>
  );
}
