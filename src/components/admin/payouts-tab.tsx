import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ban, Hourglass, Landmark, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import {
  ConfirmDialog,
  DataTable,
  Field,
  FilterChips,
  Note,
  TabState,
  adminRetry,
  maskAccount,
  useStatusParam,
} from "@/components/admin/people-shared";

type PayoutStatus = "Requested" | "Processing" | "Transferred" | "Declined";

interface AdminPayout {
  _id: string;
  vendor: {
    _id: string;
    name: string;
    email?: string | undefined;
    vendorDetails?: { businessName?: string | undefined } | undefined;
  } | null;
  amount: number;
  status: PayoutStatus;
  bankSnapshot?:
    | {
        bankName?: string | undefined;
        accountName?: string | undefined;
        accountNumber?: string | undefined;
        iban?: string | undefined;
      }
    | undefined;
  reference?: string | undefined;
  remarks?: string | undefined;
  processedBy?: { _id: string; name: string } | null | undefined;
  processedAt?: string | undefined;
  createdAt: string;
}

interface PayoutsResponse extends Paginated {
  payouts: AdminPayout[];
  statusCounts?: Record<string, { count: number; amount: number }> | undefined;
}

const STATUSES: PayoutStatus[] = ["Requested", "Processing", "Transferred", "Declined"];

/** Transitions the API accepts — everything else is rejected server-side. */
const TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  Requested: ["Processing", "Transferred", "Declined"],
  Processing: ["Transferred", "Declined"],
  Transferred: [],
  Declined: [],
};

const STATUS_ICON = {
  Requested: Hourglass,
  Processing: Wallet,
  Transferred: BadgeCheck,
  Declined: Ban,
} as const;

const storeName = (payout: AdminPayout) =>
  payout.vendor?.vendorDetails?.businessName || payout.vendor?.name || "Unknown seller";

