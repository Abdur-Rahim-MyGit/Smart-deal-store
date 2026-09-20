import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { FlashSaleStrip } from "@/components/common/banner-slots";
import { ProductRail } from "@/components/product/product-rail";
import type { Banner, ProductListing } from "@/lib/types";

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

function remaining(endsAt: string | null): TimeLeft | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return {
    hours: Math.floor(ms / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

/** Ticking time left until `endsAt`; null once it has passed. Starts after mount (SSR safe). */
export function useCountdown(endsAt: string | null): TimeLeft | null {
  const [left, setLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setLeft(remaining(endsAt));
    if (!endsAt) return;
    const timer = window.setInterval(() => setLeft(remaining(endsAt)), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  return left;
}

const pad = (value: number) => String(value).padStart(2, "0");

function CountdownChip({ left }: { left: TimeLeft }) {
  const label = `${left.hours} hours ${left.minutes} minutes ${left.seconds} seconds left`;
  return (
    <div className="flex items-center gap-1" role="timer" aria-label={label}>
      {[
        { value: left.hours, unit: "hrs" },
        { value: left.minutes, unit: "min" },
        { value: left.seconds, unit: "sec" },
      ].map((part) => (
        <span
          key={part.unit}
          className="grid h-10 w-11 place-items-center rounded-xl bg-ink text-ink-foreground"
          aria-hidden
        >
          <span className="font-display text-sm leading-none font-extrabold tabular-nums">
            {pad(part.value)}
          </span>
          <span className="text-[9px] tracking-wide uppercase opacity-70">{part.unit}</span>
        </span>
      ))}
    </div>
  );
}

/** Flash deal rail with a live countdown to the end of the sale, under an optional promo strip. */
export function FlashDeals({
  products,
  endsAt,
  banner,
  loading,
}: {
  products: ProductListing[];
  endsAt: string | null;
  banner?: Banner | null | undefined;
  loading?: boolean | undefined;
}) {
  const left = useCountdown(endsAt);

  if (!loading && products.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <FlashSaleStrip banner={banner} />
      <ProductRail
        title="Flash deals"
        subtitle="Limited stock at the lowest price of the week"
        products={products}
        loading={loading}
        action={
          <div className="flex items-center gap-2">
            {left ? (
              <CountdownChip left={left} />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                <Zap className="h-3.5 w-3.5" /> Live now
              </span>
            )}
            <Link
              to="/search"
              search={{ flash: true, sort: "discount" }}
              className="hidden text-sm font-semibold whitespace-nowrap hover:underline sm:inline"
            >
              View all
            </Link>
          </div>
        }
      />
    </section>
  );
}
