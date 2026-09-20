/** Typed, forgiving parsers for route search params. */

export interface CatalogSearch {
  q?: string | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  rating?: number | undefined;
  discount?: number | undefined;
  inStock?: boolean | undefined;
  flash?: boolean | undefined;
  tag?: string | undefined;
  vendor?: string | undefined;
  sort?: string | undefined;
  page?: number | undefined;
}

export const searchString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : undefined;

export const searchNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const searchBoolean = (value: unknown): boolean | undefined =>
  value === true || value === "true" ? true : undefined;

export function parseCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  const page = searchNumber(search["page"]);
  return {
    q: searchString(search["q"]),
    category: searchString(search["category"]),
    brand: searchString(search["brand"]),
    minPrice: searchNumber(search["minPrice"]),
    maxPrice: searchNumber(search["maxPrice"]),
    rating: searchNumber(search["rating"]),
    discount: searchNumber(search["discount"]),
    inStock: searchBoolean(search["inStock"]),
    flash: searchBoolean(search["flash"]),
    tag: searchString(search["tag"]),
    vendor: searchString(search["vendor"]),
    sort: searchString(search["sort"]),
    page: page && page > 1 ? Math.floor(page) : undefined,
  };
}
