import { useState, type FormEvent } from "react";
import { Loader2, TicketPercent, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import type { AppliedCoupon } from "@/lib/types";

export interface CouponFieldProps {
  applied: AppliedCoupon | null;
  applying: boolean;
  error: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
  id?: string;
  /** Prefills the input (e.g. a coupon carried over from the cart). */
  initialCode?: string | undefined;
}

/** Coupon entry with the applied state, its discount and a remove action. */
export function CouponField({
  applied,
  applying,
  error,
  onApply,
  onRemove,
  id = "coupon",
  initialCode,
}: CouponFieldProps) {
  const [code, setCode] = useState(initialCode ?? "");
  const isApplied = Boolean(applied && !applied.error);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed) onApply(trimmed.toUpperCase());
  }

  if (isApplied && applied) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-success/40 bg-success/10 px-3 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-success">
              <TicketPercent className="h-4 w-4 shrink-0" />
              {applied.code} applied
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {applied.freeShipping
                ? "Free delivery on this order"
                : applied.discount
                  ? `You save ${formatPrice(applied.discount)}`
                  : (applied.description ?? "Discount applied")}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove coupon ${applied.code}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5" noValidate>
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        Have a coupon code?
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter code"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-10 rounded-xl uppercase placeholder:normal-case"
        />
        <Button
          type="submit"
          variant="outline"
          className="h-10 shrink-0 rounded-xl font-semibold"
          disabled={applying || !code.trim()}
        >
          {applying && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Apply
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
