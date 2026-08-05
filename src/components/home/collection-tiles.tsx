import { ArrowUpRight } from "lucide-react";
import { collections, getCategory } from "@/data/catalog";
import { cn } from "@/lib/utils";

/** Editorial collection tiles in a bento arrangement. */
export function CollectionTiles() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">Featured collections</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hand-built edits, refreshed by our buying team every fortnight.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection, index) => {
          const category = getCategory(collection.category);
          const wide = index === 0;
          return (
            <button
              key={collection.id}
              type="button"
              className={cn(
                "group relative flex h-56 items-end overflow-hidden rounded-3xl border border-border text-left shadow-soft transition-all duration-300 hover:shadow-lift sm:h-64",
                wide && "sm:col-span-2 lg:col-span-1",
              )}
            >
              <img
                src={category?.image}
                alt={collection.title}
                loading="lazy"
                width={640}
                height={640}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <span className="relative z-10 flex w-full items-end justify-between gap-3 p-5 text-white">
                <span className="min-w-0">
                  <span className="block font-display text-xl font-extrabold">{collection.title}</span>
                  <span className="block text-sm opacity-85">{collection.copy}</span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover:-translate-y-1">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
