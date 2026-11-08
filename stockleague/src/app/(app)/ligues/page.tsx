import { CalendarRange, KeyRound, Plus, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import type { LeagueStatus } from "@/lib/supabase/database.types";
import { formatDate, formatUSD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mes ligues" };

const STATUS: Record<LeagueStatus, { label: string; className: string }> = {
  draft: { label: "Pas commencée", className: "bg-secondary text-secondary-foreground" },
  active: { label: "En cours", className: "bg-highlight text-highlight-foreground" },
  finished: { label: "Terminée", className: "bg-primary text-primary-foreground" },
};

export default function LeaguesPage() {
  return (
    <>
      <PageHeader title="Mes ligues" description="Chaque ligue a son propre portefeuille et son propre classement." />
      <Suspense fallback={<LeaguesSkeleton />}>
        <LeagueList />
      </Suspense>
    </>
  );
}

async function LeagueList() {
  const user = await requireUser("/ligues");
  const supabase = await createClient();

  // RLS : cette requête ne renvoie que les ligues dont je suis membre.
  const [{ data: leagues, error }, { data: members }] = await Promise.all([
    supabase.from("leagues").select("id, name, status, start_date, end_date, starting_cash, season").order("start_date", { ascending: false }),
    supabase.from("league_members").select("league_id, user_id"),
  ]);
  if (error) throw new Error("Impossible de charger tes ligues pour le moment.");

  if (!leagues?.length) {
    return (
      <EmptyState
        icon={Trophy}
        title="Aucune ligue pour l'instant"
        actions={
          <>
            <Button disabled title="Disponible à la phase 2">
              <Plus /> Créer une ligue
            </Button>
            <Button variant="outline" disabled title="Disponible à la phase 2">
              <KeyRound /> Rejoindre avec un code
            </Button>
          </>
        }
      >
        Bienvenue {user.pseudo}. Crée ta ligue et invite tes amis, ou rejoins-en une avec le code à 6 caractères qu&apos;on t&apos;a envoyé.
      </EmptyState>
    );
  }

  const countByLeague = new Map<string, number>();
  members?.forEach((m) => countByLeague.set(m.league_id, (countByLeague.get(m.league_id) ?? 0) + 1));

  return (
    <ul className="space-y-3">
      {leagues.map((l) => (
        <li key={l.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl">{l.name}</h2>
              <p className="text-xs text-muted-foreground">Saison {l.season}</p>
            </div>
            <Badge className={STATUS[l.status].className}>{STATUS[l.status].label}</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarRange className="size-3" aria-hidden="true" /> Saison</dt>
              <dd className="nums">{formatDate(l.start_date)} – {formatDate(l.end_date)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3" aria-hidden="true" /> Joueurs</dt>
              <dd className="nums">{countByLeague.get(l.id) ?? 1}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Capital de départ</dt>
              <dd className="nums">{formatUSD(l.starting_cash)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function LeaguesSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Chargement des ligues">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}
