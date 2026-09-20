import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductListing } from "@/lib/types";
import { ProductCard, ProductCardSkeleton } from "./product-card";

interface ProductRailProps {
  title: string;
  subtitle?: string | undefined;
  products: ProductListing[];
  loading?: boolean | undefined;
  action?: ReactNode;
  /** Hide the whole section when there's nothing to show (instead of an empty state). */
  hideWhenEmpty?: boolean | undefined;
}

/** Horizontally scrollable product rail with desktop arrow controls. */
export function ProductRail({
  title,
  subtitle,
  products,
  loading,
  action,
  hideWhenEmpty = true,
}: ProductRailProps) {
  const scroller = useRef<HTMLDivElement>(null);

  if (!loading && products.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Nothing here yet — check back soon.</p>
      </section>
    );
  }

  const scrollBy = (direction: 1 | -1) =>
    scroller.current?.scrollBy({
      left: direction * scroller.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  return (
    <section className="space-y-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => scrollBy(-1)}
              aria-label={`Scroll ${title} left`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => scrollBy(1)}
              aria-label={`Scroll ${title} right`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div
        ref={scroller}
        className="rail-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-4 sm:px-0"
      >
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="w-[58%] shrink-0 sm:w-[42%] md:w-[30%] lg:w-[23%] xl:w-[19%]"
              >
                <ProductCardSkeleton />
              </div>
            ))
          : products.map((product) => (
              <div
                key={product._id}
                className="w-[58%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-[23%] xl:w-[19%]"
              >
                <ProductCard product={product} />
              </div>
            ))}
      </div>
    </section>
  );
}

/** Responsive product grid with skeleton loading. */
export function ProductGrid({
  products,
  loading,
  skeletonCount = 8,
}: {
  products: ProductListing[];
  loading?: boolean | undefined;
  skeletonCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {loading
        ? Array.from({ length: skeletonCount }, (_, index) => <ProductCardSkeleton key={index} />)
        : products.map((product) => <ProductCard key={product._id} product={product} />)}
    </div>
  );
}
