"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { me, connections, projects } from "@/lib/data";
import { Section } from "@/components/app/layout-bits";
import { InitialsAvatar, StatusBadge } from "@/components/app/primitives";
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
/*  The page body                                                     */
/* ------------------------------------------------------------------ */

export function SettingsView() {
  // About
  const [name, setName] = useState(me.name);
  const [school, setSchool] = useState(me.school);
  const [bio, setBio] = useState(me.bio);
  const [country, setCountry] = useState(me.country);
  const [timezone, setTimezone] = useState(me.timezone);
  const [resume, setResume] = useState<string | null>(me.resume);

  // Notifications
  const [checkins, setCheckins] = useState({ on: true, value: 6, unit: "weeks" });
  const [deadlines, setDeadlines] = useState({ on: true, value: 3, unit: "days" });
  const [events, setEvents] = useState({ on: true, timing: "day-of" });

  // Integrations
  const [google, setGoogle] = useState(true);
  const [linkedin, setLinkedin] = useState(false);

  return (
    <div className="flex flex-col gap-7">
      {/* ---- About ---- */}
      <Section title="About">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3.5 border-b border-border p-4">
            <InitialsAvatar name={name} tone="slate" className="size-12 text-sm" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {me.role}
              </div>
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
              {resume ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <Icons.file className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{resume}</span>
                  <div className="ml-auto flex shrink-0 gap-1">
                    <Button variant="outline" size="sm">
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setResume(null)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="self-start">
                  <Icons.upload className="size-3.5" /> Upload resume
                </Button>
              )}
            </Field>
          </div>
        </div>
      </Section>

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
            account={me.email}
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
            <Button variant="outline" size="sm">
              <Icons.key className="size-3.5" /> Reset password
            </Button>
          </Row>
          <Row title="Sign out" description="End your session on this device.">
            <Button variant="secondary" size="sm">
              <Icons.logout className="size-3.5" /> Log out
            </Button>
          </Row>
        </Card>
      </Section>
    </div>
  );
}
