import { Loader2, Lock, RotateCcw, ShieldCheck, Truck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CouponField } from "@/components/cart/coupon-field";
import { estimateShipping, useDisplayPrice } from "@/hooks/use-settings";
import { EMIRATES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import type { AppliedCoupon, CartData, Emirate, StoreSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const round2 = (value: number) => Math.round(value * 100) / 100;

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

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

export interface CartOrderSummaryProps {
  cart: CartData;
  settings: StoreSettings;
  emirate: Emirate;
  onEmirateChange: (emirate: Emirate) => void;
  coupon: AppliedCoupon | null;
  couponError: string | null;
  applyingCoupon: boolean;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  onCheckout: () => void;
  checkoutLabel: string;
  /** Explains, in words, why checkout is blocked (null when it is available). */
  blockedReason: string | null;
  busy?: boolean | undefined;
}

/** Cart-side estimate: delivery by emirate, coupon, VAT and the checkout call to action. */
export function CartOrderSummary({
  cart,
  settings,
  emirate,
  onEmirateChange,
  coupon,
  couponError,
  applyingCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  onCheckout,
  checkoutLabel,
  blockedReason,
  busy = false,
}: CartOrderSummaryProps) {
  const subtotal = cart.summary.subtotal;
  const discount =
    coupon && !coupon.error && !coupon.freeShipping ? Math.min(coupon.discount ?? 0, subtotal) : 0;
  const merchandise = round2(Math.max(0, subtotal - discount));

  const weightKg = cart.items
    .filter((line) => line.isAvailable)
    .reduce((sum, line) => sum + (line.weightKg ?? 0) * line.qty, 0);
  const estimate = estimateShipping(settings, emirate, merchandise, weightKg);
  // With VAT-inclusive pricing each line shows its VAT-inclusive amount; they still add up
  // to the same total, and the VAT is shown as included rather than added.
  const { inclusive, display } = useDisplayPrice();
  const freeShippingCoupon = Boolean(coupon && !coupon.error && coupon.freeShipping);
  const delivery = freeShippingCoupon ? 0 : estimate.fee;
  const vatRate = settings.vatEnabled ? settings.vatPercent : 0;
  const vat = round2(((merchandise + delivery) * vatRate) / 100);
  const total = round2(merchandise + delivery + vat);
  const progress =
    estimate.freeThreshold > 0 ? Math.min(100, (merchandise / estimate.freeThreshold) * 100) : 100;

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="order-summary-heading"
        className="rounded-2xl border border-border bg-card p-5 shadow-soft"
      >
        <h2 id="order-summary-heading" className="font-display text-lg font-extrabold">
          Order summary
        </h2>

        <div className="mt-4 space-y-2.5">
          <Row
            label={`Subtotal (${cart.summary.itemCount} ${cart.summary.itemCount === 1 ? "item" : "items"})`}
            value={formatPrice(display(subtotal))}
          />
          {cart.summary.savings > 0 && (
            <Row
              label="You save"
              value={`- ${formatPrice(display(cart.summary.savings))}`}
              tone="success"
            />
          )}
          {discount > 0 && (
            <Row
              label={`Coupon ${coupon?.code ?? ""}`}
              value={`- ${formatPrice(display(discount))}`}
              tone="success"
            />
          )}
        </div>

        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <Label htmlFor="cart-emirate" className="text-xs font-semibold text-muted-foreground">
            Delivering to
          </Label>
          <select
            id="cart-emirate"
            className={selectClass}
            value={emirate}
            onChange={(event) => onEmirateChange(event.target.value as Emirate)}
          >
            {EMIRATES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <div className="flex items-baseline justify-between gap-4 pt-1 text-sm">
            <span className="text-foreground">Delivery</span>
            <span className={cn("font-semibold tabular-nums", delivery === 0 && "text-success")}>
              {delivery === 0 ? "FREE" : formatPrice(display(delivery))}
            </span>
          </div>
          {estimate.eta && (
            <p className="text-xs text-muted-foreground">Standard delivery · {estimate.eta}</p>
          )}

          {!freeShippingCoupon && estimate.remainingForFree > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-foreground">
                Add {formatPrice(estimate.remainingForFree)} more for free delivery
              </p>
              <div
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress towards free delivery"
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {!freeShippingCoupon && estimate.remainingForFree === 0 && estimate.freeThreshold > 0 && (
            <p className="text-xs font-semibold text-success">
              You've unlocked free standard delivery
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <CouponField
            applied={coupon}
            applying={applyingCoupon}
            error={couponError}
            onApply={onApplyCoupon}
            onRemove={onRemoveCoupon}
            id="cart-coupon"
          />
        </div>

        <div className="mt-5 space-y-2.5 border-t border-border pt-4">
          {vatRate > 0 && !inclusive && (
            <Row label={`Estimated VAT (${vatRate}%)`} value={formatPrice(vat)} tone="muted" />
          )}
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-display text-base font-bold">Estimated total</span>
            <span className="font-display text-xl font-extrabold tabular-nums">
              {formatPrice(total)}
            </span>
          </div>
          {vatRate > 0 && inclusive && (
            <p className="text-xs text-muted-foreground">
              Includes {formatPrice(vat)} VAT ({vatRate}%)
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Estimated — final total is confirmed at checkout, where cash-on-delivery fees and
            express delivery are applied.
          </p>
        </div>

        <Button
          className="mt-5 h-11 w-full rounded-xl text-sm font-bold"
          onClick={onCheckout}
          disabled={busy || Boolean(blockedReason)}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {checkoutLabel}
        </Button>
        {blockedReason && (
          <p className="mt-2 text-center text-xs font-semibold text-destructive">{blockedReason}</p>
        )}
      </section>

      <section
        aria-label="Why shop with Smart Deal"
        className="rounded-2xl border border-border bg-card p-5 shadow-soft"
      >
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-semibold">Secure payments</span>
              <span className="block text-xs text-muted-foreground">
                Card details are never stored on our servers
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-semibold">Cash on delivery available</span>
              <span className="block text-xs text-muted-foreground">
                Pay when your order arrives ({formatPrice(settings.codFee)} handling fee)
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-semibold">{settings.returnWindowDays}-day returns</span>
              <span className="block text-xs text-muted-foreground">
                Easy returns on eligible items across the UAE
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-semibold">100% authentic</span>
              <span className="block text-xs text-muted-foreground">Verified UAE sellers only</span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-semibold">Delivery to all 7 emirates</span>
              <span className="block text-xs text-muted-foreground">
                Standard, express and same-day options
              </span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
