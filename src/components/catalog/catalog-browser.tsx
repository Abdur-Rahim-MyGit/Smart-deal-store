import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PackageSearch, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarBanner } from "@/components/common/banner-slots";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ProductGrid } from "@/components/product/product-rail";
import {
  ActiveFilterChips,
  CLEARED_FILTERS,
  FilterPanel,
  countActiveFilters,
} from "@/components/catalog/catalog-filters";
import { useCategories } from "@/hooks/use-categories";
import { api, errorMessage } from "@/lib/api";
import { CATALOG_SORTS } from "@/lib/constants";
import type { CatalogSearch } from "@/lib/search-params";
import type { Category, Facets, ProductListing } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export interface CatalogListResponse {
  products: ProductListing[];
  total: number;
  page: number;
  pages: number;
}

/** Product-list query params. Shared with the route loaders so SSR and the client use one cache key. */
export function catalogListParams(search: CatalogSearch, lockedCategory?: string | undefined) {
  return {
    q: search.q,
    category: lockedCategory ?? search.category,
    brand: search.brand,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    rating: search.rating,
    discount: search.discount,
    inStock: search.inStock ? "true" : undefined,
    flash: search.flash ? "true" : undefined,
    tag: search.tag,
    vendor: search.vendor,
    sort: search.sort,
    page: search.page ?? 1,
    limit: PAGE_SIZE,
  };
}

/** Facet params deliberately omit `brand`, so brand counts don't jump while they're being ticked. */
export function catalogFacetParams(search: CatalogSearch, lockedCategory?: string | undefined) {
  return {
    q: search.q,
    category: lockedCategory ?? search.category,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    rating: search.rating,
    discount: search.discount,
    inStock: search.inStock ? "true" : undefined,
    flash: search.flash ? "true" : undefined,
    tag: search.tag,
    vendor: search.vendor,
  };
}

export interface CatalogBrowserProps {
  /** Current URL state — the single source of truth for every filter. */
  search: CatalogSearch;
  /** Merges a patch into the URL. Page resets unless the patch sets it. */
  onChange: (patch: Partial<CatalogSearch>) => void;
  /** Category page: the slug comes from the path and can't be filtered away. */
  lockedCategory?: string | undefined;
  /** Category page: child categories shown as quick links in the sidebar. */
  childCategories?: Category[] | undefined;
  /** Server-rendered results for this exact URL, so the grid is in the HTML for crawlers. */
  initialList?: CatalogListResponse | undefined;
  initialFacets?: Facets | undefined;
}