export function PayoutsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useStatusParam();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{ payout: AdminPayout; next: PayoutStatus } | null>(null);
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    setPage(1);
  }, [status]);

  const query = useQuery({
    queryKey: ["admin-payouts", status ?? "", page],
    queryFn: () =>
      api<PayoutsResponse>("/admin/payouts", { query: { status: status ?? "", page } }),
    placeholderData: keepPreviousData,
    retry: adminRetry,
  });

  const update = useMutation({
    mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
      api<{ message: string }>(`/admin/payouts/${input.id}`, { method: "PUT", body: input.body }),
    onSuccess: (response) => {
      toast.success(response.message || "Payout updated");
      closeDialog();
      void queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function closeDialog() {
    setTarget(null);
    setReference("");
    setRemarks("");
  }

  function confirm() {
    if (!target) return;
    if (target.next === "Transferred" && !reference.trim()) {
      toast.error("Enter the bank transfer reference");
      return;
    }
    if (target.next === "Declined" && !remarks.trim()) {
      toast.error("Explain why the payout was declined — the seller sees this");
      return;
    }
    update.mutate({
      id: target.payout._id,
      body: {
        status: target.next,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      },
    });
  }

  const counts = query.data?.statusCounts ?? {};
  const chips = [
    { value: "", label: "All payouts" },
    ...STATUSES.map((entry) => ({ value: entry, label: entry, count: counts[entry]?.count ?? 0 })),
  ];

  const rows = query.data?.payouts ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((entry) => (
          <StatCard
            key={entry}
            label={entry}
            value={formatPrice(counts[entry]?.amount ?? 0)}
            hint={`${counts[entry]?.count ?? 0} payout${(counts[entry]?.count ?? 0) === 1 ? "" : "s"}`}
            icon={STATUS_ICON[entry]}
            tone={
              entry === "Transferred"
                ? "success"
                : entry === "Declined"
                  ? "danger"
                  : entry === "Requested"
                    ? "warning"
                    : "default"
            }
          />
        ))}
      </div>

      <SectionCard
        title="Seller payouts"
        description="Money sellers have asked to withdraw from their cleared earnings."
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
                icon={Landmark}
                title="No payouts here"
                description="Requests appear as soon as a seller withdraws from their available balance."
              />
            ) : (
              <DataTable
                rows={rows}
                rowKey={(row) => row._id}
                columns={[
                  {
                    key: "seller",
                    header: "Seller",
                    cell: (row) => (
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{storeName(row)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.vendor?.email ?? "—"}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    className: "text-right tabular-nums",
                    cell: (row) => <span className="font-semibold">{formatPrice(row.amount)}</span>,
                  },
                  {
                    key: "requested",
                    header: "Requested",
                    className: "whitespace-nowrap",
                    cell: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </span>
                    ),
                  },
                  {
                    key: "bank",
                    header: "Bank account",
                    cell: (row) => (
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold">
                          {row.bankSnapshot?.bankName || "Not on file"}
                        </p>
                        <p className="truncate font-mono text-muted-foreground">
                          {row.bankSnapshot?.iban || maskAccount(row.bankSnapshot?.accountNumber)}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => <StatusBadge status={row.status} />,
                  },
                  {
                    key: "reference",
                    header: "Reference",
                    cell: (row) => (
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.reference || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "processed",
                    header: "Processed",
                    cell: (row) =>
                      row.processedAt ? (
                        <div className="text-xs">
                          <p className="font-semibold">{row.processedBy?.name ?? "—"}</p>
                          <p className="text-muted-foreground">{formatDateTime(row.processedAt)}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      ),
                  },
                  {
                    key: "actions",
                    header: <span className="sr-only">Actions</span>,
                    className: "text-right",
                    cell: (row) => (
                      <PayoutActions
                        payout={row}
                        onPick={(next) => setTarget({ payout: row, next })}
                      />
                    ),
                  },
                ]}
                card={(row) => (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{storeName(row)}</p>
                        <p className="text-xs text-muted-foreground">
                          Requested {formatDate(row.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="font-display text-lg font-extrabold tabular-nums">
                      {formatPrice(row.amount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.bankSnapshot?.bankName || "No bank on file"} ·{" "}
                      <span className="font-mono">
                        {row.bankSnapshot?.iban || maskAccount(row.bankSnapshot?.accountNumber)}
                      </span>
                    </p>
                    {row.reference && (
                      <p className="text-[11px] text-muted-foreground">
                        Reference <span className="font-mono">{row.reference}</span>
                      </p>
                    )}
                    {row.remarks && <p className="text-[11px] text-destructive">{row.remarks}</p>}
                    <PayoutActions
                      payout={row}
                      onPick={(next) => setTarget({ payout: row, next })}
                    />
                  </div>
                )}
              />
            )}
          </TabState>

          {query.data && query.data.pages > 1 && (
            <PaginationBar page={query.data.page} pages={query.data.pages} onChange={setPage} />
          )}

          <Note>
            Mark a payout as processing while the bank transfer is in flight, then transferred once
            you have the bank reference. Transferred and declined payouts are final — the seller is
            notified either way.
          </Note>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && closeDialog()}
        pending={update.isPending}
        destructive={target?.next === "Declined"}
        title={
          target?.next === "Processing"
            ? "Mark this payout as processing?"
            : target?.next === "Transferred"
              ? "Confirm the bank transfer?"
              : "Decline this payout?"
        }
        confirmLabel={
          target?.next === "Processing"
            ? "Mark processing"
            : target?.next === "Transferred"
              ? "Mark transferred"
              : "Decline payout"
        }
        description={
          target?.next === "Processing" ? (
            <p>
              {storeName(target.payout)} is told their {formatPrice(target.payout.amount)} payout is
              on its way. You can still transfer or decline it afterwards.
            </p>
          ) : target?.next === "Transferred" ? (
            <>
              <p>
                This records {formatPrice(target.payout.amount)} as paid to{" "}
                {storeName(target.payout)} and can't be reversed from the console.
              </p>
              <p>Make the bank transfer first, then enter its reference below.</p>
            </>
          ) : (
            <p>
              Declining releases {formatPrice(target?.payout.amount ?? 0)} back into{" "}
              {target ? storeName(target.payout) : "the seller"}'s available balance and closes the
              request. They'll see your remarks.
            </p>
          )
        }
        onConfirm={confirm}
      >
        {target?.next === "Transferred" && (
          <Field
            label="Bank transfer reference"
            htmlFor="payout-reference"
            required
            hint="Shown to the seller so they can match it against their statement."
          >
            <Input
              id="payout-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. FT26091600123"
              className="rounded-xl font-mono"
            />
          </Field>
        )}
        {target?.next === "Declined" && (
          <Field
            label="Remarks"
            htmlFor="payout-remarks"
            required
            hint="The seller reads this on their payouts page."
          >
            <Textarea
              id="payout-remarks"
              rows={3}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="e.g. The IBAN on file doesn't match the registered business name."
              className="rounded-xl"
            />
          </Field>
        )}
      </ConfirmDialog>
    </div>
  );
}

function PayoutActions({
  payout,
  onPick,
}: {
  payout: AdminPayout;
  onPick: (next: PayoutStatus) => void;
}) {
  const allowed = TRANSITIONS[payout.status];
  if (allowed.length === 0) {
    return <span className="text-xs text-muted-foreground">No further action</span>;
  }
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {allowed.map((next) => (
        <Button
          key={next}
          variant={next === "Declined" ? "outline" : next === "Transferred" ? "default" : "outline"}
          size="sm"
          className={next === "Declined" ? "rounded-lg text-destructive" : "rounded-lg"}
          onClick={() => onPick(next)}
        >
          {next === "Processing"
            ? "Processing"
            : next === "Transferred"
              ? "Transferred"
              : "Decline"}
        </Button>
      ))}
    </div>
  );
}
