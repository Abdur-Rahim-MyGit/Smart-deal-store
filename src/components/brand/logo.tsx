import { Link } from "@tanstack/react-router";
import logoMark from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";

/** Smart Deal lockup: Islamic ritual-inspired geometric emblem plus wordmark. */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      to="/"
      className={cn("group flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-95", className)}
      aria-label="Smart Deal home"
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-amber-500/30 transition-transform group-hover:scale-105">
        <img
          src={logoMark}
          alt="Smart Deal Islamic ritual logo"
          width={40}
          height={40}
          className="h-full w-full object-cover rounded-[10px]"
        />
      </div>
      {showWordmark && (
        <div className="flex flex-col">
          <span className="font-display text-xl leading-none font-extrabold tracking-tight">
            Smart<span className="text-amber-600 dark:text-amber-400">Deal</span>
          </span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground/80">
            صفقة ذكية
          </span>
        </div>
      )}
    </Link>
  );
}
