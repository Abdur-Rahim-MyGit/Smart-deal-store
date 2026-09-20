import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search as SearchIcon, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatPrice } from "@/lib/format";
import type { CatalogSearch } from "@/lib/search-params";
import type { Category, Facets } from "@/lib/types";
import { cn } from "@/lib/utils";

export const DISCOUNT_STEPS = [10, 20, 30, 50] as const;
export const RATING_STEPS = [4, 3] as const;

/** `brand` travels through the URL as a comma separated list. */
export function brandList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

export function joinBrands(brands: string[]): string | undefined {
  return brands.length > 0 ? brands.join(",") : undefined;
}

/** Filters the shopper can see and clear (the category is part of the page on /category). */
export function countActiveFilters(search: CatalogSearch, includeCategory: boolean): number {
  return (
    brandList(search.brand).length +
    (search.minPrice !== undefined || search.maxPrice !== undefined ? 1 : 0) +
    (search.rating ? 1 : 0) +
    (search.discount ? 1 : 0) +
    (search.inStock ? 1 : 0) +
    (search.flash ? 1 : 0) +
    (search.tag ? 1 : 0) +
    (search.vendor ? 1 : 0) +
    (includeCategory && search.category ? 1 : 0)
  );
}

export const CLEARED_FILTERS: Partial<CatalogSearch> = {
  brand: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  rating: undefined,
  discount: undefined,
  inStock: undefined,
  flash: undefined,
  tag: undefined,
  vendor: undefined,
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}

const pillClass =
  "rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground";

export interface FilterPanelProps {
  search: CatalogSearch;
  onChange: (patch: Partial<CatalogSearch>) => void;
  facets: Facets | undefined;
  loading?: boolean | undefined;
  /** Category page: sibling/child links rendered instead of the category filter list. */
  childCategories?: Category[] | undefined;
  /** Search page: lets the shopper narrow to one category. */
  showCategoryList?: boolean | undefined;
  /** Keeps control ids unique when the panel is rendered twice (sidebar + sheet). */
  idPrefix?: string | undefined;
}

