import { ORDER_STATUS_STYLES, PRODUCT_STATUS_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const POSITIVE = "bg-success/12 text-success";
const WARNING = "bg-amber-500/15 text-amber-700 dark:text-amber-300";
const NEGATIVE = "bg-destructive/12 text-destructive";
const NEUTRAL = "bg-slate-500/15 text-slate-700 dark:text-slate-300";
const INFO = "bg-sky-500/12 text-sky-700 dark:text-sky-300";

const GENERIC_STYLES: Record<string, string> = {
  Paid: POSITIVE,
  Pending: WARNING,
  Failed: NEGATIVE,
  Open: INFO,
  Assigned: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  "In Progress": "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
  Resolved: POSITIVE,
  Closed: NEUTRAL,
  Requested: WARNING,
  Transferred: POSITIVE,
  Declined: NEGATIVE,
  "Pending Review": WARNING,
  Approved: POSITIVE,
  Blocked: NEGATIVE,
  Deleted: NEGATIVE,
  Inactive: NEUTRAL,
  New: INFO,
  Read: NEUTRAL,
  Replied: POSITIVE,
  Archived: NEUTRAL,
  Scheduled: INFO,
  Sending: INFO,
  Sent: POSITIVE,
  Expired: NEUTRAL,
  Disabled: NEUTRAL,
  Exhausted: NEUTRAL,
  High: NEGATIVE,
  Medium: WARNING,
  Low: NEUTRAL,
};

/** Coloured pill for any order, product, payment, ticket or account status. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style =
    (ORDER_STATUS_STYLES as Record<string, string>)[status] ??
    (PRODUCT_STATUS_STYLES as Record<string, string>)[status] ??
    GENERIC_STYLES[status] ??
    "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        style,
        className,
      )}
    >
      {status}
    </span>
  );
}
