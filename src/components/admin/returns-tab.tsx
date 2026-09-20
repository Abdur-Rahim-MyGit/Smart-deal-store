import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Loader2, PackageCheck, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import type { Order, Paginated } from "@/lib/types";
import { CardsSkeleton, ForbiddenState, Thumb } from "@/components/admin/ops-common";
import { isForbidden, opsRetry, useOpsInvalidate } from "@/components/admin/ops-utils";
import { OrderDetailPanel } from "@/components/admin/ops-order-detail";
import { refundMethodLabel } from "@/components/account/refund-choice";

interface OrdersResponse extends Paginated {
  orders: Order[];
  statusCounts: Record<string, number>;
}

const customerOf = (order: Order) =>
  typeof order.user === "object" && order.user ? order.user : null;

const fetchByStatus = (status: string, limit = 25, returnResolution?: string) =>
  api<OrdersResponse>("/admin/orders", { query: { status, limit, returnResolution } });

/** What the customer gets back: recorded when they ask, confirmed when approved. */
const refundOf = (order: Order) => order.returnDetails?.refundAmount ?? order.pricing.total;

/** Where the customer asked the refund to go (older requests default to the wallet). */
const destinationOf = (order: Order) => {
  const method = order.returnDetails?.refundMethod ?? "wallet";
  const iban = order.returnDetails?.bankAccount?.iban;
  return method === "bank" && iban
    ? `${refundMethodLabel(method)} to IBAN ending ${iban.slice(-4)}`
    : refundMethodLabel(method);
};

