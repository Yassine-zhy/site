import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profil" />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
        <ProfileContent />
      </Suspense>
    </>
  );
}

async function ProfileContent() {
  const user = await requireUser("/profil");
  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4 rounded-xl border bg-card p-5">
        <PlayerAvatar pseudo={user.pseudo} seed={user.id} avatarUrl={user.avatarUrl} className="size-16 text-lg" />
        <div className="min-w-0">
          <p className="truncate font-display text-3xl">{user.pseudo}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground nums">Inscrit le {formatDate(user.createdAt)}</p>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <ProfileForm pseudo={user.pseudo} />
      </section>

      <form action="/auth/deconnexion" method="post">
        <Button type="submit" variant="outline" className="h-11 w-full sm:w-auto">
          <LogOut /> Se déconnecter
        </Button>
      </form>
    </div>
  );
}
