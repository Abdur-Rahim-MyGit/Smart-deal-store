import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { categoryImage } from "@/hooks/use-categories";
import type { Category } from "@/lib/types";

/** "Shop by category" tiles. */
export function CategoryTiles({
  categories,
  loading,
}: {
  categories: Category[];
  loading?: boolean | undefined;
}) {
  if (!loading && categories.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="shop-by-category">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="shop-by-category" className="font-display text-xl font-extrabold sm:text-2xl">
            Shop by category
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything from serums to smart plugs.
          </p>
        </div>
        <Link
          to="/search"
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold hover:underline sm:inline-flex"
        >
          Browse all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
        {loading
          ? Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="space-y-2">
                <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
                <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-muted" />
              </div>
            ))
          : categories.map((category) => (
              <Link
                key={category._id}
                to="/category/$slug"
                params={{ slug: category.slug }}
                className="group flex flex-col gap-2 text-center"
              >
                <span className="relative block aspect-square overflow-hidden rounded-2xl border border-border bg-muted shadow-soft transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
                  <img
                    src={categoryImage(category)}
                    alt=""
                    loading="lazy"
                    width={320}
                    height={320}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold group-hover:underline">
                    {category.name}
                  </span>
                  {typeof category.productCount === "number" && category.productCount > 0 && (
                    <span className="block text-[11px] text-muted-foreground">
                      {category.productCount} items
                    </span>
                  )}
                </span>
              </Link>
            ))}
      </div>
    </section>
  );
}
