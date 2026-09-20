import { useCallback, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { SiteLayout, PageContainer, Breadcrumbs } from "@/components/layout/site-layout";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import {
  CatalogBrowser,
  catalogFacetParams,
  catalogListParams,
  type CatalogListResponse,
} from "@/components/catalog/catalog-browser";
import { api } from "@/lib/api";
import type { Facets } from "@/lib/types";
import { categoryAncestors, categoryImage, useCategories } from "@/hooks/use-categories";
import { parseCatalogSearch, type CatalogSearch } from "@/lib/search-params";

function prettify(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const Route = createFileRoute("/category/$slug")({
  validateSearch: parseCatalogSearch,
  loaderDeps: ({ search }) => search,
  // Server-renders the first screen of results for crawlers; client-side filter
  // changes skip this so the grid updates instantly via React Query.
  loader: async ({ params, deps }) => {
    if (typeof window !== "undefined") return null;
    try {
      const [list, facets] = await Promise.all([
        api<CatalogListResponse>("/products", { query: catalogListParams(deps, params.slug) }),
        api<{ facets: Facets }>("/products/facets", {
          query: catalogFacetParams(deps, params.slug),
        }).then((response) => response.facets),
      ]);
      return { list, facets };
    } catch {
      return null;
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `${prettify(params.slug)} | Smart Deal` },
      {
        name: "description",
        content: `Shop ${prettify(params.slug)} from verified UAE sellers on Smart Deal — fast delivery, cash on delivery and easy returns.`,
      },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const serverData = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { categories, bySlug, isPending } = useCategories();

  const onChange = useCallback(
    (patch: Partial<CatalogSearch>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...patch, page: patch.page }),
        resetScroll: false,
      });
    },
    [navigate],
  );

  const category = bySlug.get(slug);
  // Categories above this one, top level first (a sub-subcategory has two).
  const ancestors = useMemo(
    () => categoryAncestors(categories, category?.parentCategory),
    [categories, category],
  );
  const children = useMemo(
    () => (category ? categories.filter((entry) => entry.parentCategory === category._id) : []),
    [categories, category],
  );

  if (!isPending && !category) {
    return (
      <SiteLayout>
        <PageContainer className="py-10">
          <EmptyState
            icon={SearchX}
            title="We couldn't find that category"
            description={`“${prettify(slug)}” isn't a category on Smart Deal — it may have been renamed or removed.`}
            action={
              <>
                <Button asChild className="rounded-xl font-semibold">
                  <Link to="/search">Browse all products</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl font-semibold">
                  <Link to="/">Go to home</Link>
                </Button>
              </>
            }
          />
        </PageContainer>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <PageContainer className="space-y-5 py-5 sm:py-6">
        <Breadcrumbs>
          {[
            <Link key="home" to="/">
              Home
            </Link>,
            ...ancestors.map((ancestor) => (
              <Link key={ancestor._id} to="/category/$slug" params={{ slug: ancestor.slug }}>
                {ancestor.name}
              </Link>
            )),
            category?.name ?? prettify(slug),
          ]}
        </Breadcrumbs>

        {category ? (
          <header className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div className="relative h-36 sm:h-44 lg:h-52">
              <img
                src={category.banner || categoryImage(category)}
                alt=""
                loading="eager"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
              <div className="absolute inset-0 flex flex-col justify-end p-5 text-white sm:p-7">
                <h1 className="font-display text-2xl font-extrabold sm:text-3xl lg:text-4xl">
                  {category.name}
                </h1>
                {category.description && (
                  <p className="mt-1 max-w-2xl text-sm opacity-90">{category.description}</p>
                )}
                {typeof category.productCount === "number" && category.productCount > 0 && (
                  <p className="mt-1 text-xs font-semibold opacity-80">
                    {category.productCount} products
                  </p>
                )}
              </div>
            </div>

            {children.length > 0 && (
              <nav
                aria-label={`${category.name} subcategories`}
                className="rail-scroll flex gap-2 overflow-x-auto p-3"
              >
                {children.map((child) => (
                  <Link
                    key={child._id}
                    to="/category/$slug"
                    params={{ slug: child.slug }}
                    className="shrink-0 rounded-full border border-border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors hover:bg-accent"
                  >
                    {child.name}
                  </Link>
                ))}
              </nav>
            )}
          </header>
        ) : (
          <div className="h-36 animate-pulse rounded-3xl bg-muted sm:h-44 lg:h-52" aria-hidden />
        )}

        <CatalogBrowser
          search={search}
          onChange={onChange}
          lockedCategory={slug}
          childCategories={children}
          initialList={serverData?.list}
          initialFacets={serverData?.facets}
        />
      </PageContainer>
    </SiteLayout>
  );
}
