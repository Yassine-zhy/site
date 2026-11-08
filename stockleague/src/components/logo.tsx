import { APP_NAME } from "@/lib/config/app";
import { cn } from "@/lib/utils";

/**
 * Emblème : un podium dont les marches sont aussi des barres de graphique.
 * La marche du vainqueur porte l'unique accent jaune de l'identité.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-board" />
      <rect x="6.5" y="14" width="5.5" height="11" rx="1" className="fill-board-foreground" opacity="0.85" />
      <rect x="13.25" y="7" width="5.5" height="18" rx="1" fill="#F2B705" />
      <rect x="20" y="18" width="5.5" height="7" rx="1" className="fill-board-foreground" opacity="0.6" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-2xl leading-none">{APP_NAME}</span>
    </span>
  );
}
