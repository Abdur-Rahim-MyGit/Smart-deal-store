import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Headphones, LifeBuoy, Loader2, MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import type { MyOrdersResponse } from "@/components/account/types";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api";
import { TICKET_CATEGORIES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Ticket, TicketMessage, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const PRIORITIES = ["Low", "Medium", "High"] as const;

interface TicketsResponse {
  tickets: Ticket[];
}

const senderOf = (message: TicketMessage) =>
  typeof message.sender === "string" ? null : message.sender;

export function SupportSection({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const ticketsQuery = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => api<TicketsResponse>("/tickets/my"),
  });

  const tickets = ticketsQuery.data?.tickets ?? [];
  const selected = tickets.find((ticket) => ticket._id === selectedId) ?? null;

  const refreshTickets = () => queryClient.invalidateQueries({ queryKey: ["my-tickets"] });

  if (selected) {
    return (
      <TicketThread
        ticket={selected}
        user={user}
        onBack={() => setSelectedId(null)}
        onReplied={() => void refreshTickets()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions about an order, a refund or your account? Our team usually replies within a
            few hours.
          </p>
        </div>
        <Button className="h-10 rounded-xl font-semibold" onClick={() => setComposerOpen(true)}>
          <MessageSquarePlus className="h-4 w-4" />
          New ticket
        </Button>
      </div>

      {ticketsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : ticketsQuery.isError ? (
        <InlineError
          message="We couldn't load your support tickets."
          onRetry={() => void ticketsQuery.refetch()}
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={Headphones}
          title="No support tickets"
          description="Open a ticket and our team will pick it up — you'll get a notification as soon as we reply."
          action={
            <Button className="rounded-xl font-semibold" onClick={() => setComposerOpen(true)}>
              Contact support
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket._id}>
              <button
                type="button"
                onClick={() => setSelectedId(ticket._id)}
                className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.ticketId} · {ticket.category}
                      {ticket.order ? ` · ${ticket.order.orderId}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusBadge status={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {ticket.messages[ticket.messages.length - 1]?.message ?? ""}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {ticket.messages.length} message{ticket.messages.length === 1 ? "" : "s"} ·
                  updated {formatDate(ticket.updatedAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <NewTicketDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onCreated={(ticket) => {
          void refreshTickets();
          setSelectedId(ticket._id);
        }}
      />
    </div>
  );
}

/* ---------------- ticket thread ---------------- */

function TicketThread({
  ticket,
  user,
  onBack,
  onReplied,
}: {
  ticket: Ticket;
  user: User;
  onBack: () => void;
  onReplied: () => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const closed = ticket.status === "Closed";

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api(`/tickets/${ticket._id}/messages`, {
        method: "POST",
        body: { message: reply.trim() },
      });
      setReply("");
      onReplied();
      toast.success("Reply sent");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All tickets
      </button>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold tracking-tight">{ticket.subject}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {ticket.ticketId} · {ticket.category}
              {ticket.order ? ` · order ${ticket.order.orderId}` : ""} · opened{" "}
              {formatDate(ticket.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        </div>

        {ticket.assignedAgent && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Headphones className="h-3.5 w-3.5" />
            Handled by {ticket.assignedAgent.name}
          </p>
        )}
      </div>

      <ul className="space-y-3">
        {ticket.messages.map((message) => {
          const sender = senderOf(message);
          const mine = sender ? sender._id === user._id : false;
          return (
            <li
              key={message._id}
              className={cn("flex flex-col", mine ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap sm:max-w-[75%]",
                  mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border bg-card text-card-foreground",
                )}
              >
                {message.message}
              </div>
              <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                {mine ? "You" : (sender?.name ?? "Smart Deal support")}
                {!mine && sender?.role === "Admin" ? " · Support" : ""} ·{" "}
                {formatDateTime(message.createdAt)}
              </p>
            </li>
          );
        })}
      </ul>

      {closed ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-5 text-center">
          <p className="text-sm font-semibold">This ticket is closed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            If you still need help, please open a new ticket and reference {ticket.ticketId}.
          </p>
        </div>
      ) : (
        <form
          onSubmit={send}
          className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <Label htmlFor="ticket-reply" className="text-sm font-semibold">
            Add a reply
          </Label>
          <Textarea
            id="ticket-reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Share any extra detail that helps us resolve this…"
            className="rounded-xl"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              className="h-10 rounded-xl font-semibold"
              disabled={sending || !reply.trim()}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------------- new ticket ---------------- */

interface ComposerErrors {
  subject?: string | undefined;
  message?: string | undefined;
}

function NewTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticket: Ticket) => void;
}) {
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0]);
  const [orderId, setOrderId] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Medium");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<ComposerErrors>({});
  const [saving, setSaving] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ["my-orders", "ticket-picker"],
    queryFn: () => api<MyOrdersResponse>("/orders/my", { query: { limit: 30 } }),
    enabled: open,
  });

  function reset() {
    setCategory(TICKET_CATEGORIES[0]);
    setOrderId("");
    setPriority("Medium");
    setSubject("");
    setMessage("");
    setErrors({});
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: ComposerErrors = {};
    if (subject.trim().length < 4) next.subject = "Add a short subject (4 characters or more)";
    if (message.trim().length < 10) next.message = "Describe the issue in at least 10 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const response = await api<{ ticket: Ticket; message: string }>("/tickets", {
        method: "POST",
        body: {
          subject: subject.trim(),
          category,
          priority,
          message: message.trim(),
          ...(orderId ? { orderId } : {}),
        },
      });
      toast.success(response.message || "Ticket created");
      onCreated(response.ticket);
      onOpenChange(false);
      reset();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Contact support</DialogTitle>
          <DialogDescription>
            Tell us what happened and we&apos;ll get back to you by email and in your notifications.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-category">Category</Label>
              <select
                id="ticket-category"
                className={selectClass}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {TICKET_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticket-priority">Priority</Label>
              <select
                id="ticket-priority"
                className={selectClass}
                value={priority}
                onChange={(event) => setPriority(event.target.value as (typeof PRIORITIES)[number])}
              >
                {PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-order">Related order (optional)</Label>
            <select
              id="ticket-order"
              className={selectClass}
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              disabled={ordersQuery.isLoading}
            >
              <option value="">Not about a specific order</option>
              {(ordersQuery.data?.orders ?? []).map((order) => (
                <option key={order._id} value={order._id}>
                  {order.orderId} — {formatDate(order.createdAt)} ({order.status})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                setErrors((current) => ({ ...current, subject: undefined }));
              }}
              maxLength={150}
              placeholder="e.g. Item missing from my delivery"
              aria-invalid={Boolean(errors.subject)}
              className="h-11 rounded-xl"
            />
            {errors.subject && (
              <p className="text-xs font-medium text-destructive">{errors.subject}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-message">How can we help?</Label>
            <Textarea
              id="ticket-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setErrors((current) => ({ ...current, message: undefined }));
              }}
              rows={5}
              maxLength={4000}
              placeholder="Include what you expected, what happened and any reference numbers."
              aria-invalid={Boolean(errors.message)}
              className="rounded-xl"
            />
            {errors.message && (
              <p className="text-xs font-medium text-destructive">{errors.message}</p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl font-semibold" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LifeBuoy className="h-4 w-4" />
              )}
              {saving ? "Sending…" : "Create ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
