"use client";

import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { me, connections, projects } from "@/lib/data";
import { logout, requestPasswordReset } from "@/lib/auth/actions";
import { useProfile } from "@/lib/data/hooks";
import { saveProfile, saveResume } from "@/lib/data/profile-actions";
import { profileExtras, type ResumeRef } from "@/lib/data/profile-shared";
import { deleteAllData } from "@/lib/data/actions";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data/profiles";
import { Section } from "@/components/app/layout-bits";
import { InitialsAvatar, StatusBadge } from "@/components/app/primitives";
import { SampleDataButton } from "@/components/app/sample-data-button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Small layout helpers — bordered, shadow-free, per the style guide  */
/* ------------------------------------------------------------------ */

/** A bordered group whose direct children are divided by hairlines. */
function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border rounded-lg border border-border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One setting row: label + description on the left, control on the right. */
function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** A vertically-stacked label + control, used inside the About form. */
function Field({
  label,
  htmlFor,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  icon?: (typeof Icons)[keyof typeof Icons];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="gap-1.5 text-xs font-medium text-muted-foreground"
      >
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </Label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Notification Settings                                     */
/* ------------------------------------------------------------------ */

const UNITS = ["days", "weeks", "months"] as const;
const EVENT_TIMING = [
  { value: "day-of", label: "Day of" },
  { value: "1-day", label: "1 day before" },
  { value: "3-day", label: "3 days before" },
  { value: "1-week", label: "1 week before" },
] as const;

function NotificationRow({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Checkbox
        checked={enabled}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={`Enable ${title}`}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center gap-1.5",
          !enabled && "pointer-events-none opacity-40",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A number field + unit select + trailing phrase ("6 weeks after last contact"). */
function IntervalControl({
  value,
  unit,
  onValue,
  onUnit,
  trailing,
}: {
  value: number;
  unit: string;
  onValue: (n: number) => void;
  onUnit: (u: string) => void;
  trailing: string;
}) {
  return (
    <>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onValue(Math.max(1, Number(e.target.value) || 1))}
        className="h-7 w-14 px-2 text-center tabular-nums"
        aria-label="Amount"
      />
      <Select value={unit} onValueChange={onUnit}>
        <SelectTrigger size="sm" aria-label="Unit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {trailing}
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Integrations                                              */
/* ------------------------------------------------------------------ */

function IntegrationRow({
  icon: Icon,
  name,
  description,
  connected,
  account,
  onToggle,
}: {
  icon: (typeof Icons)[keyof typeof Icons];
  name: string;
  description: string;
  connected: boolean;
  account: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/50">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{name}</div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {connected ? `Connected · ${account}` : description}
        </p>
      </div>
      {connected ? (
        <div className="flex items-center gap-2">
          <StatusBadge label="Connected" tone="green" />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onToggle}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={onToggle}>
          <Icons.link className="size-3.5" /> Connect
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Export — real client-side JSON download                  */
/* ------------------------------------------------------------------ */

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportRow({
  title,
  description,
  onExport,
}: {
  title: string;
  description: string;
  onExport: () => void;
}) {
  return (
    <Row title={title} description={description}>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Icons.download className="size-3.5" /> Export
      </Button>
    </Row>
  );
}

/* ------------------------------------------------------------------ */
/*  Resume upload — real Supabase Storage upload to the `resumes` bucket */
/* ------------------------------------------------------------------ */

const RESUME_ACCEPT = ".pdf,.doc,.docx,.txt";

/** Strip characters that would break a storage path segment. */
function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "resume";
}

/**
 * Uploads a resume to the private `resumes` bucket (path scoped to the user's id
 * so RLS allows it) and persists the `{ path, name }` reference to the profile
 * immediately. Viewing opens a short-lived signed URL. Remove deletes the object.
 */
function ResumeField({
  profileId,
  value,
  onChange,
  onSaved,
}: {
  profileId: string | null;
  value: ResumeRef | null;
  onChange: (value: ResumeRef | null) => void;
  onSaved: (profile: Profile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "upload" | "remove" | "view">(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: ResumeRef | null) {
    const res = await saveResume(next);
    if (res.ok) onSaved(res.profile);
    else setError(res.error);
  }

  async function handleFile(file: File) {
    if (!profileId) {
      setError("Sign in to upload a resume.");
      return;
    }
    setError(null);
    setBusy("upload");
    try {
      const supabase = createClient();
      const path = `${profileId}/${Date.now()}-${safeName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      // Drop the previous file so the bucket doesn't accumulate orphans.
      if (value?.path) {
        await supabase.storage.from("resumes").remove([value.path]);
      }
      const ref: ResumeRef = { path, name: file.name };
      onChange(ref);
      await persist(ref);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy("remove");
    try {
      if (value?.path) {
        const supabase = createClient();
        await supabase.storage.from("resumes").remove([value.path]);
      }
      onChange(null);
      await persist(null);
    } finally {
      setBusy(null);
    }
  }

  async function handleView() {
    if (!value?.path) return;
    setError(null);
    setBusy("view");
    try {
      const supabase = createClient();
      const { data, error: signErr } = await supabase.storage
        .from("resumes")
        .createSignedUrl(value.path, 60);
      if (signErr || !data) {
        setError(signErr?.message ?? "Couldn't open the resume.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={RESUME_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <Icons.file className="size-4 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={handleView}
            disabled={busy !== null}
            className="truncate text-sm font-medium hover:underline disabled:no-underline"
            title="Open resume"
          >
            {busy === "view" ? "Opening…" : value.name}
          </button>
          <div className="ml-auto flex shrink-0 gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
            >
              {busy === "upload" ? "Uploading…" : "Replace"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleRemove}
              disabled={busy !== null}
            >
              {busy === "remove" ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
        >
          <Icons.upload className="size-3.5" />
          {busy === "upload" ? "Uploading…" : "Upload resume"}
        </Button>
      )}

      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : (
        <span className="text-xs text-muted-foreground">
          PDF, Word, or text · up to 5 MB
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: About — the editable profile form                         */
/* ------------------------------------------------------------------ */

/**
 * The "About" card. Its form state is seeded from `profile` via useState
 * initializers, so the parent remounts it (via `key`) when the real profile
 * loads rather than pushing new values in with an effect or a render-phase set.
 */
function AboutSection({
  profile,
  onSaved,
}: {
  profile: Profile | null;
  onSaved: (profile: Profile) => void;
}) {
  const x = profileExtras(profile);
  const email = profile?.email || me.email;

  const [name, setName] = useState(profile?.fullName || me.name);
  const [bio, setBio] = useState(x.bio ?? me.bio);
  const [school, setSchool] = useState(x.school ?? me.school);
  const [country, setCountry] = useState(x.country ?? me.country);
  const [timezone, setTimezone] = useState(x.timezone ?? me.timezone);
  const [resume, setResume] = useState<ResumeRef | null>(x.resume ?? null);

  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  function handleSave() {
    setSaveError(null);
    setSaved(false);
    startSaving(async () => {
      const res = await saveProfile({
        fullName: name,
        bio,
        school,
        country,
        timezone,
        resume,
      });
      if (res.ok) {
        onSaved(res.profile);
        setSaved(true);
      } else {
        setSaveError(res.error);
      }
    });
  }

  return (
    <Section title="About">
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3.5 border-b border-border p-4">
          <InitialsAvatar name={name} tone="slate" className="size-12 text-sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          </div>
          <Button variant="outline" size="sm" className="ml-auto">
            <Icons.upload className="size-3.5" /> Change photo
          </Button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <Field label="Bio" htmlFor="bio">
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A sentence or two about what you're building."
              className="min-h-16"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="name" icon={Icons.user}>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="School / Company" htmlFor="school" icon={Icons.building}>
              <Input
                id="school"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              />
            </Field>
            <Field label="Country" icon={Icons.globe}>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "United States",
                    "Canada",
                    "United Kingdom",
                    "Germany",
                    "India",
                    "Singapore",
                    "Australia",
                    "Other",
                  ].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Timezone" icon={Icons.clock}>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ["America/Los_Angeles", "Pacific — Los Angeles"],
                    ["America/Denver", "Mountain — Denver"],
                    ["America/Chicago", "Central — Chicago"],
                    ["America/New_York", "Eastern — New York"],
                    ["Europe/London", "GMT — London"],
                    ["Europe/Berlin", "CET — Berlin"],
                    ["Asia/Kolkata", "IST — Kolkata"],
                    ["Asia/Singapore", "SGT — Singapore"],
                  ].map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Resume" icon={Icons.file}>
            <ResumeField
              profileId={profile?.id ?? null}
              value={resume}
              onChange={setResume}
              onSaved={onSaved}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
          {saveError ? (
            <span className="text-xs text-destructive">{saveError}</span>
          ) : saved ? (
            <span className="text-xs text-muted-foreground">Profile saved.</span>
          ) : null}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  The page body                                                     */
/* ------------------------------------------------------------------ */

export function SettingsView() {
  // The signed-in user's real profile (name/email + extended fields in settings).
  const { profile, isLoading, mutate } = useProfile();
  const email = profile?.email || me.email;

  // Account actions — reset password and sign out.
  const [resetting, startResetting] = useTransition();
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  function handleResetPassword() {
    setResetMsg(null);
    startResetting(async () => {
      const res = await requestPasswordReset();
      setResetMsg(
        res.ok
          ? "Reset link sent — check your email."
          : "Couldn't send a reset link.",
      );
    });
  }

  const [loggingOut, startLoggingOut] = useTransition();

  // Notifications
  const [checkins, setCheckins] = useState({ on: true, value: 6, unit: "weeks" });
  const [deadlines, setDeadlines] = useState({ on: true, value: 3, unit: "days" });
  const [events, setEvents] = useState({ on: true, timing: "day-of" });

  // Integrations
  const [google, setGoogle] = useState(true);
  const [linkedin, setLinkedin] = useState(false);

  // Danger zone — wipe all CRM data (keeps the account).
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiped, setWiped] = useState(false);

  return (
    <div className="flex flex-col gap-7">
      {/* ---- About ---- */}
      {/*
        Keyed by the profile id so the form remounts — and re-seeds its state
        from the loaded profile via useState initializers — once the real
        profile arrives. This avoids setting state during the parent's render.
      */}
      <AboutSection
        key={isLoading ? "loading" : (profile?.id ?? "anon")}
        profile={profile}
        onSaved={(p) => mutate(p, { revalidate: false })}
      />

      {/* ---- Notification Settings ---- */}
      <Section title="Notification Settings">
        <Card>
          <NotificationRow
            title="Check-ins"
            description="Nudge you to reconnect when a relationship goes quiet."
            enabled={checkins.on}
            onToggle={(on) => setCheckins((s) => ({ ...s, on }))}
          >
            <IntervalControl
              value={checkins.value}
              unit={checkins.unit}
              onValue={(value) => setCheckins((s) => ({ ...s, value }))}
              onUnit={(unit) => setCheckins((s) => ({ ...s, unit }))}
              trailing="after last contact"
            />
          </NotificationRow>

          <NotificationRow
            title="Upcoming deadlines"
            description="Remind you before a task or project deadline lands."
            enabled={deadlines.on}
            onToggle={(on) => setDeadlines((s) => ({ ...s, on }))}
          >
            <IntervalControl
              value={deadlines.value}
              unit={deadlines.unit}
              onValue={(value) => setDeadlines((s) => ({ ...s, value }))}
              onUnit={(unit) => setDeadlines((s) => ({ ...s, unit }))}
              trailing="before due"
            />
          </NotificationRow>

          <NotificationRow
            title="Social events"
            description="Birthdays, mixers, and meetups on your calendar."
            enabled={events.on}
            onToggle={(on) => setEvents((s) => ({ ...s, on }))}
          >
            <Select
              value={events.timing}
              onValueChange={(timing) => setEvents((s) => ({ ...s, timing }))}
            >
              <SelectTrigger size="sm" aria-label="When to notify">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TIMING.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </NotificationRow>
        </Card>
      </Section>

      {/* ---- Integrations ---- */}
      <Section title="Integrations">
        <Card>
          <IntegrationRow
            icon={Icons.google}
            name="Google"
            description="Sync contacts and calendar events."
            connected={google}
            account={email}
            onToggle={() => setGoogle((v) => !v)}
          />
          <IntegrationRow
            icon={Icons.linkedin}
            name="LinkedIn"
            description="Import connections and enrich profiles."
            connected={linkedin}
            account="Maya Chen"
            onToggle={() => setLinkedin((v) => !v)}
          />
        </Card>
      </Section>

      {/* ---- Sample data ---- */}
      <Section title="Sample data">
        <Card>
          <Row
            title="Load sample data"
            description="Fill your account with the Maya Chen demo dataset — people, projects, tasks, and events. Replaces any existing CRM data."
          >
            <SampleDataButton />
          </Row>
        </Card>
      </Section>

      {/* ---- Export ---- */}
      <Section title="Export">
        <Card>
          <ExportRow
            title="All data"
            description="Everything — people, projects, tasks, and notes."
            onExport={() =>
              downloadJSON("sfrm-export.json", { connections, projects })
            }
          />
          <ExportRow
            title="People"
            description="All your connections and their notes."
            onExport={() => downloadJSON("sfrm-people.json", connections)}
          />
          <ExportRow
            title="Projects"
            description="All projects with their tasks and timelines."
            onExport={() => downloadJSON("sfrm-projects.json", projects)}
          />
        </Card>
      </Section>

      {/* ---- Account ---- */}
      <Section title="Account">
        <Card>
          <Row
            title="Password"
            description="Send a reset link to your email address."
          >
            {resetMsg ? (
              <span className="text-xs text-muted-foreground">{resetMsg}</span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetPassword}
              disabled={resetting}
            >
              <Icons.key className="size-3.5" />
              {resetting ? "Sending…" : "Reset password"}
            </Button>
          </Row>
          <Row title="Sign out" description="End your session on this device.">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => startLoggingOut(() => logout())}
              disabled={loggingOut}
            >
              <Icons.logout className="size-3.5" />
              {loggingOut ? "Signing out…" : "Log out"}
            </Button>
          </Row>
        </Card>
      </Section>

      {/* ---- Danger zone ---- */}
      <Section title="Danger zone">
        <div className="divide-y divide-destructive/20 rounded-lg border border-destructive/30 bg-destructive/[0.03]">
          <Row
            title="Delete all data"
            description="Permanently remove all connections, projects, tasks, events, and outreach. Your account and login stay active. This can't be undone."
          >
            {wiped ? (
              <span className="text-xs text-muted-foreground">
                All data deleted.
              </span>
            ) : null}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setWiped(false);
                setConfirmWipe(true);
              }}
            >
              <Icons.trash className="size-3.5" /> Delete all data
            </Button>
          </Row>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title="Delete all data"
        description={
          <>
            This permanently deletes every connection, project, task, event, and
            outreach record in your workspace. Your account stays active, but the
            data can&apos;t be recovered.
          </>
        }
        confirmLabel="Delete everything"
        confirmPhrase="DELETE"
        onConfirm={async () => {
          await deleteAllData();
          setWiped(true);
        }}
      />
    </div>
  );
}
