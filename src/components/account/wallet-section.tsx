import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Receipt, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import type { MyOrdersResponse } from "@/components/account/types";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import type { User } from "@/lib/types";

export function WalletSection({ user }: { user: User }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-orders", "refunded"],
    queryFn: () =>
      api<MyOrdersResponse>("/orders/my", { query: { status: "cancelled", limit: 50 } }),
  });

  const refunded = (data?.orders ?? []).filter(
    (order) => order.paymentDetails.status === "Refunded",
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Smart Deal wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your refund balance, ready to spend on your next order.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lift sm:p-6">
        <div className="brand-gradient pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full opacity-35 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-wide uppercase">Available balance</span>
          </div>
          <p className="mt-2 font-display text-4xl font-extrabold tracking-tight tabular-nums">
            {formatPrice(user.walletBalance)}
          </p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            When you cancel a prepaid order or we approve a return, the money comes straight back
            here — no waiting for a bank transfer. Choose{" "}
            <span className="font-semibold text-foreground">Wallet</span> at checkout to spend it.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="h-10 rounded-xl font-semibold">
              <Link to="/cart">
                Spend at checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl font-semibold">
              <Link to="/">Continue shopping</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="block text-sm font-bold text-foreground">Instant refunds</span>
            Wallet credit appears the moment a cancellation or return is approved.
          </p>
        </div>
        <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="block text-sm font-bold text-foreground">Never expires</span>
            Your balance stays on your account until you use it. It can&apos;t be transferred or
            withdrawn.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Refunded orders</h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <InlineError message="We couldn't load your refunds." onRetry={() => void refetch()} />
        ) : refunded.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No refunds yet"
            description="Refunds from cancelled orders and approved returns will be listed here with the amount credited."
          />
        ) : (
          <ul className="space-y-2">
            {refunded.map((order) => (
              <li key={order._id}>
                <Link
                  to="/account/orders/$orderId"
                  params={{ orderId: order._id }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-soft"
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold">{order.orderId}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)} · paid by {order.paymentDetails.method}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.status} />
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Credited</p>
                      <p className="font-display text-sm font-bold text-success tabular-nums">
                        +{formatPrice(order.pricing.total)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
