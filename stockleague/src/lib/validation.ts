import { z } from "zod";

/** Schémas de validation partagés (utilisés côté serveur dans les server actions). */
export const emailSchema = z.object({
  email: z.email({ error: "Adresse email invalide." }).trim().toLowerCase(),
  next: z.string().optional(),
});

export const profileSchema = z.object({
  pseudo: z
    .string()
    .trim()
    .min(2, { error: "Le pseudo doit faire au moins 2 caractères." })
    .max(24, { error: "Le pseudo doit faire 24 caractères maximum." })
    .regex(/^[\p{L}\p{N} ._'-]+$/u, { error: "Lettres, chiffres, espaces et . _ ' - uniquement." }),
});

/** Premier message d'erreur lisible d'une validation Zod. */
export const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Données invalides.";
