/**
 * Building blocks shared by the people, marketing, finance and system tabs of
 * the admin console. Everything here is presentation-only so each tab stays
 * focused on its own data and mutations.
 */
import { useCallback, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, Lock, Search, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { TableScroll } from "@/components/dashboard/dashboard-shell";
import { ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Native select styled like the shadcn input, used for compact dashboard filters. */
export const SELECT_CLASS =
  "h-9 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/* ---------------------------------------------------------------- errors -- */

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** Retry transient failures only — never a permission or "not found" answer. */
export function adminRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
  return failureCount < 2;
}

/** Calm 403 state: the admin simply doesn't hold this permission. */
export function PermissionDenied({ hint }: { hint?: string | undefined }) {
  return (
    <EmptyState
      icon={Lock}
      title="Your admin role doesn't include this section"
      description={
        hint ??
        "Ask a super admin to add the matching permission to your staff account if you need access."
      }
    />
  );
}

/** Loading / error / forbidden wrapper used at the top of every tab. */
export function TabState({
  isLoading,
  error,
  onRetry,
  skeleton,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  skeleton?: ReactNode | undefined;
  children: ReactNode;
}) {
  if (error) {
    if (isForbidden(error)) return <PermissionDenied />;
    return <InlineError message={errorMessage(error)} onRetry={onRetry} />;
  }
  if (isLoading) return <>{skeleton ?? <TableSkeleton />}</>;
  return <>{children}</>;
}

/* ------------------------------------------------------------ skeletons -- */

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="h-8 w-full rounded-xl" />
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className={cn("h-11 flex-1 rounded-xl", column === 0 && "flex-[2]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-56 rounded-2xl" />
      ))}
    </div>
  );
}

/* --------------------------------------------------------- search params -- */

/**
 * The console keeps the active status filter in the URL (`?status=`) and resets
 * it whenever the section changes.
 */
export function useStatusParam(): [string | undefined, (value: string | undefined) => void] {
  const { status } = useSearch({ from: "/admin-dashboard" });
  const navigate = useNavigate({ from: "/admin-dashboard" });
  const setStatus = useCallback(
    (value: string | undefined) => {
      void navigate({ search: (previous) => ({ ...previous, status: value }) });
    },
    [navigate],
  );
  return [status, setStatus];
}

/* ------------------------------------------------------------- controls -- */

export interface ChipOption {
  value: string;
  label: string;
  count?: number | undefined;
  hint?: string | undefined;
}

/** Segmented status filter shown above a list. */
export function FilterChips({
  options,
  value,
  onChange,
  className,
}: {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("rail-scroll flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label="Filter by status"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            title={option.hint}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums",
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

export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-xl pr-8 pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Label + hint wrapper for form controls. */
export function Field({
  label,
  hint,
  htmlFor,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string | undefined;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-bold">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Label / value pair used inside detail dialogs. */
export function DetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-semibold break-words">{value ?? "—"}</dd>
    </div>
  );
}

/** Short explanatory strip for consequences and where a setting shows up. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-xl bg-muted/60 px-3 py-2 text-[11px] leading-snug text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ----------------------------------------------------------- data table -- */

export interface DataColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string | undefined;
}

/** Dense table on desktop, stacked cards on phones. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  card,
}: {
  rows: T[];
  columns: Array<DataColumn<T>>;
  rowKey: (row: T) => string;
  onRowClick?: ((row: T) => void) | undefined;
  card?: ((row: T) => ReactNode) | undefined;
}) {
  return (
    <>
      {card && (
        <div className="space-y-2 md:hidden">
          {rows.map((row) => (
            <div
              key={rowKey(row)}
              {...(onRowClick
                ? {
                    role: "button",
                    tabIndex: 0,
                    onClick: () => onRowClick(row),
                    onKeyDown: (event: React.KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    },
                  }
                : {})}
              className={cn(
                "rounded-2xl border border-border bg-card p-3.5 shadow-soft",
                onRowClick && "cursor-pointer transition-colors hover:border-foreground/25",
              )}
            >
              {card(row)}
            </div>
          ))}
        </div>
      )}
      <TableScroll className={card ? "hidden md:block" : ""}>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-2 text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase whitespace-nowrap",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              {...(onRowClick
                ? {
                    onClick: () => onRowClick(row),
                    tabIndex: 0,
                    onKeyDown: (event: React.KeyboardEvent) => {
                      if (event.key === "Enter") onRowClick(row);
                    },
                  }
                : {})}
              className={cn(
                "border-b border-border/60 last:border-0",
                onRowClick && "cursor-pointer transition-colors hover:bg-accent/60",
              )}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn("px-3 py-2.5 align-middle", column.className)}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </TableScroll>
    </>
  );
}

/* --------------------------------------------------------------- dialogs -- */

/** AlertDialog for destructive or far-reaching actions; `children` adds a reason field. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  pending = false,
  disabled = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children && <div className="space-y-3">{children}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} className="rounded-xl">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || disabled}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className={cn(
              "rounded-xl",
              destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Dialog wrapping a form: scrollable body, cancel + submit footer. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Save",
  pending = false,
  onSubmit,
  size = "md",
  children,
  footerExtra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  submitLabel?: string;
  pending?: boolean;
  onSubmit: () => void;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
  footerExtra?: ReactNode;
}) {
  const widths = { md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" } as const;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-h-[92vh] gap-0 overflow-hidden rounded-2xl p-0", widths[size])}
      >
        <form onSubmit={handleSubmit} className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle className="font-display pr-6">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-xs">{description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
          <DialogFooter className="items-center gap-2 border-t border-border px-5 py-3 sm:justify-between">
            <div className="text-[11px] text-muted-foreground">{footerExtra}</div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="rounded-xl" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" className="rounded-xl" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- helpers -- */

/** ISO string → value for `<input type="datetime-local">` (local clock). */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** `<input type="datetime-local">` value → ISO string (or null when cleared). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Bank account numbers are only ever shown as the last four digits. */
export function maskAccount(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  if (raw.length <= 4) return `•••• ${raw}`;
  return `•••• ${raw.slice(-4)}`;
}

/** Parses a numeric form field, returning undefined for blanks. */
export function numberField(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}
