import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
} as const;

/** KPI tile: a single number with its label and optional context line. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  className?: string | undefined;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-soft", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {Icon && <Icon className={cn("h-4 w-4 shrink-0", TONES[tone])} />}
      </div>
      <p className="mt-2 font-display text-2xl leading-tight font-extrabold tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
