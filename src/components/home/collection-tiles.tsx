import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { categoryImage } from "@/hooks/use-categories";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const EDITORIAL: Record<string, string> = {
  skincare: "Barrier-first routines",
  makeup: "Everyday colour",
  perfume: "Oud, amber & fresh",
  electronics: "Tested & warranty-backed",
  fashion: "Considered basics",
  home: "Made to be used daily",
  haircare: "Scalp to ends",
  wellness: "Small daily habits",
};

/** Editorial bento tiles linking into the biggest categories. */
export function CollectionTiles({ categories }: { categories: Category[] }) {
  const tiles = categories.slice(0, 5);
  if (tiles.length < 3) return null;

  return (
    <section className="space-y-4" aria-labelledby="featured-collections">
      <div>
        <h2 id="featured-collections" className="font-display text-xl font-extrabold sm:text-2xl">
          Featured collections
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edits our buyers put together this month.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((category, index) => {
          const feature = index === 0;
          return (
            <Link
              key={category._id}
              to="/category/$slug"
              params={{ slug: category.slug }}
              className={cn(
                "group relative flex overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
                feature
                  ? "col-span-2 aspect-[16/11] lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:min-h-[320px]"
                  : "aspect-[4/3]",
              )}
            >
              <img
                src={categoryImage(category)}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <span className={cn("relative mt-auto w-full p-4 text-white", feature && "sm:p-6")}>
                <span className="block text-[11px] font-bold tracking-wide uppercase opacity-85">
                  {EDITORIAL[category.slug] ?? category.description ?? "Curated edit"}
                </span>
                <span
                  className={cn(
                    "font-display mt-1 block leading-tight font-extrabold",
                    feature ? "text-xl sm:text-3xl" : "text-base sm:text-lg",
                  )}
                >
                  {category.name}
                </span>
                <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold opacity-90 group-hover:gap-2 group-hover:opacity-100">
                  Shop the edit <ArrowRight className="h-3.5 w-3.5 transition-all" />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
