import type { ReactNode } from "react";
import { Lock, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { inputClass } from "@/components/admin/ops-utils";
import { cn } from "@/lib/utils";

/**
 * Shared presentational pieces for the operations half of the admin console
 * (overview, orders, returns, products, categories, reviews, tickets).
 * Non-visual helpers live next door in `ops-utils.ts`.
 */

/** Calm, explanatory state shown instead of an error toast loop when the API returns 403. */
export function ForbiddenState({ section }: { section?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Your admin role doesn't include this section"
      description={
        section
          ? `Ask a super administrator to add "${section}" access to your staff account if you need it.`
          : "Ask a super administrator to update your staff permissions if you need access."
      }
    />
  );
}

/* ---------- filter controls ---------- */

/** One calm row of filters above a list. */
export function FilterRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("relative min-w-[200px] flex-1 sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={label ?? placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "w-full pl-9")}
      />
    </div>
  );
}

export interface ChipOption {
  value: string;
  label: string;
  count?: number | undefined;
}

/** Status chips with counts — the primary filter on every queue. */
export function FilterChips({
  options,
  value,
  onChange,
  className,
  ariaLabel = "Filter",
}: {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={cn("rail-scroll flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  active ? "bg-background/20" : "bg-muted text-muted-foreground",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Small labelled wrapper for a native select or date input in a filter row. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <span className="hidden sm:inline">{label}</span>
      {children}
    </label>
  );
}

/* ---------- loading states ---------- */

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="h-9 w-full rounded-xl" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

/* ---------- small presentational helpers ---------- */

/** Label / value line used inside detail panels. */
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function PanelHeading({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0">
        <h3 className="font-display text-sm font-bold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

/** Thumbnail that degrades gracefully when the seller's image URL is broken. */
export function Thumb({
  src,
  alt,
  className,
}: {
  src?: string | undefined;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block shrink-0 overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}
