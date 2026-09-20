import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Filter pill with an optional count, used by the product, order and review lists. */
export function FilterChip({
  label,
  count,
  active,
  onClick,
  disabled,
}: {
  label: string;
  count?: number | undefined;
  active: boolean;
  onClick: () => void;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled ?? false}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums",
            active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Search field with a clear button. */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl pr-9 pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Square product image with a neutral placeholder while it loads (or when missing). */
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

/** "Size: 50 ml · Shade: Rosewood" from a variant's options. */
export function variantLabel(
  options?: Record<string, string> | undefined,
  fallback?: string | undefined,
): string {
  const parts = Object.entries(options ?? {}).map(([name, value]) => `${name}: ${value}`);
  if (parts.length) return parts.join(" · ");
  return fallback ?? "";
}

/** Label / value pair used in the order cards and payout summaries. */
export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-0.5 text-sm break-words">{children}</div>
    </div>
  );
}

export function StatGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-[104px] rounded-2xl" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 rounded-xl" />
      ))}
    </div>
  );
}

export function CardListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-44 rounded-2xl" />
      ))}
    </div>
  );
}

/** "12 of 48 products" style caption above a paginated list. */
export function ResultCount({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: string;
}) {
  if (!total) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Showing <span className="font-semibold text-foreground tabular-nums">{shown}</span> of{" "}
      <span className="font-semibold text-foreground tabular-nums">{total}</span> {noun}
    </p>
  );
}
