"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  fieldErrors?: {
    fullName?: string;
    email?: string;
    password?: string;
  };
};

const email = z.email("Enter a valid email address.");
const password = z.string().min(8, "Password must be at least 8 characters.");

const LoginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

const SignupSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name."),
  email,
  password,
});

/** Take the first message per field from a Zod error into our flat AuthState shape. */
function fieldErrors(error: z.ZodError): AuthState["fieldErrors"] {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[]>;
  const out: Record<string, string> = {};
  for (const [key, msgs] of Object.entries(flat)) {
    if (msgs?.[0]) out[key] = msgs[0];
  }
  return out;
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password." };

  redirect("/");
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = SignupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Read by the handle_new_user() trigger to populate profiles.full_name.
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) return { error: error.message };

  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Email the signed-in user a password-reset link. The link lands on the URL
 * configured as the Supabase project's Site URL. Returns a plain result so the
 * Settings UI can show inline feedback without exposing whether the address
 * exists.
 */
export async function requestPasswordReset(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false };

  const { error } = await supabase.auth.resetPasswordForEmail(user.email);
  return { ok: !error };
}
