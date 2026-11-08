"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, firstError } from "@/lib/validation";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

/** Messages d'erreur Supabase traduits en français clair. */
function translateAuthError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Trop de demandes en peu de temps. Réessaie dans quelques minutes.";
    case "email_address_invalid":
      return "Cette adresse email n'est pas acceptée.";
    case "signup_disabled":
      return "Les inscriptions sont fermées pour le moment.";
    default:
      return fallback;
  }
}

async function callbackUrl(next: string) {
  return `${await getSiteUrl()}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email"), next: formData.get("next") ?? undefined });
  if (!parsed.success) return { status: "error", message: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: await callbackUrl(parsed.data.next ?? "/ligues"), shouldCreateUser: true },
  });
  if (error) {
    return { status: "error", email: parsed.data.email, message: translateAuthError(error.code, "Impossible d'envoyer le lien. Vérifie l'adresse et réessaie.") };
  }
  return { status: "sent", email: parsed.data.email };
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(String(formData.get("next") ?? "/ligues")) },
  });
  if (error || !data.url) redirect("/connexion?erreur=google");
  redirect(data.url);
}
