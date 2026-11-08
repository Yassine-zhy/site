import { DISCLAIMER } from "@/lib/config/app";
import { cn } from "@/lib/utils";

export function Disclaimer({ className }: { className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>{DISCLAIMER}</p>;
}
