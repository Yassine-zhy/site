"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;
const LABELS = { light: "Thème clair", dark: "Thème sombre", system: "Thème du système" } as const;

/** Bouton qui alterne clair → sombre → système. */
export function ThemeToggle() {
  const { theme = "system", setTheme } = useTheme();
  // Le thème n'est connu qu'une fois dans le navigateur : on évite un décalage d'hydratation.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const current = (mounted ? theme : "system") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label={`${LABELS[current]} (changer)`} title={LABELS[current]}>
      <Icon />
    </Button>
  );
}
