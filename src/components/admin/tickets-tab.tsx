import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LifeBuoy, Loader2, Send, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { useDebounce } from "@/hooks/use-debounce";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, initials, timeAgo } from "@/lib/format";
import type { Paginated, Ticket, TicketMessage } from "@/lib/types";
import {
  CardsSkeleton,
  FilterChips,
  FilterField,
  FilterRow,
  ForbiddenState,
  SearchInput,
  type ChipOption,
} from "@/components/admin/ops-common";
import { isForbidden, opsRetry, selectClass } from "@/components/admin/ops-utils";
import { cn } from "@/lib/utils";

type TicketStatus = "New" | "Assigned" | "In Progress" | "Resolved" | "Closed";
type TicketPriority = "Low" | "Medium" | "High";

const STATUSES: TicketStatus[] = ["New", "Assigned", "In Progress", "Resolved", "Closed"];
const PRIORITIES: TicketPriority[] = ["High", "Medium", "Low"];

interface TicketsResponse extends Paginated {
  tickets: Ticket[];
  statusCounts: Record<string, number>;
}

const senderOf = (message: TicketMessage) =>
  typeof message.sender === "object" && message.sender ? message.sender : null;

export function TicketsTab() {
  const { user } = useStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const q = useDebounce(term, 350);
  const threadEnd = useRef<HTMLDivElement | null>(null);

  const list = useQuery({
    queryKey: ["admin-tickets", { status, priority, q, page }],
    queryFn: () =>
      api<TicketsResponse>("/tickets", { query: { status, priority, q, page, limit: 20 } }),
    placeholderData: keepPreviousData,
    retry: opsRetry,
  });

  const tickets = useMemo(() => list.data?.tickets ?? [], [list.data]);

  const detail = useQuery({
    queryKey: ["admin-ticket", selectedId],
    queryFn: () =>
      api<{ ticket: Ticket }>(`/tickets/${selectedId}`).then((response) => response.ticket),
    enabled: Boolean(selectedId),
    retry: opsRetry,
  });

  const ticket = detail.data ?? tickets.find((entry) => entry._id === selectedId) ?? null;

  // Support staff a ticket can be handed to.
  const agents = useQuery({
    queryKey: ["ticket-agents"],
    queryFn: () =>
      api<{ agents: Array<{ _id: string; name: string }> }>("/tickets/agents").then(
        (response) => response.agents,
      ),
    staleTime: 5 * 60 * 1000,
    retry: opsRetry,
  });

  // Open the first ticket automatically, but only where the list stays visible beside it.
  useEffect(() => {
    if (selectedId || !tickets[0]) return;
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) return;
    setSelectedId(tickets[0]._id);
  }, [tickets, selectedId]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "end" });
  }, [ticket?._id, ticket?.messages.length]);

  const send = useMutation({
    mutationFn: (message: string) =>
      api<{ ticket: Ticket }>(`/tickets/${selectedId}/messages`, {
        method: "POST",
        body: { message },
      }),
    onSuccess: () => {
      setReply("");
      void detail.refetch();
      void list.refetch();
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: (body: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignToMe?: boolean;
      assignedAgent?: string | null;
    }) =>
      api<{ message: string; ticket: Ticket }>(`/tickets/${selectedId}`, { method: "PUT", body }),
    onSuccess: (response) => {
      toast.success(response.message);
      void detail.refetch();
      void list.refetch();
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const counts = useMemo(() => list.data?.statusCounts ?? {}, [list.data]);
  const total = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts],
  );

  const chips: ChipOption[] = [
    { value: "", label: "All", count: total },
    ...STATUSES.filter((entry) => counts[entry]).map((entry) => ({
      value: entry as string,
      label: entry as string,
      count: counts[entry],
    })),
  ];

  const filtersDirty = Boolean(status || priority || term);

  function withReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function resetFilters() {
    setStatus("");
    setPriority("");
    setTerm("");
    setPage(1);
  }

  if (isForbidden(list.error)) return <ForbiddenState section="support" />;

  const assignedToMe = Boolean(
    ticket?.assignedAgent && user && ticket.assignedAgent._id === user._id,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold">Support tickets</h2>
          <p className="text-xs text-muted-foreground">
            New tickets move to Assigned when someone takes them, and to In Progress once an agent
            replies. A customer reply reopens a resolved ticket.
          </p>
        </div>

        <FilterChips
          options={chips}
          value={status}
          onChange={withReset(setStatus)}
          ariaLabel="Filter by ticket status"
        />

        <FilterRow>
          <SearchInput
            value={term}
            onChange={withReset(setTerm)}
            placeholder="Ticket number or subject"
            label="Search tickets"
          />
          <FilterField label="Priority">
            <select
              aria-label="Priority"
              className={selectClass}
              value={priority}
              onChange={(event) => withReset(setPriority)(event.target.value)}
            >
              <option value="">Any priority</option>
              {PRIORITIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </FilterField>
          {filtersDirty && (
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </FilterRow>
      </div>

      {list.isError && !isForbidden(list.error) && (
        <InlineError message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      )}

      {list.isPending && <CardsSkeleton count={4} />}

      {list.data && tickets.length === 0 && (
        <EmptyState
          icon={LifeBuoy}
          title="No tickets match these filters"
          description="Try another status or priority."
          action={
            filtersDirty ? (
              <Button variant="outline" className="rounded-xl" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {tickets.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* Master list */}
          <div className={cn("space-y-3", selectedId && "hidden lg:block")}>
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto rounded-2xl border border-border bg-card p-2">
              {tickets.map((entry) => {
                const active = entry._id === selectedId;
                const last = entry.messages[entry.messages.length - 1];
                return (
                  <li key={entry._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(entry._id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-foreground bg-accent"
                          : "border-transparent hover:bg-accent/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                          {entry.ticketId}
                        </span>
                        <StatusBadge status={entry.status} />
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold">{entry.subject}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {entry.user?.name} · {entry.category}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <StatusBadge status={entry.priority} />
                        <span className="text-[11px] text-muted-foreground">
                          {last ? timeAgo(last.createdAt) : timeAgo(entry.createdAt)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <PaginationBar
              page={list.data?.page ?? page}
              pages={list.data?.pages ?? 1}
              onChange={setPage}
            />
          </div>

          {/* Detail */}
          <div className={cn(!selectedId && "hidden lg:block")}>
            {!ticket ? (
              <SectionCard>
                <EmptyState
                  icon={LifeBuoy}
                  title="Pick a ticket"
                  description="Choose a conversation on the left to read and reply."
                  className="py-12"
                />
              </SectionCard>
            ) : (
              <SectionCard
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg lg:hidden"
                      onClick={() => setSelectedId(null)}
                      aria-label="Back to the ticket list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="truncate">{ticket.subject}</span>
                  </span>
                }
                description={
                  <>
                    <span className="font-mono">{ticket.ticketId}</span> · {ticket.category} ·
                    opened {formatDateTime(ticket.createdAt)}
                    {ticket.order ? (
                      <>
                        {" · order "}
                        <span className="font-mono font-semibold">{ticket.order.orderId}</span>
                      </>
                    ) : null}
                  </>
                }
                bodyClassName="p-0"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Ticket status"
                      className={selectClass}
                      value={ticket.status}
                      disabled={update.isPending}
                      onChange={(event) =>
                        update.mutate({ status: event.target.value as TicketStatus })
                      }
                    >
                      {STATUSES.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Ticket priority"
                      className={selectClass}
                      value={ticket.priority}
                      disabled={update.isPending}
                      onChange={(event) =>
                        update.mutate({ priority: event.target.value as TicketPriority })
                      }
                    >
                      {PRIORITIES.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry} priority
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Assigned agent"
                      className={selectClass}
                      value={ticket.assignedAgent?._id ?? ""}
                      disabled={update.isPending || !agents.data}
                      onChange={(event) =>
                        update.mutate({ assignedAgent: event.target.value || null })
                      }
                    >
                      <option value="">Unassigned</option>
                      {(agents.data ?? []).map((agent) => (
                        <option key={agent._id} value={agent._id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant={assignedToMe ? "secondary" : "outline"}
                      className="rounded-xl font-semibold"
                      disabled={update.isPending || assignedToMe}
                      onClick={() => update.mutate({ assignToMe: true })}
                    >
                      <UserCheck className="mr-1.5 h-4 w-4" />
                      {assignedToMe
                        ? "Assigned to you"
                        : ticket.assignedAgent
                          ? "Take over"
                          : "Assign to me"}
                    </Button>
                  </div>
                }
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                  <span className="font-semibold text-foreground">{ticket.user?.name}</span>
                  <span>{ticket.user?.email}</span>
                  {ticket.assignedAgent && (
                    <span className="ml-auto">Agent: {ticket.assignedAgent.name}</span>
                  )}
                </div>

                <div className="max-h-[52vh] space-y-3 overflow-y-auto p-4 sm:p-5">
                  {ticket.messages.map((message) => {
                    const sender = senderOf(message);
                    const fromAgent = sender?.role === "Admin";
                    return (
                      <div
                        key={message._id}
                        className={cn("flex gap-2", fromAgent && "flex-row-reverse")}
                      >
                        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold">
                          {initials(sender?.name)}
                        </span>
                        <div className={cn("max-w-[80%] min-w-0", fromAgent && "text-right")}>
                          <div
                            className={cn(
                              "rounded-2xl px-3 py-2 text-sm whitespace-pre-line",
                              fromAgent
                                ? "rounded-tr-sm bg-primary text-primary-foreground"
                                : "rounded-tl-sm bg-muted text-foreground",
                            )}
                          >
                            {message.message}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {sender?.name ?? "Unknown"} · {formatDateTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEnd} />
                </div>

                <div className="border-t border-border p-4 sm:p-5">
                  {ticket.status === "Closed" ? (
                    <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                      This ticket is closed. Reopen it above if the customer still needs help.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey) &&
                            reply.trim()
                          ) {
                            event.preventDefault();
                            send.mutate(reply.trim());
                          }
                        }}
                        placeholder={`Reply to ${ticket.user?.name ?? "the customer"}…`}
                        aria-label="Reply to this ticket"
                        className="min-h-[92px] rounded-xl"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground">
                          The customer is notified by email and in-app.
                        </p>
                        <Button
                          className="rounded-xl font-semibold"
                          disabled={send.isPending || !reply.trim()}
                          onClick={() => send.mutate(reply.trim())}
                        >
                          {send.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-1.5 h-4 w-4" />
                          )}
                          Send reply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
