import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Clock, Hourglass, Landmark, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { StatGridSkeleton, TableSkeleton } from "@/components/vendor/common";
import { LockedNotice, useVendorGate } from "@/components/vendor/vendor-status";
import type { VendorPayoutsResponse, VendorTabProps } from "@/components/vendor/types";

const OPEN_STATUSES = ["Requested", "Processing"];

/** Balances, payout requests and transfer history. */
export function PayoutsTab({ onNavigate }: VendorTabProps) {
  const gate = useVendorGate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["vendor-payouts"],
    queryFn: () => api<VendorPayoutsResponse>("/vendors/payouts"),
    staleTime: 30_000,
  });

  const requestMutation = useMutation({
    mutationFn: (value: number) =>
      api<{ message: string }>("/vendors/payouts", { method: "POST", body: { amount: value } }),
    onSuccess: (response) => {
      toast.success(response.message || "Payout requested");
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["vendor-payouts"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  if (isPending) {
    return (
      <div className="space-y-5">
        <StatGridSkeleton count={4} />
        <Skeleton className="h-64 rounded-2xl" />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <InlineError
        message={errorMessage(error, "We couldn't load your payouts.")}
        onRetry={() => void refetch()}
      />
    );
  }

  const { balances, bankAccount, payouts } = data;
  const hasBank = Boolean(bankAccount.iban && bankAccount.bankName);
  const openPayout = payouts.find((payout) => OPEN_STATUSES.includes(payout.status));
  const belowMinimum = balances.availableBalance < balances.minPayout;

  const parsed = Number(amount);
  const amountValid =
    amount !== "" &&
    Number.isFinite(parsed) &&
    parsed >= balances.minPayout &&
    parsed <= balances.availableBalance;
  const amountError =
    amount === "" || amountValid
      ? null
      : !Number.isFinite(parsed) || parsed <= 0
        ? "Enter an amount in AED"
        : parsed < balances.minPayout
          ? `The minimum payout is ${formatPrice(balances.minPayout)}`
          : `You can withdraw up to ${formatPrice(balances.availableBalance)}`;

  const blockedReason = !gate.isActive
    ? (gate.lockReason ?? "Payouts are locked on this account.")
    : !hasBank
      ? "Add your bank name and IBAN in Store settings before requesting a payout."
      : openPayout
        ? `You already have a payout of ${formatPrice(openPayout.amount)} ${openPayout.status.toLowerCase()}. Requests are processed one at a time — the next one unlocks when this transfer completes.`
        : belowMinimum
          ? `You need at least ${formatPrice(balances.minPayout)} available to request a payout. Earnings clear ${balances.holdDays} days after delivery.`
          : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Payouts</h2>
        <p className="text-sm text-muted-foreground">
          Earnings clear {balances.holdDays} days after delivery, then you can transfer them to your
          bank.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Available now"
          value={formatPrice(balances.availableBalance)}
          icon={Wallet}
          tone="success"
          hint="Ready to withdraw"
        />
        <StatCard
          label="On hold"
          value={formatPrice(balances.onHold)}
          icon={Clock}
          tone="warning"
          hint={`Clears ${balances.holdDays} days after delivery`}
        />
        <StatCard
          label="In progress"
          value={formatPrice(balances.inProgress)}
          icon={Hourglass}
          hint="Requested or being transferred"
        />
        <StatCard
          label="Paid out"
          value={formatPrice(balances.paidOut)}
          icon={Banknote}
          hint="Transferred to your bank"
        />
      </div>

      <SectionCard
        title="Request a payout"
        description="Transfers usually complete within 2–3 business days."
      >
        {!hasBank ? (
          <EmptyState
            icon={Landmark}
            title="No bank account on file"
            description="Smart Deal transfers payouts to a UAE IBAN. Add your bank name, account name and IBAN to enable withdrawals."
            action={
              <Button className="rounded-xl font-semibold" onClick={() => onNavigate("store")}>
                Add bank details
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="payout-amount">Amount (AED)</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="payout-amount"
                    type="number"
                    min={balances.minPayout}
                    max={balances.availableBalance}
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    disabled={Boolean(blockedReason) || requestMutation.isPending}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={String(balances.minPayout)}
                    className="h-10 w-full rounded-xl tabular-nums sm:w-48"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl font-semibold"
                    disabled={Boolean(blockedReason) || requestMutation.isPending}
                    onClick={() => setAmount(String(balances.availableBalance))}
                  >
                    Withdraw all
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl font-semibold"
                    disabled={!amountValid || Boolean(blockedReason) || requestMutation.isPending}
                    onClick={() => requestMutation.mutate(Number(Number(amount).toFixed(2)))}
                  >
                    {requestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request payout
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum {formatPrice(balances.minPayout)} · available{" "}
                  {formatPrice(balances.availableBalance)}
                </p>
                {amountError && (
                  <p className="text-xs font-medium text-destructive">{amountError}</p>
                )}
              </div>
              {blockedReason && <LockedNotice reason={blockedReason} />}
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                Paid into
              </p>
              <p className="mt-1.5 font-semibold">{bankAccount.bankName}</p>
              <p className="text-sm text-muted-foreground">{bankAccount.accountName}</p>
              <p className="mt-2 font-mono text-sm break-all">{bankAccount.iban}</p>
              {bankAccount.accountNumber && (
                <p className="font-mono text-xs text-muted-foreground">
                  A/C {bankAccount.accountNumber}
                </p>
              )}
              <button
                type="button"
                onClick={() => onNavigate("store")}
                className="mt-3 text-xs font-semibold underline underline-offset-4"
              >
                Change bank details
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Payout history"
        description={`${payouts.length} request${payouts.length === 1 ? "" : "s"}`}
      >
        {payouts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No payouts yet. Once you have {formatPrice(balances.minPayout)} available, request your
            first transfer above.
          </p>
        ) : (
          <TableScroll>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-semibold">Requested</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
                <th className="pb-2 font-semibold">Status</th>
                <th className="pb-2 font-semibold">Reference</th>
                <th className="pb-2 font-semibold">Remarks</th>
                <th className="pb-2 font-semibold">Processed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payouts.map((payout) => (
                <tr key={payout._id}>
                  <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(payout.createdAt)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                    {formatPrice(payout.amount)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={payout.status} />
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{payout.reference || "—"}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{payout.remarks || "—"}</td>
                  <td className="py-2.5 whitespace-nowrap text-muted-foreground">
                    {payout.processedAt ? formatDate(payout.processedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </SectionCard>
    </div>
  );
}
