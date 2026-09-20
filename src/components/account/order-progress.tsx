import {
  CheckCircle2,
  MapPin,
  Package,
  PackageCheck,
  ReceiptText,
  Truck,
  Undo2,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { FULFILMENT_STEPS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<string, LucideIcon> = {
  Placed: ReceiptText,
  Confirmed: CheckCircle2,
  Processing: Package,
  Shipped: Truck,
  "Out for Delivery": MapPin,
  Delivered: PackageCheck,
};

const TERMINAL: Partial<
  Record<
    OrderStatus,
    { icon: LucideIcon; title: string; body: string; className: string; iconClassName: string }
  >
> = {
  Cancelled: {
    icon: XCircle,
    title: "Order cancelled",
    body: "This order was cancelled and will not be delivered. Any prepaid amount has been returned to your wallet.",
    className: "border-destructive/30 bg-destructive/5",
    iconClassName: "bg-destructive/12 text-destructive",
  },
  "Return Requested": {
    icon: Undo2,
    title: "Return requested",
    body: "We've received your return request and our team is reviewing it — usually within 24 hours.",
    className: "border-amber-500/30 bg-amber-500/8",
    iconClassName: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  Returned: {
    icon: PackageCheck,
    title: "Return completed",
    body: "The items are back with the seller. Your refund is being processed to your Smart Deal wallet.",
    className: "border-border bg-muted/40",
    iconClassName: "bg-muted text-muted-foreground",
  },
  Refunded: {
    icon: Wallet,
    title: "Refunded to your wallet",
    body: "The full amount has been credited to your Smart Deal wallet and can be spent at checkout.",
    className: "border-success/30 bg-success/8",
    iconClassName: "bg-success/12 text-success",
  },
};

/** Fulfilment tracker, or the terminal state for cancelled / returned orders. */
export function OrderProgress({ order }: { order: Order }) {
  const reachedAt = new Map<string, string>();
  for (const entry of order.statusTimeline) {
    if (!reachedAt.has(entry.status)) reachedAt.set(entry.status, entry.updatedAt);
  }

  const terminal = TERMINAL[order.status];
  if (terminal) {
    const { icon: Icon } = terminal;
    const at = reachedAt.get(order.status);
    return (
      <section className={cn("rounded-2xl border p-5 shadow-soft", terminal.className)}>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              terminal.iconClassName,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold">{terminal.title}</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              {terminal.body}
            </p>
            {at && (
              <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                {formatDateTime(at)}
              </p>
            )}
            {order.cancellationReason && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Reason:{" "}
                <span className="font-semibold text-foreground">{order.cancellationReason}</span>
              </p>
            )}
            {order.returnDetails?.reason && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Reason:{" "}
                <span className="font-semibold text-foreground">{order.returnDetails.reason}</span>
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  const currentIndex = FULFILMENT_STEPS.indexOf(order.status);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="font-display text-base font-bold">Delivery progress</h2>

      {/* Horizontal tracker from md up */}
      <ol className="mt-5 hidden md:flex">
        {FULFILMENT_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step] ?? Package;
          const done = index <= currentIndex;
          const at = reachedAt.get(step);
          return (
            <li key={step} className="relative flex-1 text-center">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-4 right-1/2 left-0 h-0.5 -translate-y-1/2",
                    index <= currentIndex ? "bg-success" : "bg-border",
                  )}
                />
              )}
              {index < FULFILMENT_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-4 right-0 left-1/2 h-0.5 -translate-y-1/2",
                    index < currentIndex ? "bg-success" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative mx-auto grid h-8 w-8 place-items-center rounded-full border-2 transition-colors",
                  done
                    ? "border-success bg-success text-success-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p
                className={cn(
                  "mt-2 px-1 text-[11px] font-semibold",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step}
              </p>
              <p className="px-1 text-[10px] text-muted-foreground">
                {at ? formatDateTime(at) : "—"}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Vertical tracker on small screens */}
      <ol className="mt-4 space-y-0 md:hidden">
        {FULFILMENT_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step] ?? Package;
          const done = index <= currentIndex;
          const at = reachedAt.get(step);
          const last = index === FULFILMENT_STEPS.length - 1;
          return (
            <li key={step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2",
                    done
                      ? "border-success bg-success text-success-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {!last && (
                  <span
                    className={cn(
                      "w-0.5 flex-1",
                      index < currentIndex ? "bg-success" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className={cn("pb-5", last && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {at ? formatDateTime(at) : "Pending"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
