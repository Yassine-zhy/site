import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { Disclaimer } from "@/components/disclaimer";

/** Gabarit des pages connectées : en-tête, contenu, barre d'onglets mobile. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-8">{children}</main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-28 md:pb-8">
        <Disclaimer />
      </footer>
      <BottomNav />
    </div>
  );
}
