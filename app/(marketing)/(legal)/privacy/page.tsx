import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SFRM",
  description:
    "What SFRM stores, who it is shared with, and how to get it deleted.",
};

const ISSUES_URL = "https://github.com/iBrushC/founder-relation-management/issues";

export default function PrivacyPage() {
  return (
    <>
      <h1 className="font-heading text-lg font-bold tracking-tight text-foreground uppercase">
        Privacy Policy
      </h1>
      <p className="mt-1 text-xs tabular-nums">Last updated: July 16, 2026</p>

      <p className="mt-6">
        SFRM (Student Founder Relation Management) is a personal CRM for student
        founders. This policy explains what the hosted version at sfrm.network
        stores, who else can see it, and how to get rid of it. It is short
        because the app does not do much with your data: there is no analytics,
        no tracking, no advertising, and nothing is sold.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account.</strong> Your name, email address, and a hashed
          password. If you sign in, we keep a session cookie so you stay signed
          in.
        </li>
        <li>
          <strong>Your profile.</strong> Anything you choose to add in Settings —
          bio, school, country, timezone, avatar, and a resume file if you upload
          one.
        </li>
        <li>
          <strong>Everything you put in the app.</strong> Your connections and
          their details (name, role, company, email, phone, location, LinkedIn,
          birthday, tags, notes, and logged interactions), your projects, tasks,
          stages, outreach records, and events — including names of people you
          note meeting at an event.
        </li>
        <li>
          <strong>A Google connection, if you make one.</strong> If you link a
          Google account, we store your Google account ID, the email on it, and
          your access and refresh tokens (encrypted at rest). See below.
        </li>
      </ul>

      <p>
        We do not use cookies for tracking. The only cookies SFRM sets are the
        ones needed to keep you signed in and to complete a Google connection.
      </p>

      <h2>Data about other people</h2>
      <p>
        Most of what SFRM holds is information about people who are not SFRM
        users and never signed up — that is what a rolodex is. You are
        responsible for what you record about them and for having a legitimate
        reason to keep it. Only you can see your records; we do not build a
        shared or cross-user directory out of them, and one user&rsquo;s data is
        never shown to another.
      </p>

      <h2>Who we share it with</h2>
      <p>SFRM sends data to three outside services, and no others.</p>
      <ul>
        <li>
          <strong>Supabase</strong> hosts the whole thing — accounts, database,
          and uploaded resumes — and sends account emails such as password
          resets. All of your data lives here.
        </li>
        <li>
          <strong>OpenRouter</strong> powers Quick Add, the box that turns a typed
          sentence into records. When you use it, we send what you typed and
          today&rsquo;s date to a language model through OpenRouter. To let the
          model find the right record, it may also receive names, companies,
          roles, and titles of matching connections, events, and outreach entries
          already in your account. <strong>If you would rather no contact data
          reach a model provider, do not use Quick Add</strong> — the rest of the
          app never calls it.
        </li>
        <li>
          <strong>Google</strong>, only if you connect a Google account. We send
          Google your email as a sign-in hint during the connection and exchange
          tokens with it.
        </li>
      </ul>
      <p>
        We do not sell your data, share it with advertisers, or hand it to anyone
        else except where the law requires it.
      </p>

      <h2>About the Google connection</h2>
      <p>
        Connecting Google currently asks for permission to read your Gmail. To be
        straightforward about it: <strong>SFRM does not read your mail today.</strong>{" "}
        The permission is requested and the token stored for a mail-matching
        feature that is not built yet. Nothing in the app reads, imports, or
        analyzes your messages. If that changes, this policy will change first.
        You can disconnect Google at any time from Settings, which deletes the
        stored tokens, and you can also revoke access from your Google account
        settings.
      </p>

      <h2>How it is protected</h2>
      <p>
        Every record is tied to your account and enforced at the database level,
        so another user cannot read your rows even in the event of a bug in the
        app. Resume uploads live in a private storage bucket scoped to your
        account. Google tokens are encrypted before being stored. No system is
        perfect, and SFRM is a small open-source project run by a student — please
        do not store anything you could not stand to lose or leak.
      </p>

      <h2>Getting, keeping, and deleting your data</h2>
      <p>
        We keep your data for as long as your account exists. You can edit or
        delete individual records in the app at any time, and{" "}
        <strong>Settings &rarr; Export</strong> will download everything you have
        — people, projects, tasks, events, and notes — as a JSON file, whenever
        you want and without asking us. To have your account and everything in it
        deleted, <a href={ISSUES_URL}>open an issue</a> and ask — we will remove
        it. Backups may take a short while longer to age out.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes in a way that matters, the date above changes and
        the update will be visible in the public repository. Questions or
        requests: <a href={ISSUES_URL}>open an issue on GitHub</a>.
      </p>
    </>
  );
}
