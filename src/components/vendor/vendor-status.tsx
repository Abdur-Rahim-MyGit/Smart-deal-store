import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, LifeBuoy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import type { VendorStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Only approved sellers may list products, fulfil orders, reply to reviews or
 * withdraw money (the API enforces this with `requireActiveVendor`). Every action
 * that would be refused is disabled up front and says why.
 */
export interface VendorGate {
  status: VendorStatus;
  isActive: boolean;
  /** Null when the seller is approved; otherwise the reason actions are locked. */
  lockReason: string | null;
  rejectionReason: string | null;
}

const LOCK_REASONS: Record<Exclude<VendorStatus, "Active">, string> = {
  "Pending Review":
    "Your store is still under review — this unlocks as soon as Smart Deal approves your account.",
  Rejected:
    "Your seller application was rejected, so selling actions are locked. Smart Deal support can reopen your store.",
  Suspended:
    "Your store is suspended, so selling actions are locked. Contact Smart Deal support to restore it.",
};

export function useVendorGate(): VendorGate {
  const { user } = useStore();
  const status: VendorStatus = user?.vendorDetails?.status ?? "Pending Review";
  return {
    status,
    isActive: status === "Active",
    lockReason: status === "Active" ? null : LOCK_REASONS[status],
    rejectionReason: user?.vendorDetails?.rejectionReason ?? null,
  };
}

const TONE = {
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

/** Full-width banner shown at the top of the seller centre while the store isn't live. */
export function VendorStatusBanner({
  status,
  rejectionReason,
}: {
  status: VendorStatus;
  rejectionReason: string | null;
}) {
  if (status === "Active") return null;

  const pending = status === "Pending Review";
  const Icon = pending ? Clock : AlertTriangle;

  return (
    <section
      className={cn("rounded-2xl border p-4 sm:p-5", pending ? TONE.warning : TONE.danger)}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="font-display text-base font-bold">
            {pending
              ? "Your store is under review"
              : status === "Rejected"
                ? "Your seller application was rejected"
                : "Your store is suspended"}
          </h2>
          <p className="text-sm leading-relaxed">
            {pending
              ? "You can prepare products as drafts but they won't go live until approved. Listing, fulfilment, review replies and payouts unlock once an administrator approves your account."
              : status === "Rejected"
                ? "Selling is paused on this account. Our support team can walk you through what's needed to reopen the store."
                : "Selling is paused on this account. Our support team can tell you what's needed to lift the suspension."}
          </p>
          {rejectionReason && !pending && (
            <p className="rounded-xl bg-background/60 px-3 py-2 text-sm">
              <span className="font-semibold">Reason given: </span>
              {rejectionReason}
            </p>
          )}
        </div>
        {!pending && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="rounded-xl bg-background font-semibold"
          >
            <Link to="/contact">
              <LifeBuoy className="mr-1.5 h-4 w-4" /> Contact support
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}

/** Inline note explaining why the actions on a section are disabled. */
export function LockedNotice({ reason, className }: { reason: string; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200",
        className,
      )}
    >
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{reason}</span>
    </p>
  );
}
