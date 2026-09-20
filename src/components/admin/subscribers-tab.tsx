import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import {
  ConfirmDialog,
  DataTable,
  Note,
  SearchField,
  TabState,
  adminRetry,
} from "@/components/admin/people-shared";

interface Subscriber {
  _id: string;
  email: string;
  source?: string | undefined;
  isActive?: boolean | undefined;
  createdAt: string;
}

interface SubscribersResponse extends Paginated {
  subscribers: Subscriber[];
}

const EXPORT_LIMIT = 500;

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function SubscribersTab() {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);
  const search = useDebounce(term, 350);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const query = useQuery({
    queryKey: ["admin-subscribers", search, page],
    queryFn: () => api<SubscribersResponse>("/admin/subscribers", { query: { q: search, page } }),
    placeholderData: keepPreviousData,
    retry: adminRetry,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/subscribers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Subscriber removed");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      const rows: Subscriber[] = [];
      let current = 1;
      let pages = 1;
      do {
        const response = await api<SubscribersResponse>("/admin/subscribers", {
          query: { q: search, page: current, limit: EXPORT_LIMIT },
        });
        rows.push(...response.subscribers);
        pages = response.pages;
        current += 1;
      } while (current <= pages && current <= 50);
      return rows;
    },
    onSuccess: (rows) => {
      if (rows.length === 0) {
        toast.error("There's nothing to export yet");
        return;
      }
      const csv = [
        ["Email", "Source", "Status", "Subscribed"].map(csvCell).join(","),
        ...rows.map((row) =>
          [
            csvCell(row.email),
            csvCell(row.source ?? ""),
            csvCell(row.isActive === false ? "Unsubscribed" : "Subscribed"),
            csvCell(new Date(row.createdAt).toISOString()),
          ].join(","),
        ),
      ].join("\r\n");

      // Leading BOM so Excel opens the file as UTF-8.
      const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `smart-deal-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} subscriber${rows.length === 1 ? "" : "s"}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = query.data?.subscribers ?? [];

  return (
    <div className="space-y-4">
      <SectionCard
        title="Newsletter subscribers"
        description="Everyone who signed up through the storefront footer or a campaign form."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              value={term}
              onChange={setTerm}
              placeholder="Search by email"
              label="Search subscribers"
            />
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={exportCsv.isPending}
              onClick={() => exportCsv.mutate()}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {exportCsv.isPending ? "Preparing…" : "Export CSV"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TabState
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={Mail}
                title={search ? "No subscribers match that search" : "No subscribers yet"}
                description={
                  search
                    ? "Try a different email fragment."
                    : "Sign-ups from the storefront newsletter band land here automatically."
                }
              />
            ) : (
              <DataTable
                rows={rows}
                rowKey={(row) => row._id}
                columns={[
                  {
                    key: "email",
                    header: "Email",
                    cell: (row) => <span className="font-semibold break-all">{row.email}</span>,
                  },
                  {
                    key: "source",
                    header: "Source",
                    cell: (row) => (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">
                        {row.source || "footer"}
                      </span>
                    ),
                  },
                  {
                    key: "date",
                    header: "Subscribed",
                    className: "whitespace-nowrap",
                    cell: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    header: <span className="sr-only">Actions</span>,
                    className: "text-right",
                    cell: (row) => (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-destructive"
                        aria-label={`Remove ${row.email}`}
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ),
                  },
                ]}
                card={(row) => (
                  <div className="space-y-1.5">
                    <p className="font-semibold break-all">{row.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.source || "footer"} · {formatDateTime(row.createdAt)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-destructive"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                )}
              />
            )}
          </TabState>

          {query.data && query.data.pages > 1 && (
            <PaginationBar page={query.data.page} pages={query.data.pages} onChange={setPage} />
          )}

          <Note>
            The export matches your current search and downloads straight from the browser — nothing
            is emailed or stored elsewhere. Handle the list in line with your marketing consent
            policy.
          </Note>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this subscriber?"
        confirmLabel="Remove"
        pending={remove.isPending}
        description={
          <p>
            <strong className="text-foreground break-all">{deleteTarget?.email}</strong> will stop
            receiving Smart Deal campaigns and disappears from future exports. They can sign up
            again from the storefront.
          </p>
        }
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget._id)}
      />
    </div>
  );
}
