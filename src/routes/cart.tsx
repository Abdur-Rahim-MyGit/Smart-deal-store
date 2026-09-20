import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageContainer, Breadcrumbs } from "@/components/layout/site-layout";
import { EmptyState } from "@/components/common/empty-state";
import { CartLineRow, SavedLineRow } from "@/components/cart/cart-line-row";
import { CartOrderSummary } from "@/components/cart/order-summary";
import { ProductRail } from "@/components/product/product-rail";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { useSettings } from "@/hooks/use-settings";
import { api, errorMessage } from "@/lib/api";
import type { AppliedCoupon, Emirate, ProductListing } from "@/lib/types";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Shopping cart | Smart Deal" }] }),
  component: CartPage,
});

function CartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex gap-4 p-5">
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-muted" />
            <div className="flex-1 space-y-2.5">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-8 w-28 animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

function CartPage() {
  const {
    cart,
    cartReady,
    isAuthenticated,
    user,
    updateCartQty,
    removeFromCart,
    saveForLater,
    moveToCart,
    removeSaved,
    toggleWishlist,
    isWishlisted,
    guestCartLines,
  } = useStore();
  const settings = useSettings();
  const navigate = useNavigate();

  const defaultEmirate =
    user?.addresses.find((address) => address.isDefault)?.emirate ?? user?.addresses[0]?.emirate;
  const [emirate, setEmirate] = useState<Emirate>(defaultEmirate ?? "Dubai");
  const emirateTouched = useRef(false);

  useEffect(() => {
    if (!emirateTouched.current && defaultEmirate) setEmirate(defaultEmirate);
  }, [defaultEmirate]);

  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const items = cart.items;
  const saved = cart.savedForLater;
  const isEmpty = cartReady && items.length === 0;

  const { data: bestSellers = [], isLoading: loadingBestSellers } = useQuery({
    queryKey: ["products", "best-sellers"],
    queryFn: () =>
      api<{ products: ProductListing[] }>("/products", {
        query: { sort: "popular", limit: 10 },
      }).then((response) => response.products),
    enabled: isEmpty,
    staleTime: 5 * 60 * 1000,
  });

  async function applyCoupon(code: string) {
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const body = isAuthenticated ? { code } : { code, items: guestCartLines() };
      const data = await api<{ coupon: AppliedCoupon; message?: string }>("/coupons/validate", {
        method: "POST",
        body,
      });
      setCoupon(data.coupon);
      toast.success(data.message ?? `Coupon ${data.coupon.code} applied`);
    } catch (error) {
      setCoupon(null);
      setCouponError(errorMessage(error));
      toast.error(errorMessage(error));
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponError(null);
    toast.message("Coupon removed");
  }

  async function moveLineToWishlist(productId: string, variantSku: string, title: string) {
    if (!isWishlisted(productId)) await toggleWishlist(productId, title);
    await removeFromCart(productId, variantSku);
  }

  function goToCheckout() {
    if (!isAuthenticated) {
      void navigate({ to: "/login", search: { redirect: "/checkout" } });
      return;
    }
    void navigate({
      to: "/checkout",
      search: coupon?.code && !coupon.error ? { coupon: coupon.code } : {},
    });
  }

  const blockedReason = cart.summary.hasIssues
    ? "Remove or update the highlighted items before you can check out"
    : items.length === 0
      ? "Your cart is empty"
      : null;

  return (
    <SiteLayout>
      <PageContainer className="py-6 lg:py-8">
        <Breadcrumbs className="mb-4">
          {[
            <Link key="home" to="/">
              Home
            </Link>,
            "Shopping cart",
          ]}
        </Breadcrumbs>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Shopping cart</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {cartReady
                ? items.length === 0
                  ? "No items yet — let's fix that."
                  : `${cart.summary.itemCount} ${cart.summary.itemCount === 1 ? "item" : "items"} ready to check out`
                : "Loading your cart…"}
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl font-semibold">
            <Link to="/">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Continue shopping
            </Link>
          </Button>
        </div>

        {!cartReady ? (
          <CartSkeleton />
        ) : items.length === 0 ? (
          <div className="space-y-10">
            <EmptyState
              icon={ShoppingCart}
              title="Your cart is empty"
              description="Browse best sellers, flash deals and new arrivals — free delivery is only a few items away."
              action={
                <>
                  <Button asChild className="rounded-xl font-semibold">
                    <Link to="/">Continue shopping</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl font-semibold">
                    <Link to="/wishlist">View wishlist</Link>
                  </Button>
                </>
              }
            />

            {saved.length > 0 && (
              <section
                aria-labelledby="saved-heading"
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <h2
                  id="saved-heading"
                  className="flex items-center gap-2 font-display text-lg font-extrabold"
                >
                  <Bookmark className="h-4 w-4" /> Saved for later ({saved.length})
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {saved.map((line) => (
                    <SavedLineRow
                      key={`${line.productId}-${line.variantSku}`}
                      line={line}
                      onMoveToCart={() => moveToCart(line.productId, line.variantSku)}
                      onRemove={() => removeSaved(line.productId, line.variantSku)}
                    />
                  ))}
                </ul>
              </section>
            )}

            <ProductRail
              title="Best sellers this week"
              subtitle="What shoppers across the UAE are buying right now"
              products={bestSellers}
              loading={loadingBestSellers}
            />
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <section
                aria-label="Items in your cart"
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
              >
                <ul className="divide-y divide-border">
                  {items.map((line) => (
                    <CartLineRow
                      key={`${line.productId}-${line.variantSku}`}
                      line={line}
                      canSaveForLater={isAuthenticated}
                      onQtyChange={(qty) => updateCartQty(line.productId, line.variantSku, qty)}
                      onRemove={() => removeFromCart(line.productId, line.variantSku)}
                      onSaveForLater={() => saveForLater(line.productId, line.variantSku)}
                      onMoveToWishlist={() =>
                        moveLineToWishlist(line.productId, line.variantSku, line.title)
                      }
                    />
                  ))}
                </ul>
              </section>

              {saved.length > 0 && (
                <section
                  aria-labelledby="saved-heading"
                  className="rounded-2xl border border-border bg-card p-5 shadow-soft"
                >
                  <h2
                    id="saved-heading"
                    className="flex items-center gap-2 font-display text-lg font-extrabold"
                  >
                    <Bookmark className="h-4 w-4" /> Saved for later ({saved.length})
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Items you parked for another day.
                  </p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {saved.map((line) => (
                      <SavedLineRow
                        key={`${line.productId}-${line.variantSku}`}
                        line={line}
                        onMoveToCart={() => moveToCart(line.productId, line.variantSku)}
                        onRemove={() => removeSaved(line.productId, line.variantSku)}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="lg:sticky lg:top-24">
              <CartOrderSummary
                cart={cart}
                settings={settings}
                emirate={emirate}
                onEmirateChange={(next) => {
                  emirateTouched.current = true;
                  setEmirate(next);
                }}
                coupon={coupon}
                couponError={couponError}
                applyingCoupon={applyingCoupon}
                onApplyCoupon={(code) => void applyCoupon(code)}
                onRemoveCoupon={removeCoupon}
                onCheckout={goToCheckout}
                checkoutLabel={isAuthenticated ? "Proceed to checkout" : "Sign in to check out"}
                blockedReason={blockedReason}
              />
            </div>
          </div>
        )}
      </PageContainer>
    </SiteLayout>
  );
}
