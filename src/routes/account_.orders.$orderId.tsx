import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Headphones,
  Loader2,
  MapPin,
  Package,
  Printer,
  RefreshCw,
  Repeat2,
  Star,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { OrderInvoice } from "@/components/account/order-invoice";
import {
  RefundChoice,
  RefundList,
  blankRefundChoice,
  refundChoiceBody,
  refundChoiceError,
  type RefundChoiceValue,
} from "@/components/account/refund-choice";
import { OrderProgress } from "@/components/account/order-progress";
import { ReviewDialog } from "@/components/account/review-dialog";
import { InlineError, PageLoader } from "@/components/common/page-loader";
import { StatusBadge } from "@/components/common/status-badge";
import { Breadcrumbs, PageContainer, SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/context/store";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useSettings } from "@/hooks/use-settings";
import { api, errorMessage } from "@/lib/api";
import { CANCEL_REASONS, RETURN_REASONS } from "@/lib/constants";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { searchBoolean } from "@/lib/search-params";
import type { Order, OrderItem } from "@/lib/types";

export const Route = createFileRoute("/account_/orders/$orderId")({
  validateSearch: (search: Record<string, unknown>): { placed?: boolean | undefined } => ({
    placed: searchBoolean(search["placed"]),
  }),
  head: () => ({ meta: [{ title: "Order details | Smart Deal" }] }),
  component: OrderDetailPage,
});

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Package;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-base font-bold">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: "discount" }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "discount" ? "font-semibold text-success" : "font-semibold tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { placed } = Route.useSearch();
  const { ready, allowed } = useRequireAuth();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const { addToCart } = useStore();

  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
  const [cancelling, setCancelling] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState<string>(RETURN_REASONS[0]);
  const [returnComments, setReturnComments] = useState("");
  const [returning, setReturning] = useState(false);
  const [refundChoice, setRefundChoice] = useState<RefundChoiceValue>(blankRefundChoice());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api<{ order: Order }>(`/orders/${orderId}`),
    enabled: ready && allowed,
  });

  const order = data?.order;
  const refundOptions = order?.capabilities?.refundOptions ?? [];
  const paidInAdvance = order?.paymentDetails.status === "Paid";

  /** Opens a dialog with the default refund destination for this order selected. */
  function resetRefundChoice() {
    setRefundChoice(blankRefundChoice(refundOptions[0] ?? "wallet"));
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
  };

  async function cancelOrder() {
    if (!order) return;
    setCancelling(true);
    try {
      const refundError = paidInAdvance ? refundChoiceError(refundChoice) : null;
      if (refundError) {
        toast.error(refundError);
        return;
      }
      const response = await api<{ message: string }>(`/orders/${order._id}/cancel`, {
        method: "POST",
        body: { reason: cancelReason, ...(paidInAdvance ? refundChoiceBody(refundChoice) : {}) },
      });
      toast.success(response.message || "Your order has been cancelled");
      setCancelOpen(false);
      invalidate();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setCancelling(false);
    }
  }

  async function requestReturn() {
    if (!order) return;
    setReturning(true);
    try {
      const refundError = refundChoiceError(refundChoice);
      if (refundError) {
        toast.error(refundError);
        return;
      }
      const response = await api<{ message: string }>(`/orders/${order._id}/return`, {
        method: "POST",
        body: {
          reason: returnReason,
          ...(returnComments.trim() ? { comments: returnComments.trim() } : {}),
          ...refundChoiceBody(refundChoice),
        },
      });
      toast.success(response.message || "Return requested");
      setReturnOpen(false);
      setReturnComments("");
      invalidate();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setReturning(false);
    }
  }

  if (!ready || !allowed) {
    return (
      <SiteLayout>
        <PageLoader />
      </SiteLayout>
    );
  }

  if (isLoading) {
    return (
      <SiteLayout>
        <PageContainer className="space-y-4 py-6 lg:py-10">
          <Skeleton className="h-4 w-56 rounded" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </PageContainer>
      </SiteLayout>
    );
  }

  if (isError || !order) {
    return (
      <SiteLayout>
        <PageContainer className="py-10">
          <InlineError message="We couldn't load this order." onRetry={() => void refetch()} />
          <div className="mt-4 text-center">
            <Button asChild variant="outline" className="rounded-xl font-semibold">
              <Link to="/account" search={{ tab: "orders" }}>
                Back to my orders
              </Link>
            </Button>
          </div>
        </PageContainer>
      </SiteLayout>
    );
  }

  const caps = order.capabilities;
  const { pricing } = order;
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);
  const returnableIds = new Set(caps?.returnableItemIds ?? []);
  const keptItems = order.items.filter(
    (item) => item.status === "Delivered" && !returnableIds.has(item._id),
  );

  return (
    <SiteLayout>
      <PageContainer className="py-6 lg:py-10">
        <div className="print:hidden">
          <Breadcrumbs>
            {[
              <Link key="home" to="/">
                Home
              </Link>,
              <Link key="account" to="/account" search={{ tab: "orders" }}>
                My orders
              </Link>,
              order.orderId,
            ]}
          </Breadcrumbs>

          {placed && (
            <div className="mt-5 rounded-2xl border border-success/30 bg-success/8 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="font-display text-lg font-extrabold">
                    Thank you — your order is confirmed
                  </h1>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Order <span className="font-bold text-foreground">{order.orderId}</span> is on
                    its way.{" "}
                    {order.shippingMethod?.eta
                      ? `Estimated delivery: ${order.shippingMethod.eta}.`
                      : "We'll email you as soon as it ships."}{" "}
                    A confirmation has been sent to your email.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
                    {order.orderId}
                  </h1>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Placed {formatDateTime(order.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    {order.paymentDetails.method}
                    {order.paymentDetails.cardLast4
                      ? ` ••••${order.paymentDetails.cardLast4}`
                      : ""}{" "}
                    · {order.paymentDetails.status}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    {units} item{units === 1 ? "" : "s"}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-10 rounded-xl font-semibold"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Print invoice
                </Button>
                <Button asChild variant="outline" className="h-10 rounded-xl font-semibold">
                  <Link to="/account" search={{ tab: "support" }}>
                    <Headphones className="h-4 w-4" />
                    Need help?
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <div className="mt-4">
            <OrderProgress order={order} />
          </div>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* Left column */}
            <div className="space-y-4">
              <Card title="Items in this order" icon={Package}>
                <ul className="divide-y divide-border">
                  {order.items.map((item) => {
                    const canReview =
                      Boolean(caps?.canReview) &&
                      !(caps?.reviewedProductIds ?? []).includes(item.product);
                    const reviewed = (caps?.reviewedProductIds ?? []).includes(item.product);
                    return (
                      <li key={item._id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <p className="min-w-0 flex-1 text-sm font-semibold">{item.title}</p>
                            <StatusBadge status={item.status} />
                          </div>
                          {item.variantLabel && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.variantLabel}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Qty {item.qty} × {formatPrice(item.price)} ={" "}
                            <span className="font-semibold text-foreground">
                              {formatPrice(item.price * item.qty)}
                            </span>
                          </p>

                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {canReview && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-xl text-xs font-semibold"
                                onClick={() => setReviewItem(item)}
                              >
                                <Star className="h-3.5 w-3.5" />
                                Write a review
                              </Button>
                            )}
                            {reviewed && (
                              <span className="inline-flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                <CheckCircle2 className="h-3 w-3" />
                                Reviewed
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl text-xs font-semibold"
                              onClick={() =>
                                void addToCart({
                                  productId: item.product,
                                  variantSku: item.variantSku,
                                  qty: item.qty,
                                  title: item.title,
                                })
                              }
                            >
                              <Repeat2 className="h-3.5 w-3.5" />
                              Buy again
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card title="Order timeline" icon={CalendarClock}>
                <ol className="space-y-0">
                  {order.statusTimeline.map((entry, index) => {
                    const last = index === order.statusTimeline.length - 1;
                    return (
                      <li key={entry._id ?? `${entry.status}-${index}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground" />
                          {!last && <span className="w-px flex-1 bg-border" />}
                        </div>
                        <div className={last ? "pb-0" : "pb-4"}>
                          <p className="text-sm font-semibold">{entry.status}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateTime(entry.updatedAt)}
                          </p>
                          {entry.remarks && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{entry.remarks}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>

              {(order.shippingDetails?.carrier ||
                order.shippingDetails?.trackingNumber ||
                order.shippingMethod) && (
                <Card title="Shipping" icon={Truck}>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Method</dt>
                      <dd className="text-sm font-semibold">
                        {order.shippingMethod?.label ?? "Standard delivery"}
                        {order.shippingMethod?.eta ? ` · ${order.shippingMethod.eta}` : ""}
                      </dd>
                    </div>
                    {order.shippingDetails?.carrier && (
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Carrier</dt>
                        <dd className="text-sm font-semibold">{order.shippingDetails.carrier}</dd>
                      </div>
                    )}
                    {order.shippingDetails?.trackingNumber && (
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Tracking number</dt>
                        <dd className="font-mono text-sm font-semibold">
                          {order.shippingDetails.trackingNumber}
                        </dd>
                      </div>
                    )}
                    {order.shippingDetails?.shippedAt && (
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Shipped</dt>
                        <dd className="text-sm font-semibold">
                          {formatDateTime(order.shippingDetails.shippedAt)}
                        </dd>
                      </div>
                    )}
                    {order.shippingDetails?.deliveredAt && (
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Delivered</dt>
                        <dd className="text-sm font-semibold">
                          {formatDateTime(order.shippingDetails.deliveredAt)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Card>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <Card title="Delivery address" icon={MapPin}>
                <address className="text-sm leading-relaxed not-italic">
                  <span className="font-semibold">{order.shippingAddress.receiverName}</span>
                  <br />
                  <span className="text-muted-foreground">
                    {order.shippingAddress.buildingDetails}
                    <br />
                    {order.shippingAddress.street}, {order.shippingAddress.area}
                    <br />
                    {order.shippingAddress.emirate}, United Arab Emirates
                    {order.shippingAddress.landmark && (
                      <>
                        <br />
                        Near {order.shippingAddress.landmark}
                      </>
                    )}
                  </span>
                  <br />
                  <span className="font-semibold">{order.shippingAddress.receiverPhone}</span>
                </address>

                {order.deliveryInstructions && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      Delivery instructions
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed">{order.deliveryInstructions}</p>
                  </div>
                )}
              </Card>

              <Card title="Payment summary" icon={CreditCard}>
                <dl className="space-y-2">
                  <SummaryRow label="Subtotal" value={formatPrice(pricing.subtotal)} />
                  {pricing.discount > 0 && (
                    <SummaryRow
                      label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
                      value={`− ${formatPrice(pricing.discount)}`}
                      tone="discount"
                    />
                  )}
                  <SummaryRow
                    label="Delivery"
                    value={pricing.shippingFee > 0 ? formatPrice(pricing.shippingFee) : "Free"}
                  />
                  {pricing.codFee > 0 && (
                    <SummaryRow label="Cash on delivery fee" value={formatPrice(pricing.codFee)} />
                  )}
                  <SummaryRow
                    label={`VAT (${pricing.vatRate}%)`}
                    value={formatPrice(pricing.vat)}
                  />
                  <div className="flex justify-between gap-3 border-t border-border pt-2.5">
                    <dt className="font-display text-sm font-bold">Total paid</dt>
                    <dd className="font-display text-lg font-extrabold tabular-nums">
                      {formatPrice(pricing.total)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Paid by {order.paymentDetails.method} · {order.paymentDetails.status}
                  {order.paymentDetails.paidAt
                    ? ` on ${formatDate(order.paymentDetails.paidAt)}`
                    : ""}
                </p>
              </Card>

              {(order.refunds?.length ?? 0) > 0 && (
                <Card title="Refunds" icon={RefreshCw}>
                  <RefundList refunds={order.refunds ?? []} />
                </Card>
              )}

              {(caps?.canCancel || caps?.canReturn) && (
                <Card title="Need to change something?" icon={RefreshCw}>
                  <div className="space-y-2">
                    {caps?.canCancel && (
                      <Button
                        variant="outline"
                        className="h-10 w-full rounded-xl font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          resetRefundChoice();
                          setCancelOpen(true);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel order
                      </Button>
                    )}
                    {caps?.canReturn && (
                      <>
                        <Button
                          variant="outline"
                          className="h-10 w-full rounded-xl font-semibold"
                          onClick={() => {
                            resetRefundChoice();
                            setReturnOpen(true);
                          }}
                        >
                          <Undo2 className="h-4 w-4" />
                          Request a return
                        </Button>
                        {caps.returnWindowEndsAt && (
                          <p className="text-[11px] text-muted-foreground">
                            Your return window closes on{" "}
                            <span className="font-semibold text-foreground">
                              {formatDate(caps.returnWindowEndsAt)}
                            </span>
                            .
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        <OrderInvoice order={order} settings={settings} />
      </PageContainer>

      <ReviewDialog
        item={reviewItem}
        onOpenChange={(open) => !open && setReviewItem(null)}
        onSubmitted={() => invalidate()}
      />

      {/* Cancel */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Cancel order {order.orderId}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The seller will be told to stop preparing your items.{" "}
              {paidInAdvance
                ? "Choose where the money you paid should go."
                : "Nothing has been charged yet, so there's nothing to refund."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {paidInAdvance && (
            <RefundChoice
              order={order}
              options={refundOptions}
              value={refundChoice}
              onChange={setRefundChoice}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Why are you cancelling?</Label>
            <select
              id="cancel-reason"
              className={selectClass}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            >
              {CANCEL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={cancelling}>
              Keep my order
            </AlertDialogCancel>
            <Button
              className="rounded-xl bg-destructive font-semibold text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void cancelOrder()}
              disabled={cancelling}
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              {cancelling ? "Cancelling…" : "Cancel order"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Request a return</DialogTitle>
            <DialogDescription>
              {caps?.returnWindowEndsAt
                ? `Returns for this order are open until ${formatDate(caps.returnWindowEndsAt)}. `
                : ""}
              Once approved, collection is arranged and your refund is sent where you choose below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {keptItems.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-xs leading-relaxed">
                <p className="font-semibold">These items are non-returnable and stay with you:</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {keptItems.map((item) => (
                    <li key={item._id}>{item.title}</li>
                  ))}
                </ul>
                <p className="mt-1 text-muted-foreground">
                  Your refund covers the other items, less their share of any coupon discount.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="return-reason">Reason for the return</Label>
              <select
                id="return-reason"
                className={selectClass}
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
              >
                {RETURN_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <RefundChoice
              order={order}
              options={refundOptions}
              value={refundChoice}
              onChange={setRefundChoice}
            />

            <div className="space-y-1.5">
              <Label htmlFor="return-comments">Anything else we should know? (optional)</Label>
              <Textarea
                id="return-comments"
                value={returnComments}
                onChange={(event) => setReturnComments(event.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Tell us what's wrong so we can resolve it faster."
                className="rounded-xl"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setReturnOpen(false)}
                disabled={returning}
              >
                Cancel
              </Button>
              <Button
                className="rounded-xl font-semibold"
                onClick={() => void requestReturn()}
                disabled={returning}
              >
                {returning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                {returning ? "Submitting…" : "Request return"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}
