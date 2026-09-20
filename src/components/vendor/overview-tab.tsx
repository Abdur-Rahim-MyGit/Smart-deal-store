import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Boxes,
  ClipboardList,
  Coins,
  PackageCheck,
  ShoppingBag,
  Star,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  ChartCard,
  DailyTable,
  OrdersBarChart,
  RankedBarList,
  RankedTable,
  RevenueAreaChart,
} from "@/components/dashboard/charts";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { CardListSkeleton, StatGridSkeleton, Thumb } from "@/components/vendor/common";
import { VendorStatusBanner, useVendorGate } from "@/components/vendor/vendor-status";
import type { VendorDashboardResponse, VendorTabProps } from "@/components/vendor/types";

/** Seller home: store status, KPIs, 30-day trends, low stock and the latest orders. */
export function OverviewTab({ onNavigate }: VendorTabProps) {
  const gate = useVendorGate();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["vendor-dashboard"],
    queryFn: () => api<VendorDashboardResponse>("/vendors/dashboard"),
    staleTime: 60_000,
  });

  const banner = (
    <VendorStatusBanner
      status={data?.vendorStatus ?? gate.status}
      rejectionReason={gate.rejectionReason}
    />
  );

  if (isPending) {
    return (
      <div className="space-y-5">
        {banner}
        <StatGridSkeleton />
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton className="h-[360px] rounded-2xl" />
          <Skeleton className="h-[360px] rounded-2xl" />
        </div>
        <CardListSkeleton rows={2} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-5">
        {banner}
        <InlineError
          message={errorMessage(error, "We couldn't load your dashboard.")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const { stats, salesByDay, topProducts, lowStock, recentOrders } = data;
  const revenue30 = salesByDay.reduce((sum, point) => sum + point.revenue, 0);
  const orders30 = salesByDay.reduce((sum, point) => sum + point.orders, 0);
  const rankedProducts = topProducts.map((product) => ({
    label: product.title,
    value: product.revenue,
  }));

  return (
    <div className="space-y-5">
      {banner}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Gross sales"
          value={formatPrice(stats.grossSales)}
          hint="Item value before commission"
          icon={TrendingUp}
        />
        <StatCard
          label="Commission"
          value={formatPrice(stats.commission)}
          hint="Charged by Smart Deal"
          icon={Coins}
          tone="warning"
        />
        <StatCard
          label="Net earnings"
          value={formatPrice(stats.netEarnings)}
          hint="Yours after commission"
          icon={Banknote}
          tone="success"
        />
        <StatCard
          label="Units sold"
          value={stats.unitsSold.toLocaleString("en-AE")}
          hint={`${stats.productCount} listings`}
          icon={Boxes}
        />
        <StatCard
          label="Orders"
          value={stats.orderCount.toLocaleString("en-AE")}
          hint="Excluding cancellations"
          icon={ShoppingBag}
        />
        <StatCard
          label="Pending fulfilment"
          value={stats.pendingFulfilment.toLocaleString("en-AE")}
          tone={stats.pendingFulfilment > 0 ? "warning" : "default"}
          icon={Timer}
          hint={
            <button
              type="button"
              onClick={() => onNavigate("orders")}
              className="font-semibold text-foreground underline underline-offset-2"
            >
              {stats.pendingFulfilment > 0 ? "Fulfil these orders" : "Open orders"}
            </button>
          }
        />
        <StatCard
          label="Available balance"
          value={formatPrice(stats.availableBalance)}
          icon={Wallet}
          hint={
            <button
              type="button"
              onClick={() => onNavigate("payouts")}
              className="font-semibold text-foreground underline underline-offset-2"
            >
              Request a payout
            </button>
          }
        />
        <StatCard
          label="Store rating"
          value={stats.rating ? stats.rating.toFixed(1) : "—"}
          icon={Star}
          hint={
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span>
                {stats.reviewCount} {stats.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </span>
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Revenue"
          description="Last 30 days, by order date"
          total={formatPrice(revenue30)}
          table={<DailyTable data={salesByDay} valueKey="revenue" valueLabel="Revenue" />}
        >
          <RevenueAreaChart data={salesByDay} />
        </ChartCard>
        <ChartCard
          title="Orders per day"
          description="Last 30 days"
          total={orders30.toLocaleString("en-AE")}
          table={<DailyTable data={salesByDay} valueKey="orders" valueLabel="Orders" />}
        >
          <OrdersBarChart data={salesByDay} />
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Top products"
          description="By revenue, all time"
          table={<RankedTable rows={rankedProducts} label="Product" />}
        >
          <RankedBarList
            rows={rankedProducts}
            emptyMessage="No sales yet — your best sellers will appear here."
          />
        </ChartCard>

        <SectionCard
          title="Low stock"
          description="At or below the low-stock alert you set per SKU."
          actions={
            lowStock.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl font-semibold"
                onClick={() => onNavigate("products", { lowStock: true })}
              >
                Manage stock
              </Button>
            ) : undefined
          }
        >
          {lowStock.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Every SKU is above its low-stock alert. Nice work.
            </p>
          ) : (
            <TableScroll>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-semibold">Product</th>
                  <th className="pb-2 font-semibold">SKU</th>
                  <th className="pb-2 text-right font-semibold">Units left</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lowStock.map((row) => (
                  <tr key={`${row._id}-${row.sku}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Thumb src={row.thumbnail} alt="" className="h-9 w-9" />
                        <span className="min-w-0 font-medium">{row.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                      {row.sku}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 tabular-nums dark:text-amber-300">
                        {row.stock}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg font-semibold"
                        onClick={() => onNavigate("products", { lowStock: true })}
                      >
                        Restock
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent orders"
        description="The six latest orders containing your items."
        actions={
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl font-semibold"
            onClick={() => onNavigate("orders")}
          >
            All orders
          </Button>
        }
      >
        {recentOrders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No orders yet"
            description="Once a shopper buys one of your products, the order lands here and in the Orders tab."
            action={
              <Button
                variant="outline"
                className="rounded-xl font-semibold"
                onClick={() => onNavigate("products")}
              >
                <PackageCheck className="mr-1.5 h-4 w-4" /> Review your listings
              </Button>
            }
          />
        ) : (
          <TableScroll>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-semibold">Order</th>
                <th className="pb-2 font-semibold">Placed</th>
                <th className="pb-2 font-semibold">Customer</th>
                <th className="pb-2 text-right font-semibold">Items</th>
                <th className="pb-2 text-right font-semibold">Your total</th>
                <th className="pb-2 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map((order) => (
                <tr key={order._id}>
                  <td className="py-2.5 pr-3 font-mono text-xs font-semibold">{order.orderId}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium">{order.customer ?? "—"}</span>
                    {order.emirate && (
                      <span className="block text-xs text-muted-foreground">{order.emirate}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{order.itemCount}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                    {formatPrice(order.total)}
                  </td>
                  <td className="py-2.5 text-right">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </SectionCard>
    </div>
  );
}
