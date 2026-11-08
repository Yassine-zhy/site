"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { firstError, profileSchema } from "@/lib/validation";

export type ProfileState = { status: "idle" | "saved" | "error"; message?: string };

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({ pseudo: formData.get("pseudo") });
  if (!parsed.success) return { status: "error", message: firstError(parsed.error) };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { status: "error", message: "Ta session a expiré. Reconnecte-toi." };

  // RLS + droits par colonne : seul le pseudo / l'avatar de son propre profil est modifiable.
  const { error } = await supabase.from("profiles").update({ pseudo: parsed.data.pseudo }).eq("id", userId);
  if (error) return { status: "error", message: "Le pseudo n'a pas pu être enregistré. Réessaie." };

  refresh();
  return { status: "saved", message: "Pseudo enregistré." };
}
