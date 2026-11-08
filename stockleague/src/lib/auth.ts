import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  pseudo: string;
  avatarUrl: string | null;
  createdAt: string;
};

/**
 * Utilisateur connecté + son profil, ou null.
 * `cache` évite de refaire la requête si plusieurs composants l'appellent
 * pendant le même rendu.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, avatar_url, created_at")
    .eq("id", claims.sub)
    .single();
  if (!profile) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    pseudo: profile.pseudo,
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
  };
});

/** Comme getCurrentUser, mais renvoie vers la connexion si personne n'est connecté. */
export async function requireUser(next = "/ligues"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  return user;
}
