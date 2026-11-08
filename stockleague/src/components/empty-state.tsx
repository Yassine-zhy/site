import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = { icon: LucideIcon; title: string; children?: ReactNode; actions?: ReactNode };

/** État vide : dit clairement quoi faire ensuite. */
export function EmptyState({ icon: Icon, title, children, actions }: Props) {
  return (
    <div className="rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="font-display text-2xl">{title}</h2>
      {children ? <div className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{children}</div> : null}
      {actions ? <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{actions}</div> : null}
    </div>
  );
}
