import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/data/catalog";
import { ProductCard } from "./product-card";
import { Button } from "@/components/ui/button";

interface ProductRailProps {
  title: string;
  subtitle?: string;
  products: Product[];
  action?: React.ReactNode;
}

/** Horizontally scrollable product rail with desktop arrow controls. */
export function ProductRail({ title, subtitle, products, action }: ProductRailProps) {
  const scroller = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    scroller.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  if (products.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing here yet — new stock lands every Friday.
        </p>
      </section>
    );
  }

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
        className="rail-scroll -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[58%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-[23%] xl:w-[19%]"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
