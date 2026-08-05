import { categories } from "@/data/catalog";

/** Circular category tiles, swipeable on mobile. */
export function CategoryCarousel() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">Shop by category</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Eight departments, one checkout, one delivery promise.
        </p>
      </div>
      <ul className="rail-scroll -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
        {categories.map((category) => (
          <li key={category.id} className="w-24 shrink-0 sm:w-auto">
            <button type="button" className="group flex w-full flex-col items-center gap-2 text-center">
              <span className="relative block aspect-square w-full overflow-hidden rounded-full border-2 border-transparent bg-muted transition-all duration-300 group-hover:border-primary group-hover:shadow-glow">
                <img
                  src={category.image}
                  alt={category.name}
                  loading="lazy"
                  width={640}
                  height={640}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </span>
              <span className="text-xs leading-tight font-semibold sm:text-sm">{category.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
