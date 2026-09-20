import { Banknote, CreditCard, Wallet, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Order, OrderRefund, RefundMethod } from "@/lib/types";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface RefundChoiceValue {
  method: RefundMethod;
  iban: string;
  accountName: string;
}

export const blankRefundChoice = (method: RefundMethod = "wallet"): RefundChoiceValue => ({
  method,
  iban: "",
  accountName: "",
});

/** Request body fields the cancel and return endpoints expect. */
export function refundChoiceBody(value: RefundChoiceValue) {
  return value.method === "bank"
    ? {
        refundMethod: value.method,
        bankAccount: {
          iban: value.iban.replace(/\s+/g, ""),
          accountName: value.accountName.trim(),
        },
      }
    : { refundMethod: value.method };
}

/** Client-side check before submitting; returns a message or null. */
export function refundChoiceError(value: RefundChoiceValue): string | null {
  if (value.method !== "bank") return null;
  if (!/^AE\d{21}$/i.test(value.iban.replace(/\s+/g, "")))
    return "Enter a UAE IBAN (AE followed by 21 digits)";
  if (value.accountName.trim().length < 2) return "Enter the name on the bank account";
  return null;
}

function describe(
  method: RefundMethod,
  order: Order,
): { icon: LucideIcon; title: string; hint: string } {
  if (method === "card") {
    const card = order.paymentDetails.cardLast4
      ? `${order.paymentDetails.cardBrand || "Card"} ending ${order.paymentDetails.cardLast4}`
      : "your card";
    return { icon: CreditCard, title: `Back to ${card}`, hint: "Banks take 5–10 business days" };
  }
  if (method === "bank")
    return {
      icon: Banknote,
      title: "Bank transfer",
      hint: "To your UAE account within 3 business days",
    };
  return {
    icon: Wallet,
    title: "Smart Deal wallet",
    hint: "Instant — spend it on your next order",
  };
}

export const refundMethodLabel = (method: RefundMethod) =>
  ({ wallet: "Smart Deal wallet", card: "Original card", bank: "Bank transfer" })[method];

/** Radio list of refund destinations, with IBAN fields for a bank transfer. */
export function RefundChoice({
  order,
  options,
  value,
  onChange,
}: {
  order: Order;
  options: RefundMethod[];
  value: RefundChoiceValue;
  onChange: (value: RefundChoiceValue) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium">Where should your refund go?</legend>
      {options.map((method) => {
        const { icon: Icon, title, hint } = describe(method, order);
        const checked = value.method === method;
        return (
          <label
            key={method}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              checked ? "border-foreground/40 bg-accent" : "border-border hover:bg-accent/50",
            )}
          >
            <input
              type="radio"
              name="refund-method"
              value={method}
              checked={checked}
              onChange={() => onChange({ ...value, method })}
              className="h-4 w-4 accent-current"
            />
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-[11px] text-muted-foreground">{hint}</span>
            </span>
          </label>
        );
      })}
      {value.method === "bank" && (
        <div className="grid gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="refund-iban">IBAN</Label>
            <Input
              id="refund-iban"
              placeholder="AE07 0331 2345 6789 0123 456"
              value={value.iban}
              onChange={(event) => onChange({ ...value, iban: event.target.value.toUpperCase() })}
              className="rounded-xl font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-name">Name on the account</Label>
            <Input
              id="refund-name"
              value={value.accountName}
              onChange={(event) => onChange({ ...value, accountName: event.target.value })}
              className="rounded-xl"
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

/** Refunds already issued for an order (customer and admin views). */
export function RefundList({ refunds }: { refunds: OrderRefund[] }) {
  if (!refunds.length) return null;
  return (
    <ul className="space-y-2">
      {refunds.map((refund) => (
        <li key={refund._id} className="flex items-start justify-between gap-3 text-sm">
          <span className="min-w-0">
            <span className="block font-medium">{refundMethodLabel(refund.method)}</span>
            <span className="block text-[11px] text-muted-foreground">
              {refund.status === "Processing"
                ? `Transfer to IBAN ending ${refund.bankAccount?.iban?.slice(-4) ?? "—"} in progress`
                : `Sent ${formatDate(refund.completedAt ?? refund.createdAt)}${refund.reference ? ` · Ref ${refund.reference}` : ""}`}
            </span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{formatPrice(refund.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
