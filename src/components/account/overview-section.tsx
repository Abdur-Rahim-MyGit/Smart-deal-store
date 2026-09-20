import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Heart,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { OrderCard, OrderCardSkeleton } from "@/components/account/order-card";
import type { MyOrdersResponse } from "@/components/account/types";
import { VerifyEmailBanner } from "@/components/account/verify-email-banner";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { User } from "@/lib/types";

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 font-display text-xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function OverviewSection({
  user,
  onTabChange,
}: {
  user: User;
  onTabChange: (tab: string) => void;
}) {
  const { wishlist } = useStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-orders", "recent"],
    queryFn: () => api<MyOrdersResponse>("/orders/my", { query: { limit: 4 } }),
  });

  const orders = data?.orders ?? [];
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Hello, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s everything happening on your Smart Deal account.
        </p>
      </div>

      {!user.isVerified && (
        <VerifyEmailBanner
          email={user.email}
          reason="Verify it to place orders and receive delivery alerts."
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Package}
          label="Total orders"
          value={isLoading ? "—" : String(data?.total ?? 0)}
        />
        <StatTile
          icon={Wallet}
          label="Wallet balance"
          value={formatPrice(user.walletBalance)}
          hint="Spend at checkout"
        />
        <StatTile icon={Heart} label="Wishlist items" value={String(wishlist.length)} />
        <StatTile icon={MapPin} label="Saved addresses" value={String(user.addresses.length)} />
      </div>

      {(user.role === "Vendor" || user.role === "Admin") && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            {user.role === "Vendor" ? (
              <Store className="h-5 w-5" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-[180px] flex-1">
            <p className="text-sm font-bold">
              {user.role === "Vendor" ? "You sell on Smart Deal" : "You have admin access"}
            </p>
            <p className="text-xs text-muted-foreground">
              {user.role === "Vendor"
                ? "Manage products, fulfil orders and request payouts."
                : "Moderate the catalogue, orders, sellers and settings."}
            </p>
          </div>
          <Button asChild className="h-10 rounded-xl font-semibold">
            <Link to={user.role === "Vendor" ? "/vendor-dashboard" : "/admin-dashboard"}>
              Open dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Recent orders</h2>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={() => onTabChange("orders")}
              className="text-sm font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              View all
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </div>
        ) : isError ? (
          <InlineError
            message="We couldn't load your recent orders."
            onRetry={() => void refetch()}
          />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="When you place your first order it will appear here with live tracking."
            action={
              <Button asChild className="rounded-xl font-semibold">
                <Link to="/">Start shopping</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
