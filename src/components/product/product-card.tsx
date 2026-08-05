import { Heart, ShoppingCart, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Product } from "@/data/catalog";
import { discountPercent, formatPrice, compactCount } from "@/lib/format";
import { useStore } from "@/context/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Product card used across every rail and grid on the storefront. */
export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const off = discountPercent(product.price, product.mrp);
  const saved = isWishlisted(product.id);
  const lowStock = product.stock <= 25;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
        className,
      )}
    >
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={640}
          height={640}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {off > 0 && (
          <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
            {off}% off
          </span>
        )}
      </Link>

      <button
        type="button"
        onClick={() => toggleWishlist(product)}
        aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        aria-pressed={saved}
        className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-card/90 text-foreground shadow-soft backdrop-blur transition-colors hover:bg-card"
      >
        <Heart className={cn("h-4 w-4", saved && "fill-destructive text-destructive")} />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {product.brand}
        </p>
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="line-clamp-2 text-sm leading-snug font-semibold hover:underline"
        >
          {product.name}
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 rounded-md bg-success/12 px-1.5 py-0.5 font-semibold text-success">
            {product.rating.toFixed(1)}
            <Star className="h-3 w-3 fill-current" />
          </span>
          <span>({compactCount(product.reviews)})</span>
        </div>

        <div className="mt-auto space-y-3 pt-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-lg font-extrabold">{formatPrice(product.price)}</span>
            {off > 0 && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.mrp)}
              </span>
            )}
          </div>

          {lowStock ? (
            <p className="text-xs font-semibold text-destructive">Only {product.stock} left</p>
          ) : (
            <p className="text-xs font-medium text-success">In stock · free delivery</p>
          )}

          <Button
            onClick={() => addToCart(product)}
            className="w-full rounded-xl font-semibold"
            size="sm"
          >
            <ShoppingCart className="mr-1.5 h-4 w-4" />
            Add to cart
          </Button>
        </div>
      </div>
    </article>
  );
}

/** Loading placeholder matching the card footprint. */
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
