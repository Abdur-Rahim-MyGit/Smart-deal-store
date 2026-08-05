import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { byTag } from "@/data/catalog";
import { ProductRail } from "@/components/product/product-rail";

/** Flash deals rail with a live countdown to the end of the deal window. */
export function FlashDeals() {
  const deals = useMemo(() => byTag("flash", 10), []);
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    // Deal window resets every 6 hours.
    function computeRemaining() {
      const now = new Date();
      const windowMs = 6 * 60 * 60 * 1000;
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const elapsed = now.getTime() - start.getTime();
      return windowMs - (elapsed % windowMs);
    }
    setRemaining(computeRemaining());
    const timer = window.setInterval(() => setRemaining(computeRemaining()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
  const parts = [
    { label: "hrs", value: Math.floor(totalSeconds / 3600) },
    { label: "min", value: Math.floor((totalSeconds % 3600) / 60) },
    { label: "sec", value: totalSeconds % 60 },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-extrabold sm:text-2xl">Flash deals</h2>
            <p className="truncate text-sm text-muted-foreground">Prices revert when the timer hits zero</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {parts.map((part) => (
            <span key={part.label} className="text-center">
              <span className="block min-w-11 rounded-xl bg-ink px-2 py-1.5 font-display text-lg font-extrabold text-ink-foreground tabular-nums">
                {String(part.value).padStart(2, "0")}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold text-muted-foreground uppercase">
                {part.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <ProductRail title="Ends soon" products={deals} />
    </section>
  );
}
