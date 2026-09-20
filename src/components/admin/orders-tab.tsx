import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ClipboardList, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import type { Order, Paginated, PaymentMethod, PaymentStatus } from "@/lib/types";
import {
  FilterChips,
  FilterField,
  FilterRow,
  ForbiddenState,
  SearchInput,
  TableSkeleton,
  type ChipOption,
} from "@/components/admin/ops-common";
import {
  inputClass,
  isForbidden,
  opsRetry,
  selectClass,
  useAdminSearch,
} from "@/components/admin/ops-utils";
import { OrderDetailPanel } from "@/components/admin/ops-order-detail";

const STATUS_ORDER = [
  "Placed",
  "Confirmed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Return Requested",
  "Returned",
  "Refunded",
  "Cancelled",
] as const;

const PAYMENT_METHODS: PaymentMethod[] = ["COD", "Card", "Wallet"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Paid", "Failed", "Refunded"];

interface OrdersResponse extends Paginated {
  orders: Order[];
  statusCounts: Record<string, number>;
}

const customerOf = (order: Order) =>
  typeof order.user === "object" && order.user ? order.user : null;

export function OrdersTab() {
  const search = useAdminSearch();
  const initialStatus = STATUS_ORDER.includes(search.status as (typeof STATUS_ORDER)[number])
    ? (search.status as string)
    : "";

  const [status, setStatus] = useState(initialStatus);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const q = useDebounce(term, 350);

  const query = useQuery({
    queryKey: ["admin-orders", { status, paymentMethod, paymentStatus, from, to, q, page }],
    queryFn: () =>
      api<OrdersResponse>("/admin/orders", {
        query: { status, paymentMethod, paymentStatus, from, to, q, page, limit: 20 },
      }),
    placeholderData: keepPreviousData,
    retry: opsRetry,
  });

  const counts = useMemo(() => query.data?.statusCounts ?? {}, [query.data]);
  const activeCount = useMemo(
    () =>
      ["Placed", "Confirmed", "Processing", "Shipped", "Out for Delivery"].reduce(
        (sum, key) => sum + (counts[key] ?? 0),
        0,
      ),
    [counts],
  );
  const total = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts],
  );

  const chips: ChipOption[] = [
    { value: "", label: "All", count: total },
    { value: "active", label: "Active", count: activeCount },
    ...STATUS_ORDER.filter((entry) => counts[entry]).map((entry) => ({
      value: entry as string,
      label: entry as string,
      count: counts[entry],
    })),
  ];

  const filtersDirty = Boolean(status || paymentMethod || paymentStatus || from || to || term);

  function update<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function resetFilters() {
    setStatus("");
    setPaymentMethod("");
    setPaymentStatus("");
    setFrom("");
    setTo("");
    setTerm("");
    setPage(1);
  }

  if (isForbidden(query.error)) return <ForbiddenState section="orders" />;

  const orders = query.data?.orders ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold">Orders</h2>
          <p className="text-xs text-muted-foreground">
            Every order on the marketplace. Open one to move it through fulfilment or print its tax
            invoice.
          </p>
        </div>

        <FilterChips
          options={chips}
          value={status}
          onChange={update(setStatus)}
          ariaLabel="Filter by order status"
        />

        <FilterRow>
          <SearchInput
            value={term}
            onChange={update(setTerm)}
            placeholder="Order number, name or phone"
            label="Search orders"
          />
          <FilterField label="Payment">
            <select
              aria-label="Payment method"
              className={selectClass}
              value={paymentMethod}
              onChange={(event) => update(setPaymentMethod)(event.target.value)}
            >
              <option value="">Any method</option>
              {PAYMENT_METHODS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Payment status">
            <select
              aria-label="Payment status"
              className={selectClass}
              value={paymentStatus}
              onChange={(event) => update(setPaymentStatus)(event.target.value)}
            >
              <option value="">Any payment status</option>
              {PAYMENT_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="From">
            <Input
              type="date"
              aria-label="Placed from"
              value={from}
              max={to || undefined}
              onChange={(event) => update(setFrom)(event.target.value)}
              className={`${inputClass} w-[9.5rem]`}
            />
          </FilterField>
          <FilterField label="To">
            <Input
              type="date"
              aria-label="Placed until"
              value={to}
              min={from || undefined}
              onChange={(event) => update(setTo)(event.target.value)}
              className={`${inputClass} w-[9.5rem]`}
            />
          </FilterField>
          {filtersDirty && (
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </FilterRow>
      </div>

      <SectionCard
        title={
          query.data ? `${query.data.total} order${query.data.total === 1 ? "" : "s"}` : "Orders"
        }
        description={filtersDirty ? "Filtered view" : "Newest first"}
        bodyClassName="p-3 sm:p-4"
      >
        {query.isPending && <TableSkeleton rows={8} />}

        {query.isError && !isForbidden(query.error) && (
          <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        )}

        {query.data && orders.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title="No orders match these filters"
            description="Try a different status, date range or search term."
            action={
              filtersDirty ? (
                <Button variant="outline" className="rounded-xl" onClick={resetFilters}>
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {orders.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <TableScroll>
                <thead>
                  <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pr-3 font-bold">Order</th>
                    <th className="py-2 pr-3 font-bold">Customer</th>
                    <th className="py-2 pr-3 font-bold">Emirate</th>
                    <th className="py-2 pr-3 text-right font-bold">Items</th>
                    <th className="py-2 pr-3 text-right font-bold">Total</th>
                    <th className="py-2 pr-3 font-bold">Payment</th>
                    <th className="py-2 pr-3 font-bold">Status</th>
                    <th className="py-2 font-bold">Placed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr
                      key={order._id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setOpenOrderId(order._id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenOrderId(order._id);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <td className="py-2.5 pr-3 font-mono text-xs font-semibold">
                        {order.orderId}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="block max-w-[180px] truncate font-medium">
                          {customerOf(order)?.name ?? order.shippingAddress.receiverName}
                        </span>
                        <span className="block max-w-[180px] truncate text-[11px] text-muted-foreground">
                          {customerOf(order)?.email ?? order.shippingAddress.receiverPhone}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{order.shippingAddress.emirate}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{order.items.length}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                        {formatPrice(order.pricing.total)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="block text-xs font-medium">
                          {order.paymentDetails.method}
                        </span>
                        <StatusBadge status={order.paymentDetails.status} className="mt-0.5" />
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableScroll>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-2 md:hidden">
              {orders.map((order) => (
                <li key={order._id}>
                  <button
                    type="button"
                    onClick={() => setOpenOrderId(order._id)}
                    className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{order.orderId}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">
                      {customerOf(order)?.name ?? order.shippingAddress.receiverName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {order.shippingAddress.emirate} · {order.items.length} item
                      {order.items.length === 1 ? "" : "s"} · {order.paymentDetails.method} (
                      {order.paymentDetails.status})
                    </p>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatPrice(order.pricing.total)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <PaginationBar
              page={query.data?.page ?? page}
              pages={query.data?.pages ?? 1}
              onChange={setPage}
              className="mt-4"
            />
          </>
        )}
      </SectionCard>

      <OrderDetailPanel orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}
