import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Archive, Inbox, Mail, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ConfirmDialog,
  FilterChips,
  Note,
  SELECT_CLASS,
  TabState,
  TableSkeleton,
  adminRetry,
  useStatusParam,
} from "@/components/admin/people-shared";

type MessageStatus = "New" | "Read" | "Replied" | "Archived";

interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  phone?: string | undefined;
  subject: string;
  message: string;
  status: MessageStatus;
  createdAt: string;
}

interface MessagesResponse extends Paginated {
  messages: ContactMessage[];
  statusCounts?: Record<string, number> | undefined;
}

const STATUSES: MessageStatus[] = ["New", "Read", "Replied", "Archived"];

export function MessagesTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useStatusParam();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);
  const autoRead = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
  }, [status]);

  const query = useQuery({
    queryKey: ["admin-messages", status ?? "", page],
    queryFn: () =>
      api<MessagesResponse>("/admin/messages", { query: { status: status ?? "", page } }),
    placeholderData: keepPreviousData,
    retry: adminRetry,
  });

  const messages = query.data?.messages ?? [];
  // Keep showing an open message even after a status change moves it out of the filtered
  // list (e.g. opening one in "New" marks it Read).
  const openMessage = useRef<ContactMessage | null>(null);
  const listed = messages.find((entry) => entry._id === selectedId) ?? null;
  if (listed) openMessage.current = listed;
  const selected =
    listed ?? (selectedId && openMessage.current?._id === selectedId ? openMessage.current : null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }

  const setMessageStatus = useMutation({
    mutationFn: (input: { id: string; status: MessageStatus }) =>
      api<{ message: string }>(`/admin/messages/${input.id}`, {
        method: "PUT",
        body: { status: input.status },
      }),
    onSuccess: (_response, input) => {
      if (openMessage.current?._id === input.id)
        openMessage.current = { ...openMessage.current, status: input.status };
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Message deleted");
      setDeleteTarget(null);
      setSelectedId(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  /** Opening a new message marks it read, exactly once. */
  useEffect(() => {
    if (!selected || selected.status !== "New" || autoRead.current.has(selected._id)) return;
    autoRead.current.add(selected._id);
    setMessageStatus.mutate({ id: selected._id, status: "Read" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?._id, selected?.status]);

  const counts = query.data?.statusCounts ?? {};
  const chips = [
    { value: "", label: "All messages" },
    ...STATUSES.map((entry) => ({ value: entry, label: entry, count: counts[entry] ?? 0 })),
  ];

  function changeStatus(next: MessageStatus) {
    if (!selected) return;
    setMessageStatus.mutate(
      { id: selected._id, status: next },
      { onSuccess: () => toast.success(`Marked as ${next.toLowerCase()}`) },
    );
  }

  const mailto = selected
    ? `mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}&body=${encodeURIComponent(
        `Hi ${selected.name.split(" ")[0] ?? selected.name},\n\nThanks for getting in touch with Smart Deal.\n\n`,
      )}`
    : "#";

  return (
    <div className="space-y-4">
      <SectionCard
        title="Contact inbox"
        description="Messages sent through the storefront contact form."
      >
        <div className="space-y-4">
          <FilterChips
            options={chips}
            value={status ?? ""}
            onChange={(value) => setStatus(value || undefined)}
          />

          <TabState
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            skeleton={<TableSkeleton rows={5} columns={3} />}
          >
            {messages.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nothing in this view"
                description="New enquiries from the contact page land here."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                <ul className={cn("space-y-2", selected && "hidden lg:block")}>
                  {messages.map((entry) => (
                    <li key={entry._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(entry._id)}
                        aria-current={entry._id === selectedId ? "true" : undefined}
                        className={cn(
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          entry._id === selectedId
                            ? "border-foreground bg-accent"
                            : "border-border bg-card hover:border-foreground/25",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "min-w-0 truncate text-sm",
                              entry.status === "New" ? "font-bold" : "font-semibold",
                            )}
                          >
                            {entry.name}
                          </p>
                          <StatusBadge status={entry.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs font-medium">{entry.subject}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                          {entry.message}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {timeAgo(entry.createdAt)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className={cn("min-w-0", !selected && "hidden lg:block")}>
                  {selected ? (
                    <article className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg lg:hidden"
                        onClick={() => setSelectedId(null)}
                      >
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to inbox
                      </Button>

                      <header className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-bold">{selected.subject}</h3>
                          <StatusBadge status={selected.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selected.name} ·{" "}
                          <a
                            href={`mailto:${selected.email}`}
                            className="underline underline-offset-2"
                          >
                            {selected.email}
                          </a>
                          {selected.phone && (
                            <>
                              {" · "}
                              <a
                                href={`tel:${selected.phone}`}
                                className="underline underline-offset-2"
                              >
                                {selected.phone}
                              </a>
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Received {formatDateTime(selected.createdAt)}
                        </p>
                      </header>

                      <p className="rounded-xl bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                        {selected.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild className="rounded-xl">
                          <a href={mailto}>
                            <Reply className="mr-1.5 h-4 w-4" /> Reply by email
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={setMessageStatus.isPending || selected.status === "Replied"}
                          onClick={() => changeStatus("Replied")}
                        >
                          <Mail className="mr-1.5 h-4 w-4" /> Mark replied
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={setMessageStatus.isPending || selected.status === "Archived"}
                          onClick={() => changeStatus("Archived")}
                        >
                          <Archive className="mr-1.5 h-4 w-4" /> Archive
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl text-destructive"
                          onClick={() => setDeleteTarget(selected)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        <label htmlFor="message-status" className="text-xs font-bold">
                          Status
                        </label>
                        <select
                          id="message-status"
                          className={cn(SELECT_CLASS, "w-40")}
                          value={selected.status}
                          disabled={setMessageStatus.isPending}
                          onChange={(event) => changeStatus(event.target.value as MessageStatus)}
                        >
                          {STATUSES.map((entry) => (
                            <option key={entry} value={entry}>
                              {entry}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-muted-foreground">
                          Opening a new message marks it as read automatically.
                        </span>
                      </div>
                    </article>
                  ) : (
                    <div className="grid h-full min-h-56 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Pick a message on the left to read it in full.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabState>

          {query.data && query.data.pages > 1 && (
            <PaginationBar page={query.data.page} pages={query.data.pages} onChange={setPage} />
          )}

          <Note>
            Replies go out from your own mail client — Smart Deal doesn't send them. Mark a message
            as replied once you've answered so the rest of the team knows it's handled.
          </Note>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this message?"
        confirmLabel="Delete message"
        pending={remove.isPending}
        description={
          <>
            <p>
              The enquiry from <strong className="text-foreground">{deleteTarget?.name}</strong> is
              removed permanently and can't be recovered.
            </p>
            <p>Archive it instead if you only want it out of the way.</p>
          </>
        }
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget._id)}
      />
    </div>
  );
}
