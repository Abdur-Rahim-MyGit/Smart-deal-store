import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Heart, Minus, Plus, Share2, ShieldCheck, Star, Truck, Undo2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { ProductRail } from "@/components/product/product-rail";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCategory, getProduct, relatedProducts } from "@/data/catalog";
import { compactCount, discountPercent, formatPrice } from "@/lib/format";
import { useStore } from "@/context/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$slug")({
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Product unavailable | Smart Deal" }, { name: "robots", content: "noindex" }],
      };
    }
    const { product } = loaderData;
    const title = `${product.name} | Smart Deal`;
    const description = product.description.slice(0, 155);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const [qty, setQty] = useState(1);
  const off = discountPercent(product.price, product.mrp);
  const category = getCategory(product.category);
  const related = useMemo(() => relatedProducts(product), [product]);
  const saved = isWishlisted(product.id);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-16">
        <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span>/</span>
          <span>{category?.name}</span>
          <span>/</span>
          <span className="truncate text-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <div className="overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-soft">
            <img
              src={product.image}
              alt={product.name}
              width={640}
              height={640}
              className="aspect-square w-full rounded-2xl object-cover"
            />
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {product.brand}
              </p>
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{product.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex items-center gap-1 rounded-md bg-success/12 px-2 py-0.5 font-semibold text-success">
                  {product.rating.toFixed(1)}
                  <Star className="h-3.5 w-3.5 fill-current" />
                </span>
                <span className="text-muted-foreground">
                  {compactCount(product.reviews)} verified ratings
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-3xl font-extrabold">
                  {formatPrice(product.price)}
                </span>
                {off > 0 && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">
                      {formatPrice(product.mrp)}
                    </span>
                    <Badge className="rounded-full">{off}% off</Badge>
                  </>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Inclusive of all taxes · free delivery over {formatPrice(499)}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-border p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQty((value) => Math.max(1, value - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold">{qty}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQty((value) => Math.min(product.stock, value + 1))}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="flex-1 rounded-xl font-bold"
                  onClick={() => addToCart(product, qty)}
                >
                  Add to cart
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  aria-label="Save to wishlist"
                  onClick={() => toggleWishlist(product)}
                >
                  <Heart className={cn("h-4 w-4", saved && "fill-destructive text-destructive")} />
                </Button>
                <Button variant="outline" size="icon" className="rounded-xl" aria-label="Share product">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: Truck, label: "Delivered in 2 days" },
                { icon: Undo2, label: "7-day easy returns" },
                { icon: ShieldCheck, label: "100% authentic" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-medium"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">{label}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <h2 className="font-display text-lg font-bold">About this product</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
              {product.badges && product.badges.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {product.badges.map((badge) => (
                    <Badge key={badge} variant="secondary" className="rounded-full">
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-14">
          <ProductRail
            title={`More in ${category?.name}`}
            subtitle="Frequently bought by shoppers viewing this product"
            products={related}
          />
        </div>
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}