export function ReturnsTab() {
  const invalidate = useOpsInvalidate();
  const [approving, setApproving] = useState<Order | null>(null);
  const [declining, setDeclining] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [sending, setSending] = useState<{ order: Order; refundId: string } | null>(null);
  const [transferRef, setTransferRef] = useState("");

  const transfers = useQuery({
    queryKey: ["admin-returns", "bank-transfers"],
    queryFn: () =>
      api<OrdersResponse>("/admin/orders", { query: { refundStatus: "Processing", limit: 50 } }),
    retry: opsRetry,
  });

  const markSent = useMutation({
    mutationFn: (input: { orderId: string; refundId: string; reference: string }) =>
      api<{ message: string }>(`/admin/orders/${input.orderId}/refunds/${input.refundId}`, {
        method: "PUT",
        body: { reference: input.reference },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setSending(null);
      setTransferRef("");
      invalidate("admin-returns", "admin-orders", "admin-order", "admin-dashboard");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const queue = useQuery({
    queryKey: ["admin-returns", "queue"],
    queryFn: () => fetchByStatus("Return Requested", 50),
    retry: opsRetry,
  });

  const returned = useQuery({
    queryKey: ["admin-returns", "resolved", "Returned"],
    queryFn: () => fetchByStatus("Returned"),
    retry: opsRetry,
    enabled: !isForbidden(queue.error),
  });

  const refunded = useQuery({
    queryKey: ["admin-returns", "resolved", "Refunded"],
    queryFn: () => fetchByStatus("Refunded"),
    retry: opsRetry,
    enabled: !isForbidden(queue.error),
  });

  // Declined returns and partial ones (non-returnable items kept) leave the order delivered.
  const decidedDelivered = useQuery({
    queryKey: ["admin-returns", "resolved", "Delivered"],
    queryFn: () => fetchByStatus("Delivered", 25, "any"),
    retry: opsRetry,
    enabled: !isForbidden(queue.error),
  });

  const resolve = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      api<{ message: string }>(`/admin/orders/${id}/return`, {
        method: "PUT",
        body: approve ? { approve: true } : { approve: false, rejectReason: reason },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setApproving(null);
      setDeclining(null);
      setRejectReason("");
      invalidate("admin-returns", "admin-orders", "admin-order", "admin-dashboard");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (isForbidden(queue.error)) return <ForbiddenState section="orders" />;

  const pending = queue.data?.orders ?? [];
  const resolved = [
    ...(returned.data?.orders ?? []),
    ...(refunded.data?.orders ?? []),
    ...(decidedDelivered.data?.orders ?? []),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 20);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold">Returns</h2>
        <p className="text-xs text-muted-foreground">
          Approving a return restocks the returnable items and refunds them where the customer
          chose: their card, their wallet or a bank transfer. Non-returnable items stay with them.
        </p>
      </div>

      <SectionCard
        title={`Return requests${pending.length ? ` (${pending.length})` : ""}`}
        description="Customers waiting on a decision"
        bodyClassName="p-3 sm:p-4"
      >
        {queue.isPending && <CardsSkeleton count={3} />}

        {queue.isError && !isForbidden(queue.error) && (
          <InlineError message={errorMessage(queue.error)} onRetry={() => void queue.refetch()} />
        )}

        {queue.data && pending.length === 0 && (
          <EmptyState
            icon={PackageCheck}
            title="No return requests"
            description="When a customer asks to return a delivered order it lands here for review."
          />
        )}

        {pending.length > 0 && (
          <ul className="space-y-3">
            {pending.map((order) => (
              <li key={order._id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenOrderId(order._id)}
                        className="font-mono text-xs font-bold underline underline-offset-4"
                      >
                        {order.orderId}
                      </button>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold">
                      {customerOf(order)?.name ?? order.shippingAddress.receiverName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {customerOf(order)?.email ?? order.shippingAddress.receiverPhone} ·{" "}
                      {order.shippingAddress.emirate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-extrabold tabular-nums">
                      {formatPrice(refundOf(order))}
                    </p>
                    {refundOf(order) !== order.pricing.total && (
                      <p className="text-[11px] text-muted-foreground">
                        of {formatPrice(order.pricing.total)} · partial return
                      </p>
                    )}
                    <p className="text-[11px] font-semibold">To: {destinationOf(order)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Requested{" "}
                      {order.returnDetails?.requestedAt
                        ? formatDate(order.returnDetails.requestedAt)
                        : formatDate(order.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="font-semibold">
                    {order.returnDetails?.reason ?? "No reason given"}
                  </p>
                  {order.returnDetails?.comments && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order.returnDetails.comments}
                    </p>
                  )}
                </div>

                <ul className="mt-3 flex flex-wrap gap-2">
                  {order.items.map((item) => (
                    <li
                      key={item._id}
                      className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5"
                    >
                      <Thumb src={item.thumbnail} alt="" className="h-8 w-8" />
                      <span className="max-w-[180px] truncate text-xs font-medium">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">×{item.qty}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl font-semibold"
                    onClick={() => setApproving(order)}
                    disabled={resolve.isPending}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve return
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-semibold"
                    onClick={() => {
                      setRejectReason("");
                      setDeclining(order);
                    }}
                    disabled={resolve.isPending}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Decline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => setOpenOrderId(order._id)}
                  >
                    View order
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {(transfers.data?.orders.length ?? 0) > 0 && (
        <SectionCard
          title="Bank transfers to send"
          description="Refunds customers asked to receive by bank transfer. Mark each one sent with the bank's reference."
          bodyClassName="p-3 sm:p-4"
        >
          <ul className="space-y-2">
            {(transfers.data?.orders ?? []).flatMap((order) =>
              (order.refunds ?? [])
                .filter((refund) => refund.status === "Processing")
                .map((refund) => (
                  <li
                    key={refund._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                  >
                    <span className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setOpenOrderId(order._id)}
                        className="font-mono text-xs font-bold underline underline-offset-4"
                      >
                        {order.orderId}
                      </button>
                      <span className="block text-sm font-semibold">
                        {refund.bankAccount?.accountName ?? "—"}
                      </span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {refund.bankAccount?.iban ?? "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-display text-lg font-extrabold tabular-nums">
                        {formatPrice(refund.amount)}
                      </span>
                      <Button
                        size="sm"
                        className="rounded-xl"
                        onClick={() => {
                          setTransferRef("");
                          setSending({ order, refundId: refund._id });
                        }}
                      >
                        <Banknote className="mr-1.5 h-4 w-4" /> Mark as sent
                      </Button>
                    </span>
                  </li>
                )),
            )}
          </ul>
        </SectionCard>
      )}

      <Dialog open={Boolean(sending)} onOpenChange={(open) => !open && setSending(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark the bank transfer as sent</DialogTitle>
            <DialogDescription>
              The customer is emailed and texted the reference for {sending?.order.orderId}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="transfer-ref">Bank transfer reference</Label>
            <Input
              id="transfer-ref"
              value={transferRef}
              onChange={(event) => setTransferRef(event.target.value)}
              placeholder="e.g. FT24091812345"
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => setSending(null)}
              disabled={markSent.isPending}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl font-semibold"
              disabled={markSent.isPending || transferRef.trim().length < 3}
              onClick={() =>
                sending &&
                markSent.mutate({
                  orderId: sending.order._id,
                  refundId: sending.refundId,
                  reference: transferRef.trim(),
                })
              }
            >
              {markSent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark as sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SectionCard
        title="Recently resolved"
        description="Returned and refunded orders"
        bodyClassName="p-3 sm:p-4"
      >
        {(returned.isPending || refunded.isPending || decidedDelivered.isPending) && (
          <CardsSkeleton count={2} />
        )}

        {returned.isError && !isForbidden(returned.error) && (
          <InlineError
            message={errorMessage(returned.error)}
            onRetry={() => void returned.refetch()}
          />
        )}

        {!returned.isPending &&
          !refunded.isPending &&
          !decidedDelivered.isPending &&
          resolved.length === 0 && (
            <EmptyState
              icon={RotateCcw}
              title="Nothing resolved yet"
              description="Approved and declined returns appear here."
              className="py-10"
            />
          )}

        {resolved.length > 0 && (
          <TableScroll>
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="py-2 pr-3 font-bold">Order</th>
                <th className="py-2 pr-3 font-bold">Customer</th>
                <th className="py-2 pr-3 font-bold">Reason</th>
                <th className="py-2 pr-3 font-bold">Resolution</th>
                <th className="py-2 pr-3 text-right font-bold">Refunded</th>
                <th className="py-2 font-bold">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resolved.map((order) => (
                <tr
                  key={order._id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => setOpenOrderId(order._id)}
                >
                  <td className="py-2.5 pr-3">
                    <span className="block font-mono text-xs font-semibold">{order.orderId}</span>
                    <StatusBadge status={order.status} className="mt-0.5" />
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="block max-w-[160px] truncate font-medium">
                      {customerOf(order)?.name ?? order.shippingAddress.receiverName}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="block max-w-[220px] truncate text-xs">
                      {order.returnDetails?.reason ?? "—"}
                    </span>
                    {order.returnDetails?.rejectReason && (
                      <span className="block max-w-[220px] truncate text-[11px] text-destructive">
                        {order.returnDetails.rejectReason}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={order.returnDetails?.resolution ?? "—"} />
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                    {order.returnDetails?.resolution === "Approved"
                      ? formatPrice(refundOf(order))
                      : "—"}
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {formatDateTime(order.returnDetails?.resolvedAt ?? order.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </SectionCard>

      {/* Approve */}
      <AlertDialog open={Boolean(approving)} onOpenChange={(open) => !open && setApproving(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this return?</AlertDialogTitle>
            <AlertDialogDescription>
              The returnable items on {approving?.orderId} are added back to their sellers' stock,
              and {formatPrice(approving ? refundOf(approving) : 0)} goes to{" "}
              {approving ? (customerOf(approving)?.name ?? "the customer") : "the customer"} by{" "}
              {approving ? destinationOf(approving).toLowerCase() : "their chosen method"}
              {approving?.returnDetails?.refundMethod === "bank"
                ? " (you'll mark the transfer sent once it's made)"
                : ""}
              . Non-returnable items stay with the customer. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={resolve.isPending}>
              Keep reviewing
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl font-semibold"
              disabled={resolve.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (approving) resolve.mutate({ id: approving._id, approve: true });
              }}
            >
              {resolve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve and refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline */}
      <Dialog open={Boolean(declining)} onOpenChange={(open) => !open && setDeclining(null)}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Decline this return</DialogTitle>
            <DialogDescription>
              {declining?.orderId} goes back to Delivered and the customer is told why. Nothing is
              restocked or refunded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="return-reject">Reason (shown to the customer)</Label>
            <Textarea
              id="return-reject"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. The return window closed on 12 May, or the item shows signs of use."
              className="min-h-[96px] rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => setDeclining(null)}
              disabled={resolve.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-semibold"
              disabled={resolve.isPending || !rejectReason.trim()}
              onClick={() => {
                if (declining)
                  resolve.mutate({
                    id: declining._id,
                    approve: false,
                    reason: rejectReason.trim(),
                  });
              }}
            >
              {resolve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Decline return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderDetailPanel orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}