/** Filter sidebar + toolbar + results grid shared by /search and /category/$slug. */
export function CatalogBrowser({
  search,
  onChange,
  lockedCategory,
  childCategories,
  initialList,
  initialFacets,
}: CatalogBrowserProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { tree } = useCategories();
  const categorySlug = lockedCategory ?? search.category;
  const page = search.page ?? 1;

  const listParams = useMemo(
    () => catalogListParams(search, lockedCategory),
    [search, lockedCategory],
  );
  const facetParams = useMemo(
    () => catalogFacetParams(search, lockedCategory),
    [search, lockedCategory],
  );

  const listQuery = useQuery({
    queryKey: ["products", listParams],
    queryFn: ({ signal }) => api<CatalogListResponse>("/products", { query: listParams, signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    ...(initialList ? { initialData: initialList } : {}),
  });

  const facetsQuery = useQuery<Facets>({
    queryKey: ["product-facets", facetParams],
    queryFn: ({ signal }) =>
      api<{ facets: Facets }>("/products/facets", { query: facetParams, signal }).then(
        (response) => response.facets,
      ),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    ...(initialFacets ? { initialData: initialFacets } : {}),
  });

  const products = listQuery.data?.products ?? [];
  const total = listQuery.data?.total ?? 0;
  const pages = listQuery.data?.pages ?? 1;
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const activeCount = countActiveFilters(search, !lockedCategory);
  const categoryLabel = facetsQuery.data?.categories.find(
    (entry) => entry.slug === search.category,
  )?.name;

  const goToPage = (next: number) => {
    onChange({ page: next > 1 ? next : undefined });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPanel = (idPrefix: string) => (
    <FilterPanel
      search={search}
      onChange={onChange}
      facets={facetsQuery.data}
      loading={facetsQuery.isPending}
      childCategories={childCategories}
      showCategoryList={!lockedCategory}
      idPrefix={idPrefix}
    />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-8">
      <aside className="hidden lg:block">
        {/* Filters and the sidebar promo stick together; the padding keeps card shadows unclipped. */}
        <div className="sticky top-28 -mx-3 max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-3 pt-1 pb-6">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between pb-3">
              <h2 className="font-display text-base font-bold">Filters</h2>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...CLEARED_FILTERS,
                      ...(lockedCategory ? {} : { category: undefined }),
                    })
                  }
                  className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Clear all
                </button>
              )}
            </div>
            {renderPanel("sidebar")}
          </div>
          <SidebarBanner />
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {listQuery.isPending ? (
              "Loading products…"
            ) : total === 0 ? (
              "No results"
            ) : (
              <>
                <span className="font-semibold text-foreground">
                  {first}–{last}
                </span>{" "}
                of {total} result{total === 1 ? "" : "s"}
              </>
            )}
          </p>

          <div className="flex items-center gap-2">
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-xl font-semibold lg:hidden"
                >
                  <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                  Filters
                  {activeCount > 0 && (
                    <span className="ml-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                      {activeCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[320px] max-w-[88vw] flex-col gap-0 p-0">
                <SheetHeader className="border-b border-border p-4 text-left">
                  <SheetTitle className="font-display">Filters</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">{renderPanel("sheet")}</div>
                <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
                  <Button
                    variant="outline"
                    className="rounded-xl font-semibold"
                    onClick={() =>
                      onChange({
                        ...CLEARED_FILTERS,
                        ...(lockedCategory ? {} : { category: undefined }),
                      })
                    }
                  >
                    Clear all
                  </Button>
                  <Button
                    className="rounded-xl font-semibold"
                    onClick={() => setFiltersOpen(false)}
                  >
                    Show {total} result{total === 1 ? "" : "s"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <label htmlFor="catalog-sort" className="sr-only">
              Sort results
            </label>
            <select
              id="catalog-sort"
              value={search.sort ?? "relevance"}
              onChange={(event) =>
                onChange({
                  sort: event.target.value === "relevance" ? undefined : event.target.value,
                })
              }
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {CATALOG_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ActiveFilterChips
          search={search}
          onChange={onChange}
          includeCategory={!lockedCategory}
          categoryLabel={categoryLabel}
        />

        {listQuery.isError ? (
          <InlineError
            message={errorMessage(listQuery.error)}
            onRetry={() => void listQuery.refetch()}
          />
        ) : !listQuery.isPending && products.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No products match these filters"
            description={
              activeCount > 0
                ? "Try removing a filter or two — or browse one of our popular categories."
                : "We couldn't find anything here. Browse a popular category instead."
            }
            action={
              <>
                {activeCount > 0 && (
                  <Button
                    variant="outline"
                    className="rounded-xl font-semibold"
                    onClick={() =>
                      onChange({
                        ...CLEARED_FILTERS,
                        ...(lockedCategory ? {} : { category: undefined }),
                      })
                    }
                  >
                    Clear all filters
                  </Button>
                )}
                <Button asChild className="rounded-xl font-semibold">
                  <Link to="/search">Browse all products</Link>
                </Button>
              </>
            }
          />
        ) : (
          <div
            className={cn(
              "transition-opacity",
              listQuery.isFetching && !listQuery.isPending && "opacity-60",
            )}
            aria-busy={listQuery.isFetching}
          >
            <ProductGrid products={products} loading={listQuery.isPending} skeletonCount={12} />
          </div>
        )}

        {!listQuery.isPending && products.length === 0 && tree.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {tree.slice(0, 8).map((category) => (
              <Link
                key={category._id}
                to="/category/$slug"
                params={{ slug: category.slug }}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-semibold transition-colors hover:bg-accent"
              >
                {category.name}
              </Link>
            ))}
          </div>
        )}

        <PaginationBar page={page} pages={pages} onChange={goToPage} className="pt-2" />
      </div>
    </div>
  );
}
