import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageLoader({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-7 w-7 animate-spin text-foreground/60" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-center">
      <p className="text-sm font-semibold text-destructive">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-semibold underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  );
}