/** Full filter column, reused by the desktop sidebar and the mobile sheet. */
export function FilterPanel({
  search,
  onChange,
  facets,
  loading,
  childCategories,
  showCategoryList,
  idPrefix = "filter",
}: FilterPanelProps) {
  const [brandQuery, setBrandQuery] = useState("");
  const [minPrice, setMinPrice] = useState(
    search.minPrice !== undefined ? String(search.minPrice) : "",
  );
  const [maxPrice, setMaxPrice] = useState(
    search.maxPrice !== undefined ? String(search.maxPrice) : "",
  );

  useEffect(() => {
    setMinPrice(search.minPrice !== undefined ? String(search.minPrice) : "");
  }, [search.minPrice]);
  useEffect(() => {
    setMaxPrice(search.maxPrice !== undefined ? String(search.maxPrice) : "");
  }, [search.maxPrice]);

  const selectedBrands = brandList(search.brand);
  const brands = facets?.brands ?? [];
  const searchableBrands = brands.length > 10;
  const visibleBrands = brandQuery
    ? brands.filter((brand) => brand.name.toLowerCase().includes(brandQuery.toLowerCase()))
    : brands;

  const range = facets?.priceRange;

  function toggleBrand(name: string, checked: boolean) {
    const next = checked
      ? [...selectedBrands, name]
      : selectedBrands.filter((entry) => entry !== name);
    onChange({ brand: joinBrands(next) });
  }

  function applyPrice() {
    const min = minPrice.trim() === "" ? undefined : Math.max(0, Number(minPrice));
    const max = maxPrice.trim() === "" ? undefined : Math.max(0, Number(maxPrice));
    onChange({
      minPrice: min !== undefined && Number.isFinite(min) ? min : undefined,
      maxPrice: max !== undefined && Number.isFinite(max) ? max : undefined,
    });
  }

  return (
    <div className="divide-y-0">
      {childCategories && childCategories.length > 0 && (
        <Group title="Shop by type">
          <ul className="grid gap-1">
            {childCategories.map((category) => (
              <li key={category._id}>
                <Link
                  to="/category/$slug"
                  params={{ slug: category.slug }}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-accent"
                  activeProps={{ className: "bg-accent font-semibold" }}
                >
                  <span className="truncate">{category.name}</span>
                  {typeof category.productCount === "number" && category.productCount > 0 && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {category.productCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Group>
      )}

      {showCategoryList && (facets?.categories.length ?? 0) > 0 && (
        <Group title="Category">
          <ul className="grid max-h-64 gap-1 overflow-y-auto pr-1">
            {(facets?.categories ?? []).map((category) => {
              const active = search.category === category.slug;
              return (
                <li key={category.slug}>
                  <button
                    type="button"
                    onClick={() => onChange({ category: active ? undefined : category.slug })}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-accent",
                      active && "bg-accent font-semibold",
                    )}
                  >
                    <span className="truncate">{category.name}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {category.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Group>
      )}

      <Group title="Brand">
        {loading && brands.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-6 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <p className="text-sm text-muted-foreground">No brands to filter here yet.</p>
        ) : (
          <div className="space-y-2.5">
            {searchableBrands && (
              <div className="relative">
                <SearchIcon className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={brandQuery}
                  onChange={(event) => setBrandQuery(event.target.value)}
                  placeholder="Search brands"
                  aria-label="Search brands"
                  className="h-9 rounded-xl pl-8"
                />
              </div>
            )}
            <ul className="max-h-60 space-y-0.5 overflow-y-auto pr-1">
              {visibleBrands.map((brand) => {
                const id = `${idPrefix}-brand-${brand.name.replace(/\W+/g, "-").toLowerCase()}`;
                return (
                  <li key={brand.name}>
                    <label
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      <Checkbox
                        id={id}
                        checked={selectedBrands.includes(brand.name)}
                        onCheckedChange={(checked) => toggleBrand(brand.name, checked === true)}
                      />
                      <span className="min-w-0 flex-1 truncate">{brand.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{brand.count}</span>
                    </label>
                  </li>
                );
              })}
              {visibleBrands.length === 0 && (
                <li className="px-2 py-1.5 text-sm text-muted-foreground">
                  No brand matches “{brandQuery}”.
                </li>
              )}
            </ul>
          </div>
        )}
      </Group>

      <Group title="Price">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label htmlFor={`${idPrefix}-min-price`} className="sr-only">
                Minimum price
              </label>
              <Input
                id={`${idPrefix}-min-price`}
                type="number"
                min={0}
                inputMode="numeric"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyPrice();
                }}
                placeholder={range ? String(Math.floor(range.min)) : "Min"}
                className="h-9 rounded-xl"
              />
            </div>
            <span className="text-sm text-muted-foreground">–</span>
            <div className="flex-1">
              <label htmlFor={`${idPrefix}-max-price`} className="sr-only">
                Maximum price
              </label>
              <Input
                id={`${idPrefix}-max-price`}
                type="number"
                min={0}
                inputMode="numeric"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyPrice();
                }}
                placeholder={range ? String(Math.ceil(range.max)) : "Max"}
                className="h-9 rounded-xl"
              />
            </div>
          </div>
          {range && (
            <p className="text-xs text-muted-foreground">
              {formatPrice(range.min)} – {formatPrice(range.max)} in these results
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={applyPrice}
            className="w-full rounded-xl font-semibold"
          >
            Apply price
          </Button>
        </div>
      </Group>

      <Group title="Customer rating">
        <div className="grid gap-1.5">
          {RATING_STEPS.map((step) => {
            const active = search.rating === step;
            return (
              <button
                key={step}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ rating: active ? undefined : step })}
                className={cn(
                  pillClass,
                  "flex items-center gap-2",
                  active ? "border-foreground bg-accent font-semibold" : "border-border",
                )}
              >
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: step }, (_, index) => (
                    <Star key={index} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  ))}
                </span>
                & up
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Discount">
        <div className="grid grid-cols-2 gap-1.5">
          {DISCOUNT_STEPS.map((step) => {
            const active = search.discount === step;
            return (
              <button
                key={step}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ discount: active ? undefined : step })}
                className={cn(
                  pillClass,
                  "text-center",
                  active ? "border-foreground bg-accent font-semibold" : "border-border",
                )}
              >
                {step}% or more
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Availability">
        <label
          htmlFor={`${idPrefix}-in-stock`}
          className="flex cursor-pointer items-center justify-between gap-3 text-sm"
        >
          <span>In stock only</span>
          <Switch
            id={`${idPrefix}-in-stock`}
            checked={Boolean(search.inStock)}
            onCheckedChange={(checked) => onChange({ inStock: checked ? true : undefined })}
          />
        </label>
      </Group>
    </div>
  );
}

interface Chip {
  key: string;
  label: string;
  clear: Partial<CatalogSearch>;
}

/** Removable summary of everything currently narrowing the results. */
export function ActiveFilterChips({
  search,
  onChange,
  includeCategory,
  categoryLabel,
  vendorLabel,
}: {
  search: CatalogSearch;
  onChange: (patch: Partial<CatalogSearch>) => void;
  includeCategory: boolean;
  categoryLabel?: string | undefined;
  vendorLabel?: string | undefined;
}) {
  const brands = brandList(search.brand);
  const chips: Chip[] = [];

  if (includeCategory && search.category) {
    chips.push({
      key: "category",
      label: categoryLabel ?? search.category,
      clear: { category: undefined },
    });
  }
  brands.forEach((brand) => {
    chips.push({
      key: `brand-${brand}`,
      label: brand,
      clear: { brand: joinBrands(brands.filter((entry) => entry !== brand)) },
    });
  });
  if (search.minPrice !== undefined || search.maxPrice !== undefined) {
    const min = search.minPrice !== undefined ? formatPrice(search.minPrice) : "Any";
    const max = search.maxPrice !== undefined ? formatPrice(search.maxPrice) : "Any";
    chips.push({
      key: "price",
      label: `${min} – ${max}`,
      clear: { minPrice: undefined, maxPrice: undefined },
    });
  }
  if (search.rating)
    chips.push({ key: "rating", label: `${search.rating}★ & up`, clear: { rating: undefined } });
  if (search.discount)
    chips.push({
      key: "discount",
      label: `${search.discount}%+ off`,
      clear: { discount: undefined },
    });
  if (search.inStock)
    chips.push({ key: "inStock", label: "In stock only", clear: { inStock: undefined } });
  if (search.flash) chips.push({ key: "flash", label: "Flash deals", clear: { flash: undefined } });
  if (search.tag) chips.push({ key: "tag", label: `#${search.tag}`, clear: { tag: undefined } });
  if (search.vendor)
    chips.push({
      key: "vendor",
      label: vendorLabel ?? "Selected seller",
      clear: { vendor: undefined },
    });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onChange(chip.clear)}
          className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold transition-colors hover:bg-accent"
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3 w-3 shrink-0" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({ ...CLEARED_FILTERS, ...(includeCategory ? { category: undefined } : {}) })
        }
        className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Clear all
      </button>
    </div>
  );
}
