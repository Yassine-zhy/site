/**
 * Variables d'environnement publiques (lisibles dans le navigateur).
 * Message clair si elles manquent, plutôt qu'une erreur obscure de Supabase.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}. Copie .env.example en .env.local et remplis-la (voir README).`);
  }
  return value;
}

// Accès explicites (Next.js remplace process.env.NEXT_PUBLIC_* au build, pas les accès dynamiques).
export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  },
};
