import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Info, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageContainer, Breadcrumbs } from "@/components/layout/site-layout";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/product/product-rail";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import type { ProductListing } from "@/lib/types";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist | Smart Deal" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { hydrated, isAuthenticated, wishlist, addToCart } = useStore();
  const [moving, setMoving] = useState(false);
  const guestIds = wishlist.join(",");

  const accountQuery = useQuery({
    queryKey: ["wishlist"],
    queryFn: ({ signal }) =>
      api<{ wishlist: string[]; products: ProductListing[] }>("/cart/wishlist", { signal }).then(
        (response) => response.products,
      ),
    enabled: hydrated && isAuthenticated,
    staleTime: 30_000,
  });

  const guestQuery = useQuery({
    queryKey: ["wishlist-lookup", guestIds],
    queryFn: ({ signal }) =>
      api<{ products: ProductListing[] }>("/products/lookup", {
        query: { ids: guestIds },
        signal,
      }).then((response) => response.products),
    enabled: hydrated && !isAuthenticated && guestIds.length > 0,
    staleTime: 30_000,
  });

  const active = isAuthenticated ? accountQuery : guestQuery;
  const products = active.data ?? [];
  const loading =
    !hydrated ||
    (isAuthenticated ? accountQuery.isPending : guestIds.length > 0 && guestQuery.isPending);

  const readyToMove = products.filter(
    (product) => product.inStock && product.variantCount <= 1 && product.defaultSku,
  );
  const needOptions = products.filter((product) => product.inStock && product.variantCount > 1);

  async function moveAllToCart() {
    setMoving(true);
    let added = 0;
    for (const product of readyToMove) {
      const ok = await addToCart({
        productId: product._id,
        variantSku: product.defaultSku,
        qty: 1,
        title: product.title,
        // One summary toast below instead of one per item
        silent: true,
      });
      if (ok) added += 1;
    }
    setMoving(false);
    if (added > 0) toast.success(`${added} item${added === 1 ? "" : "s"} moved to your cart`);
  }

  return (
    <SiteLayout>
      <PageContainer className="space-y-5 py-5 sm:py-6">
        <Breadcrumbs>
          {[
            <Link key="home" to="/">
              Home
            </Link>,
            "Wishlist",
          ]}
        </Breadcrumbs>

        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Wishlist</h1>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {loading
                ? "Loading your saved items…"
                : `${products.length} item${products.length === 1 ? "" : "s"} saved`}
            </p>
          </div>

          {readyToMove.length > 0 && (
            <Button
              onClick={() => void moveAllToCart()}
              disabled={moving}
              className="rounded-xl font-semibold"
            >
              {moving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-1.5 h-4 w-4" />
              )}
              Move {readyToMove.length} in-stock item{readyToMove.length === 1 ? "" : "s"} to cart
            </Button>
          )}
        </header>

        {!isAuthenticated && hydrated && products.length > 0 && (
          <p className="flex items-start gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your wishlist is saved on this device.{" "}
              <Link
                to="/login"
                search={{ redirect: "/wishlist" }}
                className="font-semibold text-foreground underline underline-offset-4"
              >
                Sign in
              </Link>{" "}
              to sync it across all your devices.
            </span>
          </p>
        )}

        {needOptions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {needOptions.length} item{needOptions.length === 1 ? " has" : "s have"} options to
            choose — open the product page to pick a size or colour.
          </p>
        )}

        {active.isError ? (
          <InlineError message={errorMessage(active.error)} onRetry={() => void active.refetch()} />
        ) : loading ? (
          <ProductGrid products={[]} loading skeletonCount={8} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Tap the heart on any product to keep it here while you decide."
            action={
              <>
                <Button asChild className="rounded-xl font-semibold">
                  <Link to="/search">Start browsing</Link>
                </Button>
                {!isAuthenticated && (
                  <Button asChild variant="outline" className="rounded-xl font-semibold">
                    <Link to="/login" search={{ redirect: "/wishlist" }}>
                      Sign in to see saved items
                    </Link>
                  </Button>
                )}
              </>
            }
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </PageContainer>
    </SiteLayout>
  );
}
