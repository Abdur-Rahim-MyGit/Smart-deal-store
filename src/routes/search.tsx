import { useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, PageContainer, Breadcrumbs } from "@/components/layout/site-layout";
import {
  CatalogBrowser,
  catalogFacetParams,
  catalogListParams,
  type CatalogListResponse,
} from "@/components/catalog/catalog-browser";
import { api } from "@/lib/api";
import { parseCatalogSearch, type CatalogSearch } from "@/lib/search-params";
import type { Facets } from "@/lib/types";

export const Route = createFileRoute("/search")({
  validateSearch: parseCatalogSearch,
  loaderDeps: ({ search }) => search,
  // Server-renders the first screen of results; client-side filter changes skip
  // this so the grid updates instantly via React Query.
  loader: async ({ deps }) => {
    if (typeof window !== "undefined") return null;
    try {
      const [list, facets] = await Promise.all([
        api<CatalogListResponse>("/products", { query: catalogListParams(deps) }),
        api<{ facets: Facets }>("/products/facets", { query: catalogFacetParams(deps) }).then(
          (response) => response.facets,
        ),
      ]);
      return { list, facets };
    } catch {
      return null;
    }
  },
  head: () => ({ meta: [{ title: "Search | Smart Deal" }] }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const serverData = Route.useLoaderData();
  const navigate = Route.useNavigate();

  const onChange = useCallback(
    (patch: Partial<CatalogSearch>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...patch, page: patch.page }),
        resetScroll: false,
      });
    },
    [navigate],
  );

  const heading = search.q
    ? `Results for “${search.q}”`
    : search.flash
      ? "Flash deals"
      : "All products";

  return (
    <SiteLayout>
      <PageContainer className="space-y-5 py-5 sm:py-6">
        <Breadcrumbs>
          {[
            <Link key="home" to="/">
              Home
            </Link>,
            search.q ? `Search: ${search.q}` : "All products",
          ]}
        </Breadcrumbs>

        <header>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authentic products from verified UAE sellers, delivered across all seven emirates.
          </p>
        </header>

        <CatalogBrowser
          search={search}
          onChange={onChange}
          initialList={serverData?.list}
          initialFacets={serverData?.facets}
        />
      </PageContainer>
    </SiteLayout>
  );
}
