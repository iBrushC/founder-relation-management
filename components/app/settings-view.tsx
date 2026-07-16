"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { logout, requestPasswordReset } from "@/lib/auth/actions";
import { useProfile } from "@/lib/data/hooks";
import { saveProfile } from "@/lib/data/profile-actions";
import { profileExtras, type ResumeRef } from "@/lib/data/profile-shared";
import { deleteAllData } from "@/lib/data/actions";
import type { Profile } from "@/lib/data/profiles";
import { Section } from "@/components/app/layout-bits";
import { InitialsAvatar } from "@/components/app/primitives";
import { SampleDataButton } from "@/components/app/sample-data-button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { IntegrationRow } from "@/components/app/integration-row";
import { GoogleIntegrationRow } from "@/components/app/google-integration-row";
import { ResumeField } from "@/components/app/resume-field";
import { ExportSection } from "@/components/app/settings-export";
import { EditRow } from "@/components/app/edit-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const email = profile?.email ?? "";

  const [name, setName] = useState(profile?.fullName ?? "");
  const [bio, setBio] = useState(x.bio ?? "");
  const [school, setSchool] = useState(x.school ?? "");
  const [country, setCountry] = useState(x.country ?? "United States");
  const [timezone, setTimezone] = useState(x.timezone ?? "America/Los_Angeles");
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
          <EditRow label="Bio" htmlFor="bio">
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A sentence or two about what you're building."
              className="min-h-16"
            />
          </EditRow>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EditRow label="Full name" htmlFor="name" icon={Icons.user}>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </EditRow>
            <EditRow label="School / Company" htmlFor="school" icon={Icons.building}>
              <Input
                id="school"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              />
            </EditRow>
            <EditRow label="Country" icon={Icons.globe}>
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
            </EditRow>
            <EditRow label="Timezone" icon={Icons.clock}>
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
            </EditRow>
          </div>

          <EditRow label="Resume" icon={Icons.file}>
            <ResumeField
              profileId={profile?.id ?? null}
              value={resume}
              onChange={setResume}
              onSaved={onSaved}
            />
          </EditRow>
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
  const [followups, setFollowups] = useState({ on: true, count: 3, interval: 7 });

  // Integrations — Google owns its own state; LinkedIn is still a stub.
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

          <NotificationRow
            title="Outreach follow-ups"
            description="Keep nudging you until a founder replies to your outreach."
            enabled={followups.on}
            onToggle={(on) => setFollowups((s) => ({ ...s, on }))}
          >
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              Send up to
            </span>
            <Input
              type="number"
              min={1}
              value={followups.count}
              onChange={(e) =>
                setFollowups((s) => ({
                  ...s,
                  count: Math.max(1, Number(e.target.value) || 1),
                }))
              }
              className="h-7 w-14 px-2 text-center tabular-nums"
              aria-label="Number of follow-up reminders"
            />
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              follow-up reminders, one every
            </span>
            <Input
              type="number"
              min={1}
              value={followups.interval}
              onChange={(e) =>
                setFollowups((s) => ({
                  ...s,
                  interval: Math.max(1, Number(e.target.value) || 1),
                }))
              }
              className="h-7 w-14 px-2 text-center tabular-nums"
              aria-label="Days between reminders"
            />
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              days
            </span>
          </NotificationRow>
        </Card>
      </Section>

      {/* ---- Integrations ---- */}
      <Section title="Integrations">
        <Card>
          <GoogleIntegrationRow />
          {/* Still a stub: local state only, connects to nothing. */}
          <IntegrationRow
            logo="/linkedin.png"
            name="LinkedIn"
            description="Import connections and enrich profiles."
            connected={linkedin}
            account="Maya Chen"
            onConnect={() => setLinkedin(true)}
            onDisconnect={() => setLinkedin(false)}
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
      <ExportSection />

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

      {/* ---- Brand footer ---- */}
      <div className="flex flex-col items-center gap-2 pt-2 pb-1 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark from /public */}
        <img
          src="/SFRM.png"
          alt="SFRM"
          className="size-8 rounded-md opacity-90"
        />
        <p className="text-xs text-muted-foreground">
          Student Founder Relation Management
        </p>
      </div>

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
          const result = await deleteAllData();
          if (result.ok) setWiped(true);
          return result;
        }}
      />
    </div>
  );
}
