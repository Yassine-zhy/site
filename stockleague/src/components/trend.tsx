import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatSignedPercent, formatSignedUSD, trendOf } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = { value: number | string; format?: "percent" | "usd"; className?: string; showIcon?: boolean };

/** Gain / perte : couleur ET signe ET icône, pour rester lisible sans distinguer le vert du rouge. */
export function Trend({ value, format = "percent", className, showIcon = true }: Props) {
  const t = trendOf(value);
  const Icon = t === "up" ? ArrowUpRight : t === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "nums inline-flex items-center gap-0.5 font-semibold",
        t === "up" && "text-gain",
        t === "down" && "text-loss",
        t === "flat" && "text-muted-foreground",
        className,
      )}
    >
      {showIcon ? <Icon className="size-[1em]" aria-hidden="true" /> : null}
      {format === "percent" ? formatSignedPercent(value) : formatSignedUSD(value)}
    </span>
  );
}
