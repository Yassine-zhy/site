import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/** Pages qui exigent d'être connecté. */
const PROTECTED_PREFIXES = ["/ligues", "/profil"];

/**
 * Exécuté avant chaque requête : rafraîchit le jeton de session Supabase
 * (stocké en cookie) et renvoie vers /connexion si une page protégée est
 * demandée sans être connecté. La vraie vérification reste faite côté
 * serveur et par RLS : ceci n'est qu'un aiguillage rapide.
 */
export async function updateSession(request: NextRequest) {
  // Projet pas encore configuré : on laisse passer (la page d'accueil reste visible).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Ne rien intercaler entre la création du client et getClaims() (recommandation Supabase).
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!isLoggedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (isLoggedIn && pathname === "/connexion") {
    const url = request.nextUrl.clone();
    url.pathname = "/ligues";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
