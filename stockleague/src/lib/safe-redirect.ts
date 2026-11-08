/**
 * N'accepte que des chemins internes ("/ligues"), jamais "//evil.com" ni "https://…" :
 * empêche un lien piégé de rediriger vers un autre site après connexion.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/ligues"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
