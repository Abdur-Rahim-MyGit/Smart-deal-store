import { Fragment, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Note, SearchField, TabState, adminRetry } from "@/components/admin/people-shared";

interface AuditLog {
  _id: string;
  actor?: string | null | undefined;
  actorName?: string | undefined;
  action: string;
  entityType?: string | undefined;
  entityId?: string | undefined;
  summary?: string | undefined;
  meta?: unknown;
  ip?: string | undefined;
  createdAt: string;
}

interface AuditResponse extends Paginated {
  logs: AuditLog[];
}

const hasMeta = (meta: unknown): boolean =>
  Boolean(meta) &&
  typeof meta === "object" &&
  Object.keys(meta as Record<string, unknown>).length > 0;

export function AuditTab() {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const search = useDebounce(term, 350);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const query = useQuery({
    queryKey: ["admin-audit", search, page],
    queryFn: () => api<AuditResponse>("/admin/audit-logs", { query: { q: search, page } }),
    placeholderData: keepPreviousData,
    retry: adminRetry,
  });

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const logs = query.data?.logs ?? [];

  return (
    <SectionCard
      title="Audit log"
      description="Every administrative action, newest first. Entries can't be edited or removed."
      actions={
        <SearchField
          value={term}
          onChange={setTerm}
          placeholder="Action, summary or person"
          label="Search the audit log"
        />
      }
    >
      <div className="space-y-4">
        <TabState
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
        >
          {logs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={search ? "Nothing matches that search" : "No activity recorded yet"}
              description={
                search
                  ? "Try an action name such as “vendor.moderate” or a person's name."
                  : "Moderation, settings changes and staff edits all appear here as they happen."
              }
            />
          ) : (
            <>
              {/* Phone layout: one card per entry */}
              <ul className="space-y-2 md:hidden">
                {logs.map((log) => (
                  <li
                    key={log._id}
                    className="rounded-2xl border border-border bg-card p-3.5 shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <code className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold">
                        {log.action}
                      </code>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs">{log.summary || "—"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {log.actorName || "System"} · {formatDateTime(log.createdAt)}
                    </p>
                    {hasMeta(log.meta) && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggle(log._id)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2"
                        >
                          {expanded.has(log._id) ? "Hide details" : "Show details"}
                        </button>
                        {expanded.has(log._id) && <MetaBlock meta={log.meta} entity={log} />}
                      </>
                    )}
                  </li>
                ))}
              </ul>

              <TableScroll className="hidden md:block">
                <thead>
                  <tr className="border-b border-border">
                    {["", "When", "Who", "Action", "Summary"].map((header, index) => (
                      <th
                        key={header || index}
                        scope="col"
                        className={cn(
                          "px-3 py-2 text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase whitespace-nowrap",
                          index === 0 && "w-8",
                        )}
                      >
                        {header || <span className="sr-only">Expand</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const open = expanded.has(log._id);
                    const detailed = hasMeta(log.meta);
                    return (
                      <Fragment key={log._id}>
                        <tr className="border-b border-border/60">
                          <td className="px-3 py-2.5 align-top">
                            {detailed ? (
                              <button
                                type="button"
                                onClick={() => toggle(log._id)}
                                aria-expanded={open}
                                aria-label={open ? "Hide details" : "Show details"}
                                className="rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                              >
                                {open ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">
                            <p className="text-xs font-semibold">{formatDateTime(log.createdAt)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {timeAgo(log.createdAt)}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <p className="text-xs font-semibold">{log.actorName || "System"}</p>
                            {log.ip && (
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {log.ip}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <code className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                              {log.action}
                            </code>
                          </td>
                          <td className="px-3 py-2.5 align-top text-xs">{log.summary || "—"}</td>
                        </tr>
                        {open && detailed && (
                          <tr className="border-b border-border/60 bg-muted/30">
                            <td />
                            <td colSpan={4} className="px-3 pb-3">
                              <MetaBlock meta={log.meta} entity={log} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </TableScroll>
            </>
          )}
        </TabState>

        {query.data && query.data.pages > 1 && (
          <PaginationBar page={query.data.page} pages={query.data.pages} onChange={setPage} />
        )}
        {query.data && (
          <p className="text-center text-[11px] text-muted-foreground">
            {query.data.total} entries recorded
          </p>
        )}

        <Note>
          The log is append-only. Entries keep the actor, their IP and any extra context recorded
          with the action.
        </Note>
      </div>
    </SectionCard>
  );
}

function MetaBlock({ meta, entity }: { meta: unknown; entity: AuditLog }) {
  return (
    <div className="mt-2 space-y-1.5 rounded-xl border border-border bg-background p-3">
      {entity.entityType && (
        <p className="text-[11px] text-muted-foreground">
          {entity.entityType}
          {entity.entityId && <span className="ml-1 font-mono">{entity.entityId}</span>}
        </p>
      )}
      <pre className="overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {JSON.stringify(meta, null, 2)}
      </pre>
    </div>
  );
}
