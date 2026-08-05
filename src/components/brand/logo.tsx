import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";

/** Smart Deal lockup: generated tag/spark mark plus wordmark. */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link to="/" className={cn("flex shrink-0 items-center gap-2", className)} aria-label="Smart Deal home">
      <img
        src={logoMark}
        alt="Smart Deal logo"
        width={40}
        height={40}
        className="h-9 w-9 object-contain"
      />
      {showWordmark && (
        <span className="font-display text-xl leading-none font-extrabold tracking-tight">
          Smart<span className="text-muted-foreground">Deal</span>
        </span>
      )}
    </Link>
  );
}
