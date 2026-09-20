import { useEffect, useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, PackageX } from "lucide-react";
import { SiteLayout, PageContainer, Breadcrumbs } from "@/components/layout/site-layout";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { ProductBuyBox } from "@/components/product/product-buy-box";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductRail } from "@/components/product/product-rail";
import { ProductReviews } from "@/components/product/product-reviews";
import { useVariantSelection } from "@/components/product/variant-selection";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { CategoryRef, Product, ProductListing } from "@/lib/types";

export interface ProductPageData {
  product: Product & {
    vendor: {
      _id: string;
      name: string;
      description?: string;
      memberSince?: string;
      isPlatform?: boolean;
    } | null;
  };
  ratingBreakdown: Record<string, number>;
}

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    try {
      return await api<ProductPageData>(`/products/${encodeURIComponent(params.slug)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.title} | Smart Deal` },
          { name: "description", content: loaderData.product.description.slice(0, 155) },
          { property: "og:title", content: loaderData.product.title },
          { property: "og:image", content: loaderData.product.thumbnail },
        ]
      : [],
  }),
  component: ProductPage,
  notFoundComponent: ProductNotFound,
  errorComponent: ProductError,
});

const asCategory = (value: CategoryRef | string | null | undefined): CategoryRef | null =>
  value && typeof value === "object" ? value : null;

/** Builds the compact listing shape the rails and "recently viewed" storage expect. */
function toListing(product: ProductPageData["product"]): ProductListing {
  return {
    _id: product._id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    category: asCategory(product.category),
    vendor: product.vendor ? { _id: product.vendor._id, name: product.vendor.name } : null,
    thumbnail: product.thumbnail,
    hoverImage: product.images[1] ?? null,
    price: product.price,
    mrp: product.mrp,
    discountPercent: product.discountPercent,
    totalStock: product.totalStock,
    inStock: product.totalStock > 0,
    rating: product.rating,
    soldCount: product.soldCount,
    tags: product.tags,
    isFeatured: product.isFeatured,
    isFlashDeal: product.isFlashDeal,
    flashDealEndsAt: product.flashDealEndsAt ?? null,
    status: product.status,
    createdAt: product.createdAt,
    defaultSku:
      product.variants.find((variant) => variant.stock > 0)?.sku ??
      product.variants[0]?.sku ??
      null,
    variantCount: product.variants.length,
  };
}

function ProductShell({ children }: { children: React.ReactNode }) {
  return (
    <SiteLayout>
      <PageContainer className="py-10">{children}</PageContainer>
    </SiteLayout>
  );
}

function ProductNotFound() {
  return (
    <ProductShell>
      <EmptyState
        icon={PackageX}
        title="We couldn't find that product"
        description="It may have sold out, been renamed, or been removed by the seller."
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
    </ProductShell>
  );
}

function ProductError({ error }: { error: Error }) {
  return (
    <ProductShell>
      <EmptyState
        icon={PackageX}
        title="This product didn't load"
        description={errorMessage(error)}
        action={
          <Button asChild className="rounded-xl font-semibold">
            <Link to="/search">Browse all products</Link>
          </Button>
        }
      />
    </ProductShell>
  );
}

function ProductPage() {
  const { product, ratingBreakdown } = Route.useLoaderData();
  const selection = useVariantSelection(product);
  const { items: recentlyViewed, add } = useRecentlyViewed(product._id);

  const related = useQuery({
    queryKey: ["related-products", product.slug],
    queryFn: ({ signal }) =>
      api<{ products: ProductListing[] }>(`/products/${encodeURIComponent(product.slug)}/related`, {
        signal,
      }).then((response) => response.products),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    add(toListing(product));
  }, [product, add]);

  const images = useMemo(() => {
    const variantImages = (selection.variant?.images ?? []).filter(Boolean);
    const base = [product.thumbnail, ...product.images].filter(Boolean);
    return [...new Set([...variantImages, ...base])];
  }, [selection.variant, product]);

  // Full path when the API sends it (covers sub-subcategories), else category → subcategory.
  const trail = product.categoryTrail?.length
    ? product.categoryTrail
    : [asCategory(product.category), asCategory(product.subcategory)].filter(
        (entry): entry is NonNullable<typeof entry> => Boolean(entry),
      );
  const specs = Object.entries(product.specifications ?? {});

  const scrollToReviews = () => {
    if (typeof document === "undefined") return;
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <SiteLayout>
      <PageContainer className="space-y-10 py-5 sm:space-y-12 sm:py-6">
        <Breadcrumbs>
          {[
            <Link key="home" to="/">
              Home
            </Link>,
            ...trail.map((entry) => (
              <Link key={entry._id} to="/category/$slug" params={{ slug: entry.slug }}>
                {entry.name}
              </Link>
            )),
            product.title,
          ]}
        </Breadcrumbs>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductGallery
              images={images}
              title={product.title}
              discountPercent={product.discountPercent}
            />
          </div>
          <ProductBuyBox product={product} selection={selection} onReviewsClick={scrollToReviews} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-6">
          <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-xl font-extrabold">About this product</h2>

            {product.highlights.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {product.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {product.description}
            </p>

            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {product.tags.map((tag) => (
                  <Link
                    key={tag}
                    to="/search"
                    search={{ tag }}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-accent"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {specs.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
              <h2 className="font-display text-xl font-extrabold">Specifications</h2>
              <dl className="mt-4 divide-y divide-border text-sm">
                {specs.map(([name, value]) => (
                  <div key={name} className="grid grid-cols-2 gap-3 py-2.5">
                    <dt className="text-muted-foreground">{name}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <ProductReviews
          productId={product._id}
          rating={product.rating}
          breakdown={ratingBreakdown}
        />

        <ProductRail
          title="You may also like"
          subtitle="Similar products from the marketplace"
          products={related.data ?? []}
          loading={related.isPending}
        />

        <ProductRail title="Recently viewed" products={recentlyViewed} />
      </PageContainer>
    </SiteLayout>
  );
}
