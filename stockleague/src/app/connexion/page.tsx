import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Disclaimer } from "@/components/disclaimer";
import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  lien: "Ce lien de connexion est invalide ou a expiré. Demande-en un nouveau.",
  google: "La connexion avec Google n'a pas abouti. Réessaie, ou utilise ton email.",
};

export default function LoginPage({ searchParams }: PageProps<"/connexion">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-10 self-start" aria-label="Retour à l'accueil">
        <Logo />
      </Link>
      <h1 className="font-display text-5xl">Connexion</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Pas de mot de passe : on t&apos;envoie un lien par email. Première visite ? Ton compte est créé automatiquement.
      </p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
      <Disclaimer className="mt-10" />
    </main>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/connexion">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const error = typeof params.erreur === "string" ? ERRORS[params.erreur] : undefined;
  return (
    <>
      {error ? (
        <p role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-loss-soft p-3 text-sm">{error}</p>
      ) : null}
      <LoginForm next={next} />
    </>
  );
}
