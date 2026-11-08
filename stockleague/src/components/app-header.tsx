import Link from "next/link";
import { Suspense } from "react";
import { DesktopNav } from "@/components/bottom-nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/ligues" aria-label="Accueil de l'application">
          <Logo />
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
