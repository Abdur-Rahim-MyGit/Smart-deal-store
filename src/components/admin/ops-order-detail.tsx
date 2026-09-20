import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  Printer,
  Truck,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { InlineError, PageLoader } from "@/components/common/page-loader";
import { useSettings } from "@/hooks/use-settings";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { DetailRow, ForbiddenState, PanelHeading, Thumb } from "@/components/admin/ops-common";
import { isForbidden, opsRetry, useOpsInvalidate } from "@/components/admin/ops-utils";
import { PrintInvoice } from "@/components/admin/ops-invoice";
import { RefundList, refundMethodLabel } from "@/components/account/refund-choice";

const CARRIERS = [
  "Aramex",
  "Emirates Post",
  "DHL Express",
  "Fetchr",
  "Quiqup",
  "Careem Express",
  "First Flight",
];

const CANCEL_REASONS = [
  "Out of stock at the seller",
  "Customer asked us to cancel",
  "Undeliverable address",
  "Suspected fraudulent order",
  "Payment could not be verified",
  "Other",
];

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  Confirmed: "Confirm order",
  Processing: "Mark as processing",
  Shipped: "Mark as shipped",
  "Out for Delivery": "Out for delivery",
  Delivered: "Mark as delivered",
  Cancelled: "Cancel order",
  Refunded: "Issue refund",
};

const customerOf = (order: Order) =>
  typeof order.user === "object" && order.user ? order.user : null;

