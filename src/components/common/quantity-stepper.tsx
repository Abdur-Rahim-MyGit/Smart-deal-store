import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  disabled = false,
  size = "md",
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string | undefined;
}) {
  const button = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-border bg-background",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          button,
          "grid place-items-center rounded-l-xl transition-colors hover:bg-accent disabled:opacity-40",
        )}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span
        className={cn(
          "min-w-8 text-center font-semibold tabular-nums",
          size === "sm" ? "text-xs" : "text-sm",
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={cn(
          button,
          "grid place-items-center rounded-r-xl transition-colors hover:bg-accent disabled:opacity-40",
        )}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
