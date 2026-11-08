import { Minus, Triangle } from "lucide-react";
import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { Logo } from "@/components/logo";
import { PlayerAvatar } from "@/components/player-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Trend } from "@/components/trend";
import { Button } from "@/components/ui/button";
import { APP_DESCRIPTION, APP_TAGLINE } from "@/lib/config/app";
import { formatPoints } from "@/lib/format";
import { cn } from "@/lib/utils";

// Classement d'exemple (page d'accueil provisoire : la vraie landing arrive en phase 8).
const SAMPLE = [
  { pseudo: "Yanis", title: "Le Warren Buffett de la bande", perf: 9.4, pts: 134, move: 1 },
  { pseudo: "Léa", title: "L'Oracle", perf: 6.1, pts: 121, move: -1 },
  { pseudo: "Mehdi", title: "Le kamikaze", perf: 11.8, pts: 108, move: 2 },
  { pseudo: "Camille", title: "Diamond hands", perf: 3.2, pts: 72, move: 0 },
  { pseudo: "Inès", title: "La lanterne rouge", perf: -4.7, pts: -17, move: -2 },
];

const STEPS = [
  { title: "Crée ta ligue", text: "Choisis le capital, les dates de la saison, et envoie le lien à tes amis." },
  { title: "Investis et pronostique", text: "Achète de vraies actions au cours du marché. Avant chaque publication de résultats, parie sur « bat » ou « manque » les attentes." },
  { title: "Un seul gagnant", text: "Classement en direct, titres du jour, et un récap à partager en fin de saison." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/connexion">Se connecter</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full grid-cols-1 max-w-6xl flex-1 gap-12 px-4 pb-16 pt-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-16">
        <section className="min-w-0">
          <h1 className="font-display text-[clamp(3.25rem,11vw,6.5rem)] text-balance">{APP_TAGLINE}</h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">{APP_DESCRIPTION}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/connexion">Créer ma ligue</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link href="/connexion">Rejoindre avec un code</Link>
            </Button>
          </div>
          <Disclaimer className="mt-6 max-w-md" />
        </section>

        <section aria-label="Exemple de classement de ligue" className="min-w-0">
          <Scoreboard />
        </section>
      </main>

      <section className="border-t bg-card">
        <ol className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="font-display nums text-5xl text-muted-foreground/50" aria-hidden="true">{i + 1}</span>
              <div>
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** Tableau de marque : l'élément signature de l'identité visuelle. */
function Scoreboard() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_0_0_var(--border),0_24px_48px_-24px_rgb(11_26_48/0.25)]">
      <div className="flex items-center justify-between bg-board px-5 py-3 text-board-foreground">
        <div>
          <p className="font-display text-2xl">Ligue des Loups</p>
          <p className="text-xs opacity-70">Saison 1, classement général</p>
        </div>
        <span className="rounded-md bg-highlight px-2 py-1 font-display text-lg text-highlight-foreground nums">J-23</span>
      </div>
      <ol>
        {SAMPLE.map((p, i) => (
          <li key={p.pseudo} className={cn("relative flex items-center gap-3 border-b px-4 py-3 last:border-b-0", i === 0 && "bg-highlight/10 dark:bg-highlight/[0.07]")}>
            {i === 0 ? <span className="absolute inset-y-0 left-0 w-1 bg-highlight" aria-hidden="true" /> : null}
            <span className="font-display nums w-7 text-center text-3xl">{i + 1}</span>
            <PlayerAvatar pseudo={p.pseudo} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.pseudo}</p>
              <p className="truncate text-xs text-muted-foreground">{p.title}</p>
            </div>
            <div className="text-right">
              <p className="font-display nums text-xl">{formatPoints(p.pts)}</p>
              <Trend value={p.perf} className="text-xs" />
            </div>
            <Move value={p.move} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Move({ value }: { value: number }) {
  const label = value === 0 ? "Position stable" : `${Math.abs(value)} place${Math.abs(value) > 1 ? "s" : ""} ${value > 0 ? "gagnée" : "perdue"}${Math.abs(value) > 1 ? "s" : ""} depuis hier`;
  return (
    <span className="flex w-6 flex-col items-center text-[10px] font-semibold nums" aria-label={label} title={label}>
      {value === 0 ? (
        <Minus className="size-3 text-muted-foreground" aria-hidden="true" />
      ) : (
        <>
          <Triangle className={cn("size-2.5 fill-current", value > 0 ? "text-gain" : "rotate-180 text-loss")} aria-hidden="true" />
          <span className={value > 0 ? "text-gain" : "text-loss"}>{Math.abs(value)}</span>
        </>
      )}
    </span>
  );
}
