import { useState } from "react";
import { ChevronDown, FileText, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { useDisplayPrice } from "@/hooks/use-settings";
import type { CartLine, Quote } from "@/lib/types";
import { cn } from "@/lib/utils";

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "muted" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className={cn(tone === "muted" ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span className={cn("font-semibold tabular-nums", tone === "success" && "text-success")}>
        {value}
      </span>
    </div>
  );
}

export interface CheckoutSummaryProps {
  items: CartLine[];
  quote: Quote | undefined;
  loading: boolean;
  placing: boolean;
  /** Plain-language reason the button is disabled (null when the order can be placed). */
  blockedReason: string | null;
  onPlaceOrder: () => void;
}

/** Sticky order summary on desktop; a collapsible bar on mobile with the CTA always visible. */
export function CheckoutSummary({
  items,
  quote,
  loading,
  placing,
  blockedReason,
  onPlaceOrder,
}: CheckoutSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const { inclusive, display } = useDisplayPrice();
  const count = items.reduce((sum, line) => sum + line.qty, 0);
  const total = quote?.total ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls="checkout-summary-body"
        className="flex w-full items-center justify-between gap-3 p-4 text-left lg:hidden"
      >
        <span className="text-sm font-bold">
          Order summary
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({count} {count === 1 ? "item" : "items"})
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-display text-base font-extrabold tabular-nums">
            {formatPrice(total)}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
          />
        </span>
      </button>

      <div
        id="checkout-summary-body"
        className={cn(
          "border-t border-border p-5 lg:block lg:border-t-0",
          expanded ? "block" : "hidden",
        )}
      >
        <h2 className="hidden font-display text-lg font-extrabold lg:block">Order summary</h2>

        <ul className="mt-0 space-y-3 lg:mt-4">
          {items.map((line) => (
            <li key={`${line.productId}-${line.variantSku}`} className="flex gap-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                <img
                  src={line.thumbnail || "/favicon.png"}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover"
                />
                <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-ink-foreground">
                  {line.qty}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold">{line.title}</span>
                {line.variantLabel && (
                  <span className="block text-xs text-muted-foreground">{line.variantLabel}</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {line.qty} × {formatPrice(display(line.price))}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatPrice(display(line.price * line.qty))}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-2.5 border-t border-border pt-4">
          {loading && !quote ? (
            <>
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </>
          ) : quote ? (
            <>
              <Row label="Subtotal" value={formatPrice(display(quote.subtotal))} />
              {quote.discount > 0 && (
                <Row
                  label={quote.coupon?.code ? `Discount (${quote.coupon.code})` : "Discount"}
                  value={`- ${formatPrice(display(quote.discount))}`}
                  tone="success"
                />
              )}
              <Row
                label={
                  quote.shippingMethod ? `Delivery (${quote.shippingMethod.label})` : "Delivery"
                }
                value={quote.shippingFee === 0 ? "FREE" : formatPrice(display(quote.shippingFee))}
                {...(quote.shippingFee === 0 ? { tone: "success" as const } : {})}
              />
              {quote.codFee > 0 && (
                <Row label="Cash on delivery fee" value={formatPrice(display(quote.codFee))} />
              )}
              {quote.vatRate > 0 && (
                <Row
                  label={inclusive ? `Includes VAT (${quote.vatRate}%)` : `VAT (${quote.vatRate}%)`}
                  value={formatPrice(quote.vat)}
                  tone="muted"
                />
              )}
              {quote.savings > 0 && (
                <Row
                  label="You save"
                  value={`- ${formatPrice(display(quote.savings))}`}
                  tone="success"
                />
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-t border-border p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-base font-bold">Total</span>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {quote ? formatPrice(quote.total) : loading ? "—" : formatPrice(0)}
          </span>
        </div>

        <Button
          className="h-11 w-full rounded-xl text-sm font-bold"
          onClick={onPlaceOrder}
          disabled={placing || Boolean(blockedReason)}
        >
          {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {placing
            ? "Placing your order…"
            : `Place order · ${quote ? formatPrice(quote.total) : "—"}`}
        </Button>
        {blockedReason && (
          <p className="text-center text-xs font-semibold text-destructive">{blockedReason}</p>
        )}

        <ul className="space-y-2 pt-1 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Secure checkout — card details are never stored on our servers.
          </li>
          <li className="flex items-start gap-2">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />A VAT invoice will be available on
            your order page as soon as the order is placed.
          </li>
        </ul>
      </div>
    </div>
  );
}