/** Slide-over with everything an admin needs to work one order. */
export function OrderDetailPanel({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const invalidate = useOpsInvalidate();
  const settings = useSettings();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [printing, setPrinting] = useState(false);

  const query = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: () =>
      api<{ order: Order }>(`/admin/orders/${orderId}`).then((response) => response.order),
    enabled: Boolean(orderId),
    retry: opsRetry,
  });

  const order = query.data;

  const mutation = useMutation({
    mutationFn: (body: {
      status: OrderStatus;
      remarks?: string;
      carrier?: string;
      trackingNumber?: string;
    }) =>
      api<{ message: string; order: Order }>(`/admin/orders/${orderId}/status`, {
        method: "PUT",
        body,
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setPending(null);
      invalidate("admin-order", "admin-orders", "admin-returns", "admin-dashboard");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  useEffect(() => {
    if (!orderId) setPending(null);
  }, [orderId]);

  const allowed = order?.capabilities?.allowedNextStatuses ?? [];

  return (
    <>
      <Sheet open={Boolean(orderId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[44rem]"
          aria-describedby={undefined}
        >
          {query.isPending && <PageLoader label="Loading order…" />}

          {isForbidden(query.error) && (
            <div className="p-6">
              <ForbiddenState section="orders" />
            </div>
          )}

          {query.isError && !isForbidden(query.error) && (
            <div className="p-6">
              <InlineError
                message={errorMessage(query.error)}
                onRetry={() => void query.refetch()}
              />
            </div>
          )}

          {order && (
            <>
              <SheetHeader className="sticky top-0 z-10 space-y-2 border-b border-border bg-card/95 p-5 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="font-mono text-base">{order.orderId}</SheetTitle>
                  <StatusBadge status={order.status} />
                </div>
                <SheetDescription>
                  Placed {formatDateTime(order.createdAt)} · {order.items.length} item
                  {order.items.length === 1 ? "" : "s"} · {formatPrice(order.pricing.total)}
                </SheetDescription>

                <div className="flex flex-wrap gap-2 pt-1">
                  {allowed.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === "Cancelled" ? "outline" : "default"}
                      className={
                        status === "Cancelled"
                          ? "rounded-xl border-destructive/40 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                          : "rounded-xl font-semibold"
                      }
                      onClick={() => setPending(status)}
                      disabled={mutation.isPending}
                    >
                      {ACTION_LABELS[status] ?? `Move to ${status}`}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-semibold"
                    onClick={() => setPrinting(true)}
                    disabled={printing}
                  >
                    <Printer className="mr-1.5 h-4 w-4" /> Print invoice
                  </Button>
                </div>
                {allowed.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {order.status === "Return Requested"
                      ? "Resolve this in the Returns queue."
                      : `No further status change is possible for a ${order.status.toLowerCase()} order.`}
                  </p>
                )}
              </SheetHeader>

              <div className="space-y-5 p-5">
                {/* Items */}
                <section className="space-y-3">
                  <PanelHeading icon={Package} title="Items" />
                  <ul className="divide-y divide-border rounded-2xl border border-border">
                    {order.items.map((item) => (
                      <li key={item._id} className="flex gap-3 p-3">
                        <Thumb src={item.thumbnail} alt="" className="h-14 w-14" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {[item.variantLabel, `SKU ${item.variantSku}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-0.5 text-xs">
                            <span className="text-muted-foreground">Qty {item.qty} × </span>
                            <span className="font-medium">{formatPrice(item.price)}</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatPrice(item.price * item.qty)}
                          </p>
                          <StatusBadge status={item.status} className="mt-1" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Customer */}
                  <section className="space-y-2 rounded-2xl border border-border p-4">
                    <PanelHeading icon={UserIcon} title="Customer" />
                    <p className="text-sm font-semibold">
                      {customerOf(order)?.name ?? order.shippingAddress.receiverName}
                    </p>
                    {customerOf(order)?.email && (
                      <p className="text-xs text-muted-foreground">{customerOf(order)?.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {customerOf(order)?.phone ?? order.shippingAddress.receiverPhone}
                    </p>
                  </section>

                  {/* Address */}
                  <section className="space-y-2 rounded-2xl border border-border p-4">
                    <PanelHeading icon={MapPin} title="Delivery address" />
                    <p className="text-sm font-semibold">{order.shippingAddress.receiverName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        order.shippingAddress.buildingDetails,
                        order.shippingAddress.street,
                        order.shippingAddress.area,
                        order.shippingAddress.emirate,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {order.shippingAddress.landmark && (
                      <p className="text-xs text-muted-foreground">
                        Landmark: {order.shippingAddress.landmark}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {order.shippingAddress.receiverPhone}
                    </p>
                  </section>
                </div>

                {/* Delivery */}
                <section className="space-y-2 rounded-2xl border border-border p-4">
                  <PanelHeading icon={Truck} title="Delivery" />
                  <DetailRow
                    label="Method"
                    value={
                      order.shippingMethod
                        ? `${order.shippingMethod.label} · ${order.shippingMethod.eta}`
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Carrier"
                    value={order.shippingDetails?.carrier || "Not assigned"}
                  />
                  <DetailRow
                    label="Tracking number"
                    value={
                      order.shippingDetails?.trackingNumber ? (
                        <span className="font-mono text-xs">
                          {order.shippingDetails.trackingNumber}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  {order.shippingDetails?.shippedAt && (
                    <DetailRow
                      label="Shipped"
                      value={formatDateTime(order.shippingDetails.shippedAt)}
                    />
                  )}
                  {order.shippingDetails?.deliveredAt && (
                    <DetailRow
                      label="Delivered"
                      value={formatDateTime(order.shippingDetails.deliveredAt)}
                    />
                  )}
                  {order.deliveryInstructions && (
                    <p className="mt-2 rounded-xl bg-muted/50 p-3 text-xs">
                      <span className="font-semibold">Instructions: </span>
                      {order.deliveryInstructions}
                    </p>
                  )}
                </section>

                {/* Payment */}
                <section className="space-y-1 rounded-2xl border border-border p-4">
                  <PanelHeading icon={CreditCard} title="Payment" />
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <span className="text-sm font-semibold">{order.paymentDetails.method}</span>
                    <StatusBadge status={order.paymentDetails.status} />
                    {order.paymentDetails.cardLast4 && (
                      <span className="text-xs text-muted-foreground">
                        {order.paymentDetails.cardBrand} ···· {order.paymentDetails.cardLast4}
                      </span>
                    )}
                  </div>
                  <DetailRow label="Subtotal" value={formatPrice(order.pricing.subtotal)} />
                  {order.pricing.discount > 0 && (
                    <DetailRow
                      label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
                      value={
                        <span className="text-success">−{formatPrice(order.pricing.discount)}</span>
                      }
                    />
                  )}
                  <DetailRow
                    label="Delivery"
                    value={
                      order.pricing.shippingFee > 0
                        ? formatPrice(order.pricing.shippingFee)
                        : "Free"
                    }
                  />
                  {order.pricing.codFee > 0 && (
                    <DetailRow
                      label="Cash on delivery fee"
                      value={formatPrice(order.pricing.codFee)}
                    />
                  )}
                  <DetailRow
                    label={`VAT @ ${order.pricing.vatRate}%`}
                    value={formatPrice(order.pricing.vat)}
                  />
                  <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
                    <span className="text-sm font-bold">Total</span>
                    <span className="font-display text-lg font-extrabold tabular-nums">
                      {formatPrice(order.pricing.total)}
                    </span>
                  </div>
                  {order.paymentDetails.transactionId && (
                    <p className="pt-1 text-[11px] text-muted-foreground">
                      Transaction{" "}
                      <span className="font-mono">{order.paymentDetails.transactionId}</span>
                    </p>
                  )}
                </section>

                {/* Return details */}
                {order.returnDetails?.reason && (
                  <section className="space-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <PanelHeading icon={AlertTriangle} title="Return" />
                    <DetailRow label="Reason" value={order.returnDetails.reason} />
                    {order.returnDetails.comments && (
                      <DetailRow label="Comments" value={order.returnDetails.comments} />
                    )}
                    {order.returnDetails.requestedAt && (
                      <DetailRow
                        label="Requested"
                        value={formatDateTime(order.returnDetails.requestedAt)}
                      />
                    )}
                    {order.returnDetails.resolution && (
                      <DetailRow label="Resolution" value={order.returnDetails.resolution} />
                    )}
                    {order.returnDetails.rejectReason && (
                      <DetailRow
                        label="Declined because"
                        value={order.returnDetails.rejectReason}
                      />
                    )}
                    {order.returnDetails.refundAmount !== undefined && (
                      <DetailRow
                        label={
                          order.returnDetails.resolution === "Approved" ? "Refunded" : "Refund due"
                        }
                        value={formatPrice(order.returnDetails.refundAmount)}
                      />
                    )}
                    {order.returnDetails.refundMethod && (
                      <DetailRow
                        label="Refund to"
                        value={refundMethodLabel(order.returnDetails.refundMethod)}
                      />
                    )}
                  </section>
                )}

                {(order.refunds?.length ?? 0) > 0 && (
                  <section className="space-y-2 rounded-2xl border border-border p-4">
                    <PanelHeading icon={AlertTriangle} title="Refunds" />
                    <RefundList refunds={order.refunds ?? []} />
                  </section>
                )}

                {/* Timeline */}
                <section className="space-y-3">
                  <PanelHeading icon={Package} title="Status timeline" />
                  <ol className="space-y-3 border-l border-border pl-4">
                    {order.statusTimeline.map((entry, index) => (
                      <li key={entry._id ?? `${entry.status}-${index}`} className="relative">
                        <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-foreground" />
                        <p className="text-sm font-semibold">{entry.status}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateTime(entry.updatedAt)}
                        </p>
                        {entry.remarks && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{entry.remarks}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {order && pending && (
        <StatusActionDialog
          order={order}
          status={pending}
          busy={mutation.isPending}
          onCancel={() => setPending(null)}
          onConfirm={(payload) => mutation.mutate({ status: pending, ...payload })}
        />
      )}

      {order && printing && (
        <PrintInvoice order={order} settings={settings} onDone={() => setPrinting(false)} />
      )}
    </>
  );
}

interface StatusPayload {
  remarks?: string;
  carrier?: string;
  trackingNumber?: string;
}

/** One dialog covering the three shapes of status change: ship, cancel and simple. */
function StatusActionDialog({
  order,
  status,
  busy,
  onCancel,
  onConfirm,
}: {
  order: Order;
  status: OrderStatus;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (payload: StatusPayload) => void;
}) {
  const [carrier, setCarrier] = useState(order.shippingDetails?.carrier ?? "");
  const [tracking, setTracking] = useState(order.shippingDetails?.trackingNumber ?? "");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");

  const isShip = status === "Shipped";
  const isCancel = status === "Cancelled";
  const isRefund = status === "Refunded";

  function submit() {
    if (isShip) {
      if (!carrier.trim()) {
        toast.error("Choose the carrier handling this order");
        return;
      }
      const label = carrier.trim();
      const code = tracking.trim();
      onConfirm({
        carrier: label,
        remarks: code ? `Handed over to ${label} (${code})` : `Handed over to ${label}`,
        ...(code ? { trackingNumber: code } : {}),
      });
      return;
    }
    if (isCancel) {
      const detail = [reason, remarks.trim()].filter(Boolean).join(" — ");
      if (!detail) {
        toast.error("Add a cancellation reason — the customer is told why");
        return;
      }
      onConfirm({ remarks: detail });
      return;
    }
    onConfirm(remarks.trim() ? { remarks: remarks.trim() } : {});
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isShip ? "Mark as shipped" : isCancel ? "Cancel this order" : `Move to ${status}`}
          </DialogTitle>
          <DialogDescription>
            {isShip
              ? `Add the carrier and tracking number for ${order.orderId}. The customer is notified straight away.`
              : isCancel
                ? `${order.orderId} will be cancelled and the customer told why.`
                : `${order.orderId} moves from ${order.status} to ${status}. The customer is notified.`}
          </DialogDescription>
        </DialogHeader>

        {isShip && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ship-carrier">Carrier</Label>
              <Input
                id="ship-carrier"
                list="sd-carriers"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
                placeholder="Aramex"
                className="h-10 rounded-xl"
              />
              <datalist id="sd-carriers">
                {CARRIERS.map((entry) => (
                  <option key={entry} value={entry} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ship-tracking">Tracking number</Label>
              <Input
                id="ship-tracking"
                value={tracking}
                onChange={(event) => setTracking(event.target.value.toUpperCase())}
                placeholder="ARX12345678"
                className="h-10 rounded-xl font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Optional, but the customer will ask for it.
              </p>
            </div>
          </div>
        )}

        {isCancel && (
          <div className="space-y-3">
            <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Stock for every item is returned to the sellers, and any amount already paid (
                {formatPrice(order.pricing.total)}) is credited to the customer's Smart Deal wallet.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Reason</Label>
              <select
                id="cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <option value="">Choose a reason…</option>
                {CANCEL_REASONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-remarks">Note for the customer</Label>
              <Textarea
                id="cancel-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Anything else the customer should know"
                className="min-h-[76px] rounded-xl"
              />
            </div>
          </div>
        )}

        {!isShip && !isCancel && (
          <div className="space-y-3">
            {isRefund && (
              <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {formatPrice(order.pricing.total)} will be credited to the customer's Smart Deal
                  wallet.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="status-remarks">Note (optional)</Label>
              <Textarea
                id="status-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Shown on the customer's order timeline"
                className="min-h-[76px] rounded-xl"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={onCancel} disabled={busy}>
            Keep as {order.status}
          </Button>
          <Button
            className="rounded-xl font-semibold"
            variant={isCancel ? "destructive" : "default"}
            onClick={submit}
            disabled={busy}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCancel ? "Cancel order" : isShip ? "Mark shipped" : `Move to ${status}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Compact one-line order summary used by the returns queue. */
export function OrderSummaryLine({ order }: { order: Order }) {
  return (
    <span className="text-xs text-muted-foreground">
      {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
      {formatPrice(order.pricing.total)} · {formatDate(order.createdAt)}
    </span>
  );
}
