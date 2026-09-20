import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = { xs: "h-3 w-3", sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" } as const;

/** Read-only star rating with partial fills (e.g. 4.3). */
export function RatingStars({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, value - (star - 1)));
        return (
          <span key={star} className="relative inline-flex">
            <Star className={cn(SIZES[size], "text-amber-500/30")} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn(SIZES[size], "fill-amber-500 text-amber-500")} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Clickable 1–5 star input. */
export function RatingInput({
  value,
  onChange,
  size = "lg",
}: {
  value: number;
  onChange: (value: number) => void;
  size?: keyof typeof SIZES;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          onClick={() => onChange(star)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Star
            className={cn(
              SIZES[size],
              star <= value ? "fill-amber-500 text-amber-500" : "text-muted-foreground/50",
            )}
          />
        </button>
      ))}
    </div>
  );
}
