import { Link } from "@tanstack/react-router";
import { ChevronRight, Package } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice } from "@/lib/format";
import type { OrderSummary } from "@/components/account/types";
import { cn } from "@/lib/utils";

function Thumb({ src, alt }: { src: string | undefined; alt: string }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Package className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

/** Compact order summary used on the overview and orders tabs. */
export function OrderCard({ order, className }: { order: OrderSummary; className?: string }) {
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);
  const shown = order.items.slice(0, 4);
  const extra = order.items.length - shown.length;
  const first = order.items[0];

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-soft",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-bold">{order.orderId}</h3>
          <p className="text-xs text-muted-foreground">
            Placed {formatDate(order.createdAt)} · {units} item{units === 1 ? "" : "s"}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <div className="flex -space-x-2">
          {shown.map((item) => (
            <Thumb key={item._id} src={item.thumbnail} alt={item.title} />
          ))}
          {extra > 0 && (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border bg-muted text-xs font-bold text-muted-foreground">
              +{extra}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{first?.title ?? "Order items"}</p>
          {order.items.length > 1 && (
            <p className="text-[11px] text-muted-foreground">
              and {order.items.length - 1} other product{order.items.length - 1 === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
        <div>
          <p className="text-[11px] text-muted-foreground">Order total</p>
          <p className="font-display text-base font-bold">{formatPrice(order.pricing.total)}</p>
        </div>
        <Button asChild size="sm" variant="outline" className="h-9 rounded-xl font-semibold">
          <Link to="/account/orders/$orderId" params={{ orderId: order._id }}>
            View details
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-4">
      <div className="flex justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="h-3 w-40 rounded bg-muted" />
        </div>
        <div className="h-5 w-20 rounded-full bg-muted" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-12 w-12 rounded-xl bg-muted" />
        <div className="h-12 w-12 rounded-xl bg-muted" />
        <div className="h-12 flex-1 rounded-xl bg-muted" />
      </div>
      <div className="mt-4 h-9 rounded-xl bg-muted" />
    </div>
  );
}
