import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CircleSlash, PauseCircle, Percent, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Paginated, VendorStatus } from "@/lib/types";
import {
  ConfirmDialog,
  DataTable,
  Field,
  FilterChips,
  Note,
  SearchField,
  TabState,
  adminRetry,
  numberField,
  useStatusParam,
} from "@/components/admin/people-shared";
import {
  SellerPerformance,
  UserDetailDialog,
  type AdminUserDetail,
  type AdminUserRow,
} from "@/components/admin/people-user-dialog";
import { AccountActions } from "@/components/admin/account-actions";

interface VendorsResponse extends Paginated {
  users: AdminUserRow[];
  statusCounts?: Record<string, number> | undefined;
}

const VENDOR_STATUSES: VendorStatus[] = ["Pending Review", "Active", "Rejected", "Suspended"];

type PendingAction = {
  kind: "approve" | "reject" | "suspend";
  id: string;
  name: string;
  status: VendorStatus;
};

export function VendorsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useStatusParam();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(term, 350);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const query = useQuery({
    queryKey: ["admin-vendors", search, status ?? "", page],
    queryFn: () =>
      api<VendorsResponse>("/admin/vendors", {
        query: { q: search, vendorStatus: status ?? "", page },
      }),
    placeholderData: keepPreviousData,
    retry: adminRetry,
  });

  function refreshLists() {
    void queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-user"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  const moderate = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      api<{ message: string }>(`/admin/vendors/${input.id}`, { method: "PUT", body: input.body }),
    onSuccess: (response) => {
      toast.success(response.message || "Seller updated");
      setAction(null);
      setReason("");
      refreshLists();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const counts = query.data?.statusCounts ?? {};
  const chips = [
    { value: "", label: "All sellers" },
    ...VENDOR_STATUSES.map((entry) => ({ value: entry, label: entry, count: counts[entry] ?? 0 })),
  ];

  function confirmAction() {
    if (!action) return;
    if (action.kind === "approve") {
      moderate.mutate({ id: action.id, body: { status: "Active" } });
      return;
    }
    if (!reason.trim()) {
      toast.error("Add a reason — the seller sees it on their dashboard");
      return;
    }
    moderate.mutate({
      id: action.id,
      body: {
        status: action.kind === "reject" ? "Rejected" : "Suspended",
        rejectionReason: reason.trim(),
      },
    });
  }

  const rows = query.data?.users ?? [];

  return (
    <div className="space-y-4">
      <SectionCard
        title="Sellers"
        description="Approve applications, set commission and suspend stores that break the rules."
        actions={
          <SearchField
            value={term}
            onChange={setTerm}
            placeholder="Business, owner or email"
            label="Search sellers"
          />
        }
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
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={Store}
                title="No sellers match these filters"
                description="Try another search term or pick a different status."
              />
            ) : (
              <DataTable
                rows={rows}
                rowKey={(row) => row._id}
                onRowClick={(row) => {
                  setSelectedId(row._id);
                  setDetailOpen(true);
                }}
                columns={[
                  {
                    key: "business",
                    header: "Store",
                    cell: (row) => (
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {row.vendorDetails?.businessName || row.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                    ),
                  },
                  {
                    key: "owner",
                    header: "Owner",
                    cell: (row) => (
                      <span className="text-xs text-muted-foreground">{row.name}</span>
                    ),
                  },
                  {
                    key: "products",
                    header: "Products",
                    className: "text-right tabular-nums",
                    cell: (row) => (
                      <span>
                        {row.stats?.products ?? 0}
                        <span className="text-muted-foreground">
                          {" "}
                          / {row.stats?.activeProducts ?? 0} live
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "sales",
                    header: "Gross sales",
                    className: "text-right tabular-nums",
                    cell: (row) => (
                      <span className="font-semibold">{formatPrice(row.stats?.sales ?? 0)}</span>
                    ),
                  },
                  {
                    key: "performance",
                    header: "Last 90 days",
                    cell: (row) => <SellerPerformance value={row.stats?.performance} />,
                  },
                  {
                    key: "commission",
                    header: "Commission",
                    className: "text-right tabular-nums",
                    cell: (row) =>
                      row.vendorDetails?.commissionRateOverride === undefined ? (
                        <span className="text-xs text-muted-foreground">Category default</span>
                      ) : (
                        <span className="font-semibold">
                          {row.vendorDetails.commissionRateOverride}%
                        </span>
                      ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => (
                      <StatusBadge status={row.vendorDetails?.status ?? "Pending Review"} />
                    ),
                  },
                ]}
                card={(row) => (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {row.vendorDetails?.businessName || row.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                      <StatusBadge status={row.vendorDetails?.status ?? "Pending Review"} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Products</p>
                        <p className="font-semibold tabular-nums">
                          {row.stats?.products ?? 0} / {row.stats?.activeProducts ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Sales</p>
                        <p className="font-semibold tabular-nums">
                          {formatPrice(row.stats?.sales ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Commission</p>
                        <p className="font-semibold tabular-nums">
                          {row.vendorDetails?.commissionRateOverride === undefined
                            ? "Default"
                            : `${row.vendorDetails.commissionRateOverride}%`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              />
            )}
          </TabState>

          {query.data && query.data.pages > 1 && (
            <PaginationBar page={query.data.page} pages={query.data.pages} onChange={setPage} />
          )}

          <Note>
            Suspending a store also hides every live product it sells; reactivating puts those
            products back on sale. Rejections and suspensions need a reason, which the seller reads
            on their dashboard.
          </Note>
        </div>
      </SectionCard>

      <UserDetailDialog
        userId={selectedId}
        mode="vendor"
        open={detailOpen}
        onOpenChange={setDetailOpen}
        actions={(detail) => (
          <>
            <AccountActions detail={detail} mode="vendor" />
            <VendorActions
              key={detail.user._id}
              detail={detail}
              pending={moderate.isPending}
              onCommission={(value) =>
                moderate.mutate({ id: detail.user._id, body: { commissionRateOverride: value } })
              }
              onAction={(kind) =>
                setAction({
                  kind,
                  id: detail.user._id,
                  name: detail.user.vendorDetails?.businessName || detail.user.name,
                  status: detail.user.vendorDetails?.status ?? "Pending Review",
                })
              }
            />
          </>
        )}
      />

      <ConfirmDialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setReason("");
          }
        }}
        pending={moderate.isPending}
        destructive={action?.kind !== "approve"}
        confirmLabel={
          action?.kind === "approve"
            ? action.status === "Pending Review"
              ? "Approve store"
              : "Reactivate store"
            : action?.kind === "reject"
              ? "Reject application"
              : "Suspend store"
        }
        title={
          action?.kind === "approve"
            ? action.status === "Pending Review"
              ? "Approve this seller?"
              : "Reactivate this store?"
            : action?.kind === "reject"
              ? "Reject this application?"
              : "Suspend this store?"
        }
        description={
          action?.kind === "approve" ? (
            <>
              <p>
                <strong className="text-foreground">{action.name}</strong> will be able to list
                products and take orders, and we'll send them a notification.
              </p>
              {action.status === "Suspended" && (
                <p>Products hidden by the suspension go back on sale immediately.</p>
              )}
            </>
          ) : action?.kind === "reject" ? (
            <p>
              <strong className="text-foreground">{action.name}</strong> won't be able to sell on
              Smart Deal. They'll see the reason below on their dashboard and can fix it and
              reapply.
            </p>
          ) : (
            <>
              <p>
                Suspending <strong className="text-foreground">{action?.name}</strong> immediately
                hides every live product they sell, so customers can no longer buy from them.
              </p>
              <p>Reactivating the store later restores those products automatically.</p>
            </>
          )
        }
        onConfirm={confirmAction}
      >
        {action && action.kind !== "approve" && (
          <Field
            label={action.kind === "reject" ? "Reason for rejection" : "Reason for suspension"}
            htmlFor="vendor-reason"
            required
            hint="The seller reads this, so be specific about what needs to change."
          >
            <Textarea
              id="vendor-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                action.kind === "reject"
                  ? "e.g. The trade licence you uploaded has expired."
                  : "e.g. Repeated counterfeit listings reported by customers."
              }
              className="rounded-xl"
            />
          </Field>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** Footer controls for the seller detail dialog: commission override + status transitions. */
function VendorActions({
  detail,
  pending,
  onAction,
  onCommission,
}: {
  detail: AdminUserDetail;
  pending: boolean;
  onAction: (kind: "approve" | "reject" | "suspend") => void;
  onCommission: (value: number | null) => void;
}) {
  const current = detail.user.vendorDetails?.commissionRateOverride;
  const [rate, setRate] = useState(current === undefined ? "" : String(current));

  function save() {
    const trimmed = rate.trim();
    if (!trimmed) {
      onCommission(null);
      return;
    }
    const parsed = numberField(trimmed);
    if (parsed === undefined || parsed < 0 || parsed > 100) {
      toast.error("Commission must be between 0 and 100%");
      return;
    }
    onCommission(parsed);
  }

  const status = detail.user.vendorDetails?.status ?? "Pending Review";

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor="vendor-commission" className="text-xs font-bold">
          Commission override
        </Label>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="relative w-28">
            <Input
              id="vendor-commission"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={rate}
              placeholder="Default"
              onChange={(event) => setRate(event.target.value)}
              className="h-9 rounded-xl pr-8"
            />
            <Percent className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl"
            disabled={pending}
            onClick={save}
          >
            Save rate
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Clear the field to fall back to the category rate.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {status !== "Active" && (
          <Button
            type="button"
            className="rounded-xl"
            disabled={pending}
            onClick={() => onAction("approve")}
          >
            <BadgeCheck className="mr-1.5 h-4 w-4" />
            {status === "Pending Review" ? "Approve" : "Reactivate"}
          </Button>
        )}
        {status === "Pending Review" && (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl text-destructive"
            disabled={pending}
            onClick={() => onAction("reject")}
          >
            <CircleSlash className="mr-1.5 h-4 w-4" /> Reject
          </Button>
        )}
        {status === "Active" && (
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={pending}
            onClick={() => onAction("suspend")}
          >
            <PauseCircle className="mr-1.5 h-4 w-4" /> Suspend
          </Button>
        )}
      </div>
    </div>
  );
}
