import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ShieldCheck, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { useDebounce } from "@/hooks/use-debounce";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import {
  ConfirmDialog,
  DataTable,
  Field,
  FilterChips,
  FormDialog,
  Note,
  SearchField,
  TabState,
  adminRetry,
  numberField,
  useStatusParam,
} from "@/components/admin/people-shared";
import { UserDetailDialog, type AdminUserRow } from "@/components/admin/people-user-dialog";
import { AccountActions } from "@/components/admin/account-actions";

interface CustomersResponse extends Paginated {
  users: AdminUserRow[];
}

const STATUS_CHIPS = [
  { value: "", label: "All customers" },
  { value: "Active", label: "Active" },
  { value: "Blocked", label: "Blocked" },
  { value: "Deleted", label: "Deleted" },
];

export function CustomersTab() {
  const queryClient = useQueryClient();
  const { user: admin } = useStore();
  const canAdjustWallet = Boolean(admin?.isSuperAdmin || admin?.permissions?.includes("finance"));

  const [status, setStatus] = useStatusParam();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(term, 350);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{
    id: string;
    name: string;
    status: string;
  } | null>(null);
  const [walletTarget, setWalletTarget] = useState<{
    id: string;
    name: string;
    balance: number;
  } | null>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const query = useQuery({
    queryKey: ["admin-customers", search, status ?? "", page],
    queryFn: () =>
      api<CustomersResponse>("/admin/customers", {
        query: { q: search, status: status ?? "", page },
      }),
    placeholderData: keepPreviousData,
    retry: adminRetry,
  });

  function refreshLists() {
    void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-user"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: "Active" | "Blocked" }) =>
      api<{ message: string }>(`/admin/users/${input.id}/status`, {
        method: "PUT",
        body: { status: input.status },
      }),
    onSuccess: (response) => {
      toast.success(response.message || "Customer updated");
      setBlockTarget(null);
      refreshLists();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const walletMutation = useMutation({
    mutationFn: (input: { id: string; amount: number; reason: string }) =>
      api<{ message: string }>(`/admin/customers/${input.id}/wallet`, {
        method: "POST",
        body: { amount: input.amount, reason: input.reason },
      }),
    onSuccess: () => {
      toast.success("Wallet balance updated");
      setWalletTarget(null);
      setWalletAmount("");
      setWalletReason("");
      refreshLists();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openCustomer(row: AdminUserRow) {
    setSelectedId(row._id);
    setDetailOpen(true);
  }

  function submitWallet() {
    if (!walletTarget) return;
    const amount = numberField(walletAmount);
    if (amount === undefined || amount === 0) {
      toast.error("Enter a non-zero amount, using a minus sign to deduct");
      return;
    }
    if (!walletReason.trim()) {
      toast.error("Add a reason so the customer and the audit log both have context");
      return;
    }
    walletMutation.mutate({ id: walletTarget.id, amount, reason: walletReason.trim() });
  }

  const rows = query.data?.users ?? [];

  return (
    <div className="space-y-4">
      <SectionCard
        title="Customers"
        description="Every shopper account, their lifetime spend and wallet balance."
        actions={
          <SearchField
            value={term}
            onChange={setTerm}
            placeholder="Name, email or phone"
            label="Search customers"
          />
        }
      >
        <div className="space-y-4">
          <FilterChips
            options={STATUS_CHIPS}
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
                icon={Users}
                title="No customers match these filters"
                description="Try a different search term or clear the status filter."
              />
            ) : (
              <DataTable
                rows={rows}
                rowKey={(row) => row._id}
                onRowClick={openCustomer}
                columns={[
                  {
                    key: "name",
                    header: "Customer",
                    cell: (row) => (
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                    ),
                  },
                  {
                    key: "phone",
                    header: "Phone",
                    cell: (row) => (
                      <span className="text-xs text-muted-foreground">{row.phone || "—"}</span>
                    ),
                  },
                  {
                    key: "orders",
                    header: "Orders",
                    className: "text-right tabular-nums",
                    cell: (row) => row.stats?.orders ?? 0,
                  },
                  {
                    key: "spent",
                    header: "Total spent",
                    className: "text-right tabular-nums",
                    cell: (row) => (
                      <span className="font-semibold">{formatPrice(row.stats?.spent ?? 0)}</span>
                    ),
                  },
                  {
                    key: "wallet",
                    header: "Wallet",
                    className: "text-right tabular-nums",
                    cell: (row) => formatPrice(row.walletBalance),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => <StatusBadge status={row.deletedAt ? "Deleted" : row.status} />,
                  },
                  {
                    key: "joined",
                    header: "Joined",
                    className: "whitespace-nowrap",
                    cell: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </span>
                    ),
                  },
                ]}
                card={(row) => (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                      <StatusBadge status={row.deletedAt ? "Deleted" : row.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Orders</p>
                        <p className="font-semibold tabular-nums">{row.stats?.orders ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Spent</p>
                        <p className="font-semibold tabular-nums">
                          {formatPrice(row.stats?.spent ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Wallet</p>
                        <p className="font-semibold tabular-nums">
                          {formatPrice(row.walletBalance)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Joined {formatDate(row.createdAt)}
                    </p>
                  </div>
                )}
              />
            )}
          </TabState>

          {query.data && query.data.pages > 1 && (
            <PaginationBar page={query.data.page} pages={query.data.pages} onChange={setPage} />
          )}
          {query.data && (
            <p className="text-center text-[11px] text-muted-foreground">
              {query.data.total} customer{query.data.total === 1 ? "" : "s"} in total
            </p>
          )}
        </div>
      </SectionCard>

      <UserDetailDialog
        userId={selectedId}
        mode="customer"
        open={detailOpen}
        onOpenChange={setDetailOpen}
        actions={(detail) =>
          detail.user.deletedAt ? null : (
            <>
              <AccountActions
                detail={detail}
                mode="customer"
                onDeleted={() => setDetailOpen(false)}
              />
              {canAdjustWallet && (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    setWalletTarget({
                      id: detail.user._id,
                      name: detail.user.name,
                      balance: detail.user.walletBalance,
                    })
                  }
                >
                  <Wallet className="mr-1.5 h-4 w-4" /> Adjust wallet
                </Button>
              )}
              <Button
                variant={detail.user.status === "Blocked" ? "default" : "destructive"}
                className="rounded-xl"
                onClick={() =>
                  setBlockTarget({
                    id: detail.user._id,
                    name: detail.user.name,
                    status: detail.user.status,
                  })
                }
              >
                {detail.user.status === "Blocked" ? (
                  <>
                    <ShieldCheck className="mr-1.5 h-4 w-4" /> Unblock
                  </>
                ) : (
                  <>
                    <Ban className="mr-1.5 h-4 w-4" /> Block account
                  </>
                )}
              </Button>
            </>
          )
        }
      />

      <ConfirmDialog
        open={Boolean(blockTarget)}
        onOpenChange={(open) => !open && setBlockTarget(null)}
        title={
          blockTarget?.status === "Blocked" ? "Unblock this customer?" : "Block this customer?"
        }
        destructive={blockTarget?.status !== "Blocked"}
        pending={statusMutation.isPending}
        confirmLabel={blockTarget?.status === "Blocked" ? "Unblock" : "Block account"}
        description={
          blockTarget?.status === "Blocked" ? (
            <p>
              <strong className="text-foreground">{blockTarget.name}</strong> will be able to sign
              in and shop again straight away. Their cart, wishlist and wallet are untouched.
            </p>
          ) : (
            <>
              <p>
                Blocking <strong className="text-foreground">{blockTarget?.name}</strong> signs them
                out of every device immediately and stops them signing in or placing new orders.
              </p>
              <p>
                Existing orders and their wallet balance are kept, and you can unblock them at any
                time.
              </p>
            </>
          )
        }
        onConfirm={() =>
          blockTarget &&
          statusMutation.mutate({
            id: blockTarget.id,
            status: blockTarget.status === "Blocked" ? "Active" : "Blocked",
          })
        }
      />

      <FormDialog
        open={Boolean(walletTarget)}
        onOpenChange={(open) => !open && setWalletTarget(null)}
        title="Adjust wallet balance"
        description={
          walletTarget
            ? `${walletTarget.name} · current balance ${formatPrice(walletTarget.balance)}`
            : undefined
        }
        submitLabel="Apply adjustment"
        pending={walletMutation.isPending}
        onSubmit={submitWallet}
      >
        <Field
          label="Amount (AED)"
          htmlFor="wallet-amount"
          required
          hint="Use a positive number to credit the wallet, or a minus sign to deduct. The balance can't go below zero."
        >
          <Input
            id="wallet-amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 50 or -25"
            value={walletAmount}
            onChange={(event) => setWalletAmount(event.target.value)}
            className="rounded-xl"
          />
        </Field>
        <Field
          label="Reason"
          htmlFor="wallet-reason"
          required
          hint="The customer sees this in their notification, and it's recorded in the audit log."
        >
          <Textarea
            id="wallet-reason"
            rows={3}
            placeholder="e.g. Goodwill credit for the delayed delivery on SD-10234"
            value={walletReason}
            onChange={(event) => setWalletReason(event.target.value)}
            className="rounded-xl"
          />
        </Field>
        <Note>
          Wallet credit can be spent at checkout on any order. Adjustments take effect immediately.
        </Note>
      </FormDialog>
    </div>
  );
}
