import { brands } from "@/data/catalog";

/** Featured brand strip — house labels carried on Smart Deal. */
export function BrandStrip() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">Featured brands</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every label is stocked direct — no grey market, no expired batches.
        </p>
      </div>
      <ul className="rail-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {brands.slice(0, 12).map((brand) => (
          <li
            key={brand.id}
            className="w-40 shrink-0 rounded-2xl border border-border bg-card p-4 text-center shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:w-auto"
          >
            <p className="font-display text-base font-extrabold">{brand.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{brand.claim}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
