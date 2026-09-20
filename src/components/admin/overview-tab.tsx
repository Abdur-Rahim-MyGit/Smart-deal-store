import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Box,
  ChevronRight,
  ClipboardList,
  CreditCard,
  LifeBuoy,
  Mail,
  PackageCheck,
  Percent,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Star,
  Store,
  Activity,
  Repeat,
  Truck,
  Undo2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import type { DailyPoint, RankedRow } from "@/components/dashboard/charts";
import { StatusBadge } from "@/components/common/status-badge";
import { InlineError } from "@/components/common/page-loader";
import { EmptyState } from "@/components/common/empty-state";
import { useStore } from "@/context/store";
import { api } from "@/lib/api";
import { compactCount, formatDate, formatPrice } from "@/lib/format";
import type { AdminPermission, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/types";
import type { AdminDashboardStats } from "@/routes/admin-dashboard";
import { ForbiddenState, GridSkeleton, Thumb } from "@/components/admin/ops-common";
import { canView, isForbidden, opsRetry, useAdminNavigate } from "@/components/admin/ops-utils";
import { cn } from "@/lib/utils";

interface OverviewOrder {
  _id: string;
  orderId: string;
  status: OrderStatus;
  pricing: { total: number };
  paymentDetails: { method: PaymentMethod; status: PaymentStatus };
  shippingAddress: { receiverName: string; emirate: string };
  createdAt: string;
}

interface LowStockRow {
  _id: string;
  title: string;
  slug: string;
  thumbnail?: string | undefined;
  sku: string;
  stock: number;
}

interface SellerRow {
  _id: string;
  name: string;
  sales: number;
  orders: number;
  rating: number | null;
  reviewCount: number;
  cancellationRate: number | null;
  returnRate: number | null;
  avgShipHours: number | null;
}

interface CustomerInsights {
  activeUsers: { day: number; week: number; month: number };
  signupsByDay: Array<{ date: string; count: number }>;
  acquisition: Array<{ source: string; count: number }>;
  payingCustomers?: number | undefined;
  lifetimeValue?: number | undefined;
  repeatRate?: number | undefined;
}

interface DashboardResponse {
  /** True for staff who only see operational counts (no money figures or customer names). */
  limited?: boolean | undefined;
  stats: AdminDashboardStats;
  ordersByStatus: Record<string, number>;
  salesByDay?: DailyPoint[] | undefined;
  topProducts?:
    | Array<{
        _id: string;
        title: string;
        thumbnail?: string | undefined;
        units: number;
        revenue: number;
      }>
    | undefined;
  categorySales?: Array<{ name: string; revenue: number }> | undefined;
  recentOrders?: OverviewOrder[] | undefined;
  lowStock: LowStockRow[];
  customerInsights?: CustomerInsights | undefined;
  topVendors?: SellerRow[] | undefined;
}

/** Average time to ship, in hours or days. */
function formatShipTime(hours: number | null): string {
  if (hours === null) return "—";
  return hours < 48 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} days`;
}

const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

/** The queue cards: what an operations admin should clear today. */
interface QueueCard {
  id: string;
  label: string;
  icon: LucideIcon;
  permission?: AdminPermission | undefined;
  count: (stats: AdminDashboardStats) => number;
  hint: string;
  tab: string;
  status?: string | undefined;
}

const QUEUE: QueueCard[] = [
  {
    id: "products",
    label: "Product approvals",
    icon: Box,
    permission: "products",
    count: (stats) => stats.pendingProducts,
    hint: "Waiting for catalogue review",
    tab: "products",
    status: "Pending Approval",
  },
  {
    id: "returns",
    label: "Return requests",
    icon: RotateCcw,
    permission: "orders",
    count: (stats) => stats.returnRequests,
    hint: "Approve or decline a refund",
    tab: "returns",
  },
  {
    id: "reviews",
    label: "Reviews to moderate",
    icon: Star,
    permission: "reviews",
    count: (stats) => stats.pendingReviews,
    hint: "Pending approval",
    tab: "reviews",
    status: "Pending Approval",
  },
  {
    id: "vendors",
    label: "Seller applications",
    icon: Store,
    permission: "vendors",
    count: (stats) => stats.pendingVendors,
    hint: "Awaiting store review",
    tab: "vendors",
  },
  {
    id: "payouts",
    label: "Payouts to action",
    icon: Wallet,
    permission: "finance",
    count: (stats) => stats.pendingPayouts,
    hint: "Requested or processing",
    tab: "payouts",
  },
  {
    id: "tickets",
    label: "Open support tickets",
    icon: LifeBuoy,
    permission: "support",
    count: (stats) => stats.openTickets,
    hint: "Open or in progress",
    tab: "tickets",
  },
  {
    id: "messages",
    label: "New contact messages",
    icon: Mail,
    permission: "support",
    count: (stats) => stats.newMessages,
    hint: "From the contact form",
    tab: "messages",
  },
];

export function OverviewTab() {
  const { user } = useStore();
  const navigate = useAdminNavigate();
  const [days, setDays] = useState<Range>(30);

  const query = useQuery({
    queryKey: ["admin-dashboard", days],
    queryFn: () => api<DashboardResponse>("/admin/dashboard", { query: { days } }),
    staleTime: 60_000,
    retry: opsRetry,
  });

  if (isForbidden(query.error)) return <ForbiddenState />;

  const data = query.data;
  const stats = data?.stats;
  const limited = Boolean(data?.limited);
  const insights = data?.customerInsights;
  const signupPoints: DailyPoint[] = (insights?.signupsByDay ?? []).map((point) => ({
    date: point.date,
    revenue: 0,
    orders: point.count,
  }));
  const acquisitionRows: RankedRow[] = (insights?.acquisition ?? []).map((row) => ({
    label: row.source === "unknown" ? "Not recorded" : row.source,
    value: row.count,
  }));

  const periodRevenue = (data?.salesByDay ?? []).reduce((sum, point) => sum + point.revenue, 0);
  const periodOrders = (data?.salesByDay ?? []).reduce((sum, point) => sum + point.orders, 0);

  const topProductRows: RankedRow[] = (data?.topProducts ?? []).map((row) => ({
    label: row.title,
    value: row.revenue,
  }));
  const categoryRows: RankedRow[] = (data?.categorySales ?? []).slice(0, 8).map((row) => ({
    label: row.name,
    value: row.revenue,
  }));
  const statusRows: RankedRow[] = Object.entries(data?.ordersByStatus ?? {})
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const queue = QUEUE.filter((card) => !card.permission || canView(user, card.permission));

  return (
    <div className="space-y-5">
      {/* Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Marketplace overview</h2>
          <p className="text-xs text-muted-foreground">
            Charts and the action queue cover the last {days} days. Lifetime totals are shown on the
            KPI tiles.
          </p>
        </div>
        <div
          className="flex rounded-xl border border-border p-0.5"
          role="group"
          aria-label="Reporting range"
        >
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              aria-pressed={days === option}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                days === option
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      {query.isError && !isForbidden(query.error) && (
        <InlineError
          message={
            query.error instanceof Error ? query.error.message : "We couldn't load the dashboard."
          }
          onRetry={() => void query.refetch()}
        />
      )}

      {query.isPending && <GridSkeleton count={10} />}

      {stats && data && (
        <>
          {limited && (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
              Sales and revenue figures need the Orders or Finance permission, so this view shows
              your queues and customer activity only.
            </p>
          )}

          {/* KPIs */}
          {!limited && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard
                label="GMV"
                value={formatPrice(stats.gmv)}
                hint={`${compactCount(stats.revenueOrders ?? 0)} revenue orders`}
                icon={Banknote}
                tone="success"
              />
              <StatCard
                label="Orders"
                value={compactCount(stats.totalOrders ?? 0)}
                hint={`${stats.awaitingFulfilment} awaiting fulfilment`}
                icon={ShoppingBag}
              />
              <StatCard
                label="Average order value"
                value={formatPrice(stats.averageOrderValue)}
                hint="Across revenue orders"
                icon={Receipt}
              />
              <StatCard
                label="Commission earned"
                value={formatPrice(stats.commissionEarned)}
                hint="Platform take from sellers"
                icon={Percent}
                tone="success"
              />
              <StatCard
                label="VAT collected"
                value={formatPrice(stats.vatCollected)}
                hint="Payable to the FTA"
                icon={CreditCard}
              />
              <StatCard
                label="Delivery collected"
                value={formatPrice(stats.shippingCollected)}
                hint="Shipping fees charged"
                icon={Truck}
              />
              <StatCard
                label="Discounts given"
                value={formatPrice(stats.discountsGiven)}
                hint="Coupons and promotions"
                icon={Percent}
                tone="warning"
              />
              <StatCard
                label="Refunds issued"
                value={formatPrice(stats.refundsIssued)}
                hint={`${stats.refundCount} refunded ${stats.refundCount === 1 ? "order" : "orders"}`}
                icon={Undo2}
                tone="danger"
              />
              <StatCard
                label="Customers"
                value={compactCount(stats.customers)}
                hint={`+${compactCount(stats.newCustomers)} new in ${days} days`}
                icon={Users}
              />
              <StatCard
                label="Active sellers"
                value={compactCount(stats.activeVendors)}
                hint={`${stats.pendingVendors} awaiting approval`}
                icon={Store}
              />
            </div>
          )}

          {/* Action queue */}
          {queue.length > 0 && (
            <SectionCard
              title="Needs your attention"
              description="Everything queued for the operations team right now."
              bodyClassName="p-3 sm:p-4"
            >
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {queue.map((card) => {
                  const count = card.count(stats);
                  const Icon = card.icon;
                  return (
                    <li key={card.id}>
                      <button
                        type="button"
                        onClick={() =>
                          void navigate({
                            search: (previous) => ({
                              ...previous,
                              tab: card.tab,
                              status: card.status,
                            }),
                          })
                        }
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          count > 0
                            ? "border-border bg-card hover:border-foreground/25 hover:bg-accent"
                            : "border-dashed border-border bg-card/60 hover:bg-accent",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                            count > 0
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{card.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {count > 0 ? card.hint : "All clear"}
                          </span>
                        </span>
                        <span className="font-display text-xl font-extrabold tabular-nums">
                          {count}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}

          {/* Customers: activity, growth, value */}
          {insights && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <StatCard
                  label="Active today"
                  value={compactCount(insights.activeUsers.day)}
                  hint="Customers seen in the last 24 hours"
                  icon={Activity}
                />
                <StatCard
                  label="Active this week"
                  value={compactCount(insights.activeUsers.week)}
                  hint="Last 7 days"
                  icon={Activity}
                />
                <StatCard
                  label="Active this month"
                  value={compactCount(insights.activeUsers.month)}
                  hint="Last 30 days"
                  icon={Users}
                />
                {!limited && (
                  <>
                    <StatCard
                      label="Customer lifetime value"
                      value={formatPrice(insights.lifetimeValue)}
                      hint={`Average spend of ${compactCount(insights.payingCustomers ?? 0)} paying customers`}
                      icon={Banknote}
                      tone="success"
                    />
                    <StatCard
                      label="Repeat customers"
                      value={percent(insights.repeatRate)}
                      hint="Paying customers with 2+ orders"
                      icon={Repeat}
                    />
                  </>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title="New customers"
                  description={`Sign-ups per day over the last ${days} days`}
                  total={compactCount(signupPoints.reduce((sum, point) => sum + point.orders, 0))}
                  table={<DailyTable data={signupPoints} valueKey="orders" valueLabel="Sign-ups" />}
                >
                  <OrdersBarChart
                    data={signupPoints}
                    valueLabel="Sign-ups"
                    emptyMessage="No sign-ups in this period."
                  />
                </ChartCard>
                <ChartCard
                  title="Where new customers come from"
                  description="First visit's campaign (utm_source) or referring site"
                  table={<RankedTable rows={acquisitionRows} currency={false} label="Source" />}
                >
                  <RankedBarList
                    rows={acquisitionRows}
                    currency={false}
                    emptyMessage="No sign-ups in this period."
                  />
                </ChartCard>
              </div>
            </>
          )}

          {!limited && data.topVendors && (
            <SectionCard
              title="Top sellers"
              description={`Best-selling stores over the last ${days} days, with how well they deliver`}
            >
              {data.topVendors.length === 0 ? (
                <EmptyState
                  icon={Store}
                  title="No seller sales in this period"
                  description="Seller rankings appear once orders come in."
                  className="py-10"
                />
              ) : (
                <TableScroll>
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                      <th className="py-2 pr-3 font-bold">Seller</th>
                      <th className="py-2 pr-3 text-right font-bold">Sales</th>
                      <th className="py-2 pr-3 text-right font-bold">Orders</th>
                      <th className="py-2 pr-3 text-right font-bold">Rating</th>
                      <th className="py-2 pr-3 text-right font-bold">Ships in</th>
                      <th className="py-2 pr-3 text-right font-bold">Cancelled</th>
                      <th className="py-2 text-right font-bold">Returned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.topVendors.map((seller) => (
                      <tr key={seller._id}>
                        <td className="py-2 pr-3 font-medium">{seller.name}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                          {formatPrice(seller.sales)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{seller.orders}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {seller.rating === null ? "—" : `${seller.rating.toFixed(1)} ★`}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatShipTime(seller.avgShipHours)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {percent(seller.cancellationRate)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {percent(seller.returnRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableScroll>
              )}
            </SectionCard>
          )}

          {/* Trends */}
          {!limited && (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title="Revenue"
                  description={`Order value per day over the last ${days} days`}
                  total={formatPrice(periodRevenue)}
                  table={
                    <DailyTable
                      data={data.salesByDay ?? []}
                      valueKey="revenue"
                      valueLabel="Revenue"
                    />
                  }
                >
                  <RevenueAreaChart data={data.salesByDay ?? []} />
                </ChartCard>
                <ChartCard
                  title="Orders"
                  description={`Orders placed per day over the last ${days} days`}
                  total={compactCount(periodOrders)}
                  table={
                    <DailyTable
                      data={data.salesByDay ?? []}
                      valueKey="orders"
                      valueLabel="Orders"
                    />
                  }
                >
                  <OrdersBarChart data={data.salesByDay ?? []} />
                </ChartCard>
              </div>

              {/* Rankings */}
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartCard
                  title="Top products"
                  description="By revenue, all time"
                  table={<RankedTable rows={topProductRows} label="Product" />}
                >
                  <RankedBarList rows={topProductRows} emptyMessage="No product sales yet." />
                </ChartCard>
                <ChartCard
                  title="Revenue by category"
                  description="Where the money comes from"
                  table={<RankedTable rows={categoryRows} label="Category" />}
                >
                  <RankedBarList rows={categoryRows} emptyMessage="No category sales yet." />
                </ChartCard>
                <ChartCard
                  title="Orders by status"
                  description="Every order on the platform"
                  table={<RankedTable rows={statusRows} currency={false} label="Status" />}
                >
                  <RankedBarList rows={statusRows} currency={false} emptyMessage="No orders yet." />
                </ChartCard>
              </div>
            </>
          )}

          {/* Tables */}
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Low stock"
              description="Active variants at or below their low-stock alert"
              actions={
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      search: (previous) => ({ ...previous, tab: "products", status: undefined }),
                    })
                  }
                  className="text-xs font-semibold underline underline-offset-4"
                >
                  Open products
                </button>
              }
            >
              {data.lowStock.length === 0 ? (
                <EmptyState
                  icon={PackageCheck}
                  title="Stock levels look healthy"
                  description="No active variant is below its alert threshold."
                  className="py-10"
                />
              ) : (
                <TableScroll>
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                      <th className="py-2 pr-3 font-bold">Product</th>
                      <th className="py-2 pr-3 font-bold">SKU</th>
                      <th className="py-2 text-right font-bold">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.lowStock.map((row) => (
                      <tr key={`${row._id}-${row.sku}`}>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <Thumb src={row.thumbnail} alt="" className="h-9 w-9" />
                            <span className="min-w-0 truncate font-medium">{row.title}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                          {row.sku}
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                              row.stock === 0
                                ? "bg-destructive/12 text-destructive"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                            )}
                          >
                            {row.stock === 0 && <AlertTriangle className="h-3 w-3" />}
                            {row.stock === 0 ? "Out of stock" : row.stock}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableScroll>
              )}
            </SectionCard>

            {!limited && (
              <SectionCard
                title="Recent orders"
                description="The newest orders across the marketplace"
                actions={
                  <button
                    type="button"
                    onClick={() =>
                      void navigate({
                        search: (previous) => ({ ...previous, tab: "orders", status: undefined }),
                      })
                    }
                    className="text-xs font-semibold underline underline-offset-4"
                  >
                    Open orders
                  </button>
                }
              >
                {(data.recentOrders ?? []).length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No orders yet"
                    description="New orders will appear here as soon as they are placed."
                    className="py-10"
                  />
                ) : (
                  <TableScroll>
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                        <th className="py-2 pr-3 font-bold">Order</th>
                        <th className="py-2 pr-3 font-bold">Customer</th>
                        <th className="py-2 pr-3 font-bold">Status</th>
                        <th className="py-2 text-right font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(data.recentOrders ?? []).map((order) => (
                        <tr
                          key={order._id}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() =>
                            void navigate({
                              search: (previous) => ({
                                ...previous,
                                tab: "orders",
                                status: undefined,
                              }),
                            })
                          }
                        >
                          <td className="py-2 pr-3">
                            <span className="block font-mono text-xs font-semibold">
                              {order.orderId}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {formatDate(order.createdAt)}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <span className="block truncate font-medium">
                              {order.shippingAddress?.receiverName ?? "—"}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {order.shippingAddress?.emirate ?? "—"}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="py-2 text-right font-semibold tabular-nums">
                            {formatPrice(order.pricing?.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableScroll>
                )}
              </SectionCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
