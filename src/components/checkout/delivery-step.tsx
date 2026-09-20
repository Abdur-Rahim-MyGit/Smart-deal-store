import { Clock } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { Emirate, ShippingCode, ShippingOption } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DeliveryStepProps {
  options: ShippingOption[];
  value: ShippingCode;
  emirate: Emirate;
  loading?: boolean | undefined;
  onChange: (code: ShippingCode) => void;
}

/** Step 2: delivery speed, priced by the server for the selected emirate. */
export function DeliveryStep({
  options,
  value,
  emirate,
  loading = false,
  onChange,
}: DeliveryStepProps) {
  if (loading && options.length === 0) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-[74px] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Delivery option</legend>
      {options.map((option) => {
        const selected = option.code === value && option.available;
        const inputId = `shipping-${option.code}`;
        return (
          <label
            key={option.code}
            htmlFor={inputId}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 transition-colors",
              option.available ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              selected ? "border-foreground bg-accent/40" : "border-border",
              option.available && !selected && "hover:bg-accent/20",
            )}
          >
            <input
              id={inputId}
              type="radio"
              name="shipping-method"
              value={option.code}
              checked={selected}
              disabled={!option.available}
              onChange={() => onChange(option.code)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold">{option.label}</span>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    option.fee === 0 && "text-success",
                  )}
                >
                  {option.fee === 0 ? "FREE" : formatPrice(option.fee)}
                </span>
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {option.eta}
              </span>
              {!option.available && (
                <span className="mt-1 block text-xs font-semibold text-destructive">
                  Not available in {emirate}
                </span>
              )}
              {option.available && option.fee === 0 && option.baseFee > 0 && (
                <span className="mt-1 block text-xs font-semibold text-success">
                  Free on orders over {formatPrice(option.freeThreshold ?? 0)}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
