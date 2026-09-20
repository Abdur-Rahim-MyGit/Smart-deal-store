import { useCallback, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Loader2, MapPin, Printer, Truck } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { OrderItem, OrderStatus } from "@/lib/types";
import {
  CardListSkeleton,
  FilterChip,
  MetaItem,
  ResultCount,
  SearchBox,
  Thumb,
  variantLabel,
} from "@/components/vendor/common";
import { PackingSlip } from "@/components/vendor/packing-slip";
import { LockedNotice, useVendorGate } from "@/components/vendor/vendor-status";
import type { VendorOrder, VendorOrderView, VendorOrdersResponse } from "@/components/vendor/types";

const VIEWS: Array<{ id: VendorOrderView; label: string }> = [
  { id: "to-fulfil", label: "To fulfil" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled & returns" },
];

const EMPTY_COPY: Record<VendorOrderView, { title: string; description: string }> = {
  "to-fulfil": {
    title: "Nothing to pack right now",
    description:
      "New orders land here the moment a shopper checks out. You'll also see a badge on the Orders tab.",
  },
  shipped: {
    title: "No parcels in transit",
    description: "Orders you mark as shipped stay here until they're delivered.",
  },
  delivered: {
    title: "No delivered orders yet",
    description: "Delivered orders move here, and their earnings start clearing.",
  },
  cancelled: {
    title: "No cancellations or returns",
    description: "Cancelled orders and return requests would be listed here.",
  },
};

/** The seller may only push an item one step at a time — the API rejects anything else. */
const NEXT_STEP: Partial<
  Record<
    OrderStatus,
    { status: "Confirmed" | "Processing" | "Shipped"; label: string; hint: string }
  >
> = {
  Placed: { status: "Confirmed", label: "Confirm", hint: "Next: confirm you can fulfil this item" },
  Confirmed: { status: "Processing", label: "Start packing", hint: "Next: start packing" },
  Processing: { status: "Shipped", label: "Mark shipped", hint: "Next: hand to the courier" },
};

const CLOSED_ORDER_STATUSES: OrderStatus[] = [
  "Cancelled",
  "Returned",
  "Refunded",
  "Delivered",
  "Return Requested",
];

interface StatusChange {
  orderId: string;
  itemId: string;
  status: "Confirmed" | "Processing" | "Shipped";
  carrier?: string | undefined;
  trackingNumber?: string | undefined;
}

const variantLine = (item: OrderItem): string => variantLabel(item.options, item.variantLabel);

/** Fulfilment queue: confirm, pack, ship and print packing slips. */
export function OrdersTab() {
  const gate = useVendorGate();
  const { user } = useStore();
  const queryClient = useQueryClient();

  const [view, setView] = useState<VendorOrderView>("to-fulfil");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [shipTarget, setShipTarget] = useState<{ order: VendorOrder; item: OrderItem } | null>(
    null,
  );
  const [printJob, setPrintJob] = useState<{ order: VendorOrder; nonce: number } | null>(null);

  const debouncedSearch = useDebounce(search, 350);
  const storeName = user?.vendorDetails?.businessName || user?.name || "Smart Deal seller";

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["vendor-orders", { view, q: debouncedSearch, page }],
    queryFn: () =>
      api<VendorOrdersResponse>("/vendors/orders", {
        query: { view, q: debouncedSearch || undefined, page },
      }),
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, itemId, status, carrier, trackingNumber }: StatusChange) =>
      api<{ message: string; orderStatus: OrderStatus }>(
        `/vendors/orders/${orderId}/items/${itemId}/status`,
        {
          method: "PUT",
          body: { status, carrier, trackingNumber },
        },
      ),
    onSuccess: (response) => {
      toast.success(response.message || "Order updated");
      setShipTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  const pendingItemId = statusMutation.isPending ? statusMutation.variables?.itemId : undefined;
  const closePrint = useCallback(() => setPrintJob(null), []);

  function advance(order: VendorOrder, item: OrderItem) {
    const step = NEXT_STEP[item.status];
    if (!step) return;
    if (step.status === "Shipped") {
      setShipTarget({ order, item });
      return;
    }
    statusMutation.mutate({ orderId: order._id, itemId: item._id, status: step.status });
  }

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Orders</h2>
          <p className="text-sm text-muted-foreground">
            Only your items are shown — other sellers fulfil their own lines.
          </p>
        </div>
        <ResultCount shown={orders.length} total={data?.total ?? 0} noun="orders" />
      </div>

      {!gate.isActive && (
        <LockedNotice reason={`Fulfilment actions are disabled. ${gate.lockReason ?? ""}`.trim()} />
      )}

      <div className="rail-scroll flex gap-2 overflow-x-auto pb-1">
        {VIEWS.map((entry) => (
          <FilterChip
            key={entry.id}
            label={entry.label}
            active={view === entry.id}
            onClick={() => {
              setView(entry.id);
              setPage(1);
            }}
          />
        ))}
      </div>

      <SearchBox
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search by order number"
        label="Search orders by number"
      />

      {isPending ? (
        <CardListSkeleton rows={3} />
      ) : isError ? (
        <InlineError
          message={errorMessage(error, "We couldn't load your orders.")}
          onRetry={() => void refetch()}
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            debouncedSearch
              ? "No orders match that number"
              : (EMPTY_COPY[view]?.title ?? "No orders")
          }
          description={
            debouncedSearch
              ? "Check the order number and try again."
              : EMPTY_COPY[view]?.description
          }
          action={
            debouncedSearch ? (
              <Button
                variant="outline"
                className="rounded-xl font-semibold"
                onClick={() => setSearch("")}
              >
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={isFetching ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"}>
          {orders.map((order) => {
            const locked = CLOSED_ORDER_STATUSES.includes(order.status);
            return (
              <article
                key={order._id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
              >
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-mono text-sm font-bold">{order.orderId}</h3>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      <p className="font-display text-base font-extrabold tabular-nums">
                        {formatPrice(order.vendorTotal)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        You earn {formatPrice(order.vendorEarning)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl font-semibold"
                      onClick={() => setPrintJob({ order, nonce: Date.now() })}
                    >
                      <Printer className="mr-1.5 h-4 w-4" /> Packing slip
                    </Button>
                  </div>
                </header>

                <div className="grid gap-4 border-b border-border px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
                  <MetaItem label="Customer">
                    <p className="font-semibold">{order.shippingAddress.receiverName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.shippingAddress.emirate} · {order.shippingAddress.receiverPhone}
                    </p>
                  </MetaItem>
                  <MetaItem label="Deliver to">
                    <p className="flex items-start gap-1.5 text-sm">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {order.shippingAddress.buildingDetails}
                        {order.shippingAddress.street
                          ? `, ${order.shippingAddress.street}`
                          : ""}, {order.shippingAddress.area}
                        {order.shippingAddress.landmark
                          ? ` (${order.shippingAddress.landmark})`
                          : ""}
                      </span>
                    </p>
                  </MetaItem>
                  <MetaItem label="Payment">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{order.paymentDetails.method}</span>
                      <StatusBadge status={order.paymentDetails.status} />
                    </div>
                    {order.shippingMethod && (
                      <p className="text-xs text-muted-foreground">
                        {order.shippingMethod.label} · {order.shippingMethod.eta}
                      </p>
                    )}
                  </MetaItem>
                  <MetaItem label="Delivery notes">
                    {order.deliveryInstructions ? (
                      <p className="text-sm">{order.deliveryInstructions}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">None</p>
                    )}
                  </MetaItem>
                </div>

                <ul className="divide-y divide-border">
                  {order.items.map((item) => {
                    const step = NEXT_STEP[item.status];
                    const busy = pendingItemId === item._id;
                    return (
                      <li
                        key={item._id}
                        className="flex flex-wrap items-start gap-3 px-4 py-4 sm:px-5"
                      >
                        <Thumb src={item.thumbnail} alt="" className="h-14 w-14" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{item.title}</p>
                          {variantLine(item) && (
                            <p className="text-xs text-muted-foreground">{variantLine(item)}</p>
                          )}
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {item.variantSku}
                          </p>
                          <p className="mt-1 text-sm tabular-nums">
                            <span className="font-semibold">{item.qty}</span> ×{" "}
                            {formatPrice(item.price)}
                            <span className="text-muted-foreground">
                              {" "}
                              · you earn {formatPrice(item.vendorEarning ?? 0)}
                              {item.commissionRate !== undefined
                                ? ` (${item.commissionRate}% commission)`
                                : ""}
                            </span>
                          </p>
                          {item.carrier && (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Truck className="h-3.5 w-3.5" /> {item.carrier}
                              {item.trackingNumber ? ` · ${item.trackingNumber}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <StatusBadge status={item.status} />
                          {step && !locked ? (
                            <>
                              <Button
                                size="sm"
                                className="rounded-xl font-semibold"
                                disabled={!gate.isActive || statusMutation.isPending}
                                onClick={() => advance(order, item)}
                              >
                                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                {step.label}
                              </Button>
                              <p className="text-[11px] text-muted-foreground">{step.hint}</p>
                            </>
                          ) : (
                            <p className="max-w-[180px] text-right text-[11px] text-muted-foreground">
                              {item.status === "Shipped" || item.status === "Out for Delivery"
                                ? "With the courier — Smart Deal marks it delivered."
                                : item.status === "Delivered"
                                  ? "Delivered. Earnings clear after the hold period."
                                  : "No action needed from you."}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      )}

      <PaginationBar page={data?.page ?? 1} pages={data?.pages ?? 1} onChange={setPage} />

      {shipTarget && (
        <ShipDialog
          item={shipTarget.item}
          busy={statusMutation.isPending}
          onCancel={() => setShipTarget(null)}
          onConfirm={(carrier, trackingNumber) =>
            statusMutation.mutate({
              orderId: shipTarget.order._id,
              itemId: shipTarget.item._id,
              status: "Shipped",
              carrier,
              trackingNumber: trackingNumber || undefined,
            })
          }
        />
      )}

      {printJob && (
        <PackingSlip
          key={printJob.nonce}
          order={printJob.order}
          storeName={storeName}
          onDone={closePrint}
        />
      )}
    </div>
  );
}

function ShipDialog({
  item,
  busy,
  onCancel,
  onConfirm,
}: {
  item: OrderItem;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (carrier: string, trackingNumber: string) => void;
}) {
  const [carrier, setCarrier] = useState(item.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(item.trackingNumber ?? "");

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Mark as shipped</DialogTitle>
          <DialogDescription>
            {item.title} — the customer is notified with the courier details you enter here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ship-carrier">Courier</Label>
            <Input
              id="ship-carrier"
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
              placeholder="e.g. Aramex, Fetchr, Emirates Post"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ship-tracking">Tracking number (optional)</Label>
            <Input
              id="ship-tracking"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="e.g. 4512889001"
              className="h-10 rounded-xl font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="rounded-xl font-semibold"
            disabled={busy || !carrier.trim()}
            onClick={() => onConfirm(carrier.trim(), trackingNumber.trim())}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark shipped
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
