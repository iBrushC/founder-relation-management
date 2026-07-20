"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

const copy = {
  login: {
    eyebrow: "Welcome back",
    title: "Sign in",
    submit: "Sign in",
    alt: "Need an account?",
    altHref: "/signup",
    altLabel: "Create one",
  },
  signup: {
    eyebrow: "Get started",
    title: "Create account",
    submit: "Create account",
    alt: "Already have an account?",
    altHref: "/login",
    altLabel: "Sign in",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );
  const t = copy[mode];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1 className="font-heading text-2xl font-bold tracking-tight uppercase">
          {t.title}
        </h1>
      </div>

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {mode === "signup" && (
          <Field
            id="fullName"
            name="fullName"
            label="Name"
            type="text"
            autoComplete="name"
            placeholder="Maya Chen"
            error={state.fieldErrors?.fullName}
          />
        )}

        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@school.edu"
          defaultValue={state.email}
          error={state.fieldErrors?.email}
        />

        <Field
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="••••••••"
          error={state.fieldErrors?.password}
        />

        {mode === "login" && (
          <div className="-mt-2 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        )}

        {state.error && (
          <p className="rounded-md tone-red px-3 py-2 text-sm" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? "One moment…" : t.submit}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t.alt}{" "}
        <Link
          href={t.altHref}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t.altLabel}
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  id,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} {...props} />
      {error && <p className="text-xs tone-red-ink">{error}</p>}
    </div>
  );
}
