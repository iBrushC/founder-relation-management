"use client";

import { useRef, useState } from "react";
import { Icons } from "@/lib/icons";
import { saveResume } from "@/lib/data/profile-actions";
import type { ResumeRef } from "@/lib/data/profile-shared";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/data/profiles";
import { Button } from "@/components/ui/button";

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
export function ResumeField({
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
