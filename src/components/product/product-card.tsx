import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Loader2, ShoppingCart, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { useDisplayPrice } from "@/hooks/use-settings";
import { compactCount, formatPrice } from "@/lib/format";
import type { ProductListing } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Product tile used by every rail, grid and search result. */
export function ProductCard({
  product,
  className,
}: {
  product: ProductListing;
  className?: string;
}) {
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const { display } = useDisplayPrice();
  const [adding, setAdding] = useState(false);
  const saved = isWishlisted(product._id);
  const needsOptions = product.variantCount > 1;
  const lowStock = product.inStock && product.totalStock <= 10;
  const flashActive =
    product.isFlashDeal &&
    (!product.flashDealEndsAt || new Date(product.flashDealEndsAt).getTime() > Date.now());
  // Share of a capped flash deal already claimed, for the progress bar.
  const dealStock = flashActive ? (product.flashDealStock ?? 0) : 0;
  const dealClaimed = dealStock
    ? Math.min(100, Math.round(((product.flashDealSold ?? 0) / dealStock) * 100))
    : 0;

  async function handleAdd() {
    setAdding(true);
    await addToCart({
      productId: product._id,
      variantSku: product.defaultSku,
      qty: 1,
      title: product.title,
    });
    setAdding(false);
  }

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        <img
          src={product.thumbnail}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {product.hoverImage && (
          <img
            src={product.hoverImage}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {product.discountPercent > 0 && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-soft">
              -{product.discountPercent}%
            </span>
          )}
          {flashActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-ink-foreground">
              <Zap className="h-3 w-3" /> Flash
            </span>
          )}
          {product.isClearance && (
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">
              Clearance
            </span>
          )}
        </div>
        {!product.inStock && (
          <span className="absolute inset-x-3 bottom-3 rounded-lg bg-background/90 py-1.5 text-center text-xs font-semibold backdrop-blur">
            Out of stock
          </span>
        )}
      </Link>

      <button
        type="button"
        onClick={() => void toggleWishlist(product._id, product.title)}
        aria-label={
          saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`
        }
        aria-pressed={saved}
        className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-card/90 shadow-soft backdrop-blur transition hover:scale-105 hover:bg-card"
      >
        <Heart className={cn("h-4 w-4", saved && "fill-destructive text-destructive")} />
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {product.brand}
        </p>
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-semibold hover:underline"
        >
          {product.title}
        </Link>

        {product.rating.count > 0 ? (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-success/12 px-1.5 py-0.5 font-semibold text-success">
              {product.rating.average.toFixed(1)}
              <Star className="h-3 w-3 fill-current" />
            </span>
            <span className="text-muted-foreground">({compactCount(product.rating.count)})</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">New — no reviews yet</p>
        )}

        <div className="mt-auto space-y-2.5 pt-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-lg font-extrabold">
              {formatPrice(display(product.price))}
            </span>
            {product.mrp > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(display(product.mrp))}
              </span>
            )}
          </div>
          {dealStock > 0 ? (
            <div className="space-y-1">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={dealClaimed}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Flash deal claimed"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${dealClaimed}%` }}
                />
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground">
                {dealClaimed}% claimed · {Math.max(0, dealStock - (product.flashDealSold ?? 0))}{" "}
                left at this deal
              </p>
            </div>
          ) : (
            lowStock && (
              <p className="text-xs font-semibold text-destructive">
                Only {product.totalStock} left
              </p>
            )
          )}

          {needsOptions ? (
            <Button asChild variant="outline" size="sm" className="w-full rounded-xl font-semibold">
              <Link to="/product/$slug" params={{ slug: product.slug }}>
                Choose options
              </Link>
            </Button>
          ) : (
            <Button
              onClick={handleAdd}
              disabled={!product.inStock || adding}
              size="sm"
              className="w-full rounded-xl font-semibold"
            >
              {adding ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-1.5 h-4 w-4" />
              )}
              {product.inStock ? "Add to cart" : "Sold out"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
