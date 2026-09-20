import { Link } from "@tanstack/react-router";
import type { HomeData } from "@/lib/types";

type HomeBrand = HomeData["brands"][number];

/** Scrollable strip of the brands with the most active listings. */
export function BrandStrip({ brands }: { brands: HomeBrand[] }) {
  if (brands.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="popular-brands">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="popular-brands" className="font-display text-xl font-extrabold sm:text-2xl">
            Popular brands
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Verified sellers, authentic stock.</p>
        </div>
      </div>

      <div className="rail-scroll -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {brands.map((brand) => (
          <Link
            key={brand.name}
            to="/search"
            search={{ brand: brand.name }}
            className="group flex w-[148px] shrink-0 snap-start flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-3.5 text-center shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:w-[168px]"
          >
            <span className="h-16 w-16 overflow-hidden rounded-full border border-border bg-muted">
              <img
                src={brand.image}
                alt=""
                loading="lazy"
                width={128}
                height={128}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold group-hover:underline">
                {brand.name}
              </span>
              <span className="block text-xs text-muted-foreground">{brand.count} products</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
