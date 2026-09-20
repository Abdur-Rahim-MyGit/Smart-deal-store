import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bookmark, Heart, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/common/quantity-stepper";
import { formatPrice } from "@/lib/format";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDisplayPrice } from "@/hooks/use-settings";

const MAX_PER_LINE = 10;

/** Links to the product page when the line still resolves to a live product. */
function ProductLink({
  slug,
  className,
  children,
}: {
  slug?: string | undefined;
  className?: string;
  children: ReactNode;
}) {
  if (!slug) return <span className={className}>{children}</span>;
  return (
    <Link to="/product/$slug" params={{ slug }} className={className}>
      {children}
    </Link>
  );
}

export interface CartLineRowProps {
  line: CartLine;
  /** Signed-in shoppers can park a line in "Saved for later". */
  canSaveForLater: boolean;
  onQtyChange: (qty: number) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
  onSaveForLater: () => Promise<void> | void;
  onMoveToWishlist: () => Promise<void> | void;
}

/** One cart line: media, details, quantity controls and the per-line problem state. */
export function CartLineRow({
  line,
  canSaveForLater,
  onQtyChange,
  onRemove,
  onSaveForLater,
  onMoveToWishlist,
}: CartLineRowProps) {
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const blocked = line.issue === "out_of_stock" || line.issue === "unavailable";
  const short = line.issue === "insufficient_stock";
  const maxQty = Math.max(1, Math.min(MAX_PER_LINE, line.stock));
  const { display } = useDisplayPrice();
  const lineTotal = line.price * line.qty;

  return (
    <li
      aria-busy={busy}
      className={cn(
        "relative grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4 sm:p-5",
        blocked && "opacity-60",
      )}
    >
      <ProductLink
        slug={line.slug}
        className="block aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted"
      >
        <img
          src={line.thumbnail || "/favicon.png"}
          alt={line.title}
          loading="lazy"
          className={cn("h-full w-full object-cover", blocked && "grayscale")}
        />
      </ProductLink>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 space-y-1">
            {line.brand && (
              <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {line.brand}
              </p>
            )}
            <ProductLink
              slug={line.slug}
              className="line-clamp-2 text-sm font-semibold hover:underline sm:text-[15px]"
            >
              {line.title}
            </ProductLink>
            {line.variantLabel && (
              <p className="text-xs text-muted-foreground">{line.variantLabel}</p>
            )}
            {line.vendorName && (
              <p className="text-xs text-muted-foreground">Sold by {line.vendorName}</p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="font-display text-base font-extrabold sm:text-lg">
              {formatPrice(display(lineTotal))}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPrice(display(line.price))} each
              {line.mrp > line.price && (
                <span className="ml-1.5 line-through">{formatPrice(display(line.mrp))}</span>
              )}
            </p>
          </div>
        </div>

        {blocked ? (
          <p className="flex items-start gap-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {line.issue === "out_of_stock"
              ? "Out of stock — remove it to continue to checkout"
              : "No longer available — remove it to continue to checkout"}
          </p>
        ) : short ? (
          <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Only {line.stock} left — reduce the quantity
          </p>
        ) : (
          line.stock <= 5 && (
            <p className="text-xs font-semibold text-destructive">
              Only {line.stock} left in stock
            </p>
          )
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
          {blocked ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-semibold"
              disabled={busy}
              onClick={() => void run(onRemove)}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Remove
            </Button>
          ) : (
            <>
              <QuantityStepper
                value={line.qty}
                max={maxQty}
                disabled={busy}
                size="sm"
                onChange={(qty) => void run(() => onQtyChange(qty))}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(onRemove)}
                  className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
                {canSaveForLater && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(onSaveForLater)}
                    className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <Bookmark className="h-3.5 w-3.5" /> Save for later
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(onMoveToWishlist)}
                  className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <Heart className="h-3.5 w-3.5" /> Move to wishlist
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/** Compact row for the "Saved for later" shelf. */
export function SavedLineRow({
  line,
  onMoveToCart,
  onRemove,
}: {
  line: CartLine;
  onMoveToCart: () => Promise<void> | void;
  onRemove: () => Promise<void> | void;
}) {
  const { display } = useDisplayPrice();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li aria-busy={busy} className="flex gap-3 rounded-xl border border-border bg-background p-3">
      <ProductLink
        slug={line.slug}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
      >
        <img
          src={line.thumbnail || "/favicon.png"}
          alt={line.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </ProductLink>
      <div className="min-w-0 flex-1 space-y-1">
        <ProductLink
          slug={line.slug}
          className="line-clamp-2 text-sm font-semibold hover:underline"
        >
          {line.title}
        </ProductLink>
        <p className="text-sm font-bold">{formatPrice(display(line.price))}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
          <button
            type="button"
            disabled={busy || !line.isAvailable}
            onClick={() => void run(onMoveToCart)}
            className="text-foreground underline underline-offset-4 disabled:opacity-50"
          >
            {line.isAvailable ? "Move to cart" : "Out of stock"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(onRemove)}
            className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
