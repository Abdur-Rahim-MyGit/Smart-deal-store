import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Banknote,
  Heart,
  Loader2,
  RotateCcw,
  Share2,
  ShoppingCart,
  Store,
  Timer,
  Truck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/common/quantity-stepper";
import { RatingStars } from "@/components/common/rating-stars";
import { useStore } from "@/context/store";
import { estimateShipping, useDisplayPrice, useSettings } from "@/hooks/use-settings";
import { compactCount, discountPercent, formatPrice } from "@/lib/format";
import { EMIRATES } from "@/lib/constants";
import type { Emirate, Product } from "@/lib/types";
import type { VariantSelection } from "@/components/product/variant-selection";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function DeliveryPanel({
  product,
  price,
  weightKg,
}: {
  product: Product;
  price: number;
  weightKg: number;
}) {
  const settings = useSettings();
  const { user } = useStore();
  const defaultEmirate =
    user?.addresses?.find((address) => address.isDefault)?.emirate ??
    user?.addresses?.[0]?.emirate ??
    "Dubai";
  const [emirate, setEmirate] = useState<Emirate>(defaultEmirate);

  useEffect(() => {
    setEmirate(defaultEmirate);
  }, [defaultEmirate]);

  const estimate = estimateShipping(settings, emirate, price, weightKg);
  const sameDay = settings.sameDayEmirates.includes(emirate);

  return (
    <section
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      aria-label="Delivery and returns"
    >
      <div className="space-y-1.5">
        <label htmlFor="delivery-emirate" className="text-sm font-bold">
          Deliver to
        </label>
        <select
          id="delivery-emirate"
          value={emirate}
          onChange={(event) => setEmirate(event.target.value as Emirate)}
          className={selectClass}
        >
          {EMIRATES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2.5 text-sm">
        <li className="flex gap-2.5">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-semibold">
              {estimate.fee === 0
                ? "Free standard delivery"
                : `Standard delivery ${formatPrice(estimate.fee)}`}
            </span>
            <span className="block text-xs text-muted-foreground">
              {estimate.eta}
              {estimate.remainingForFree > 0
                ? ` · Add ${formatPrice(estimate.remainingForFree)} to qualify for free delivery`
                : ""}
            </span>
          </span>
        </li>

        <li className="flex gap-2.5">
          <Timer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-semibold">Express {formatPrice(settings.expressFee)}</span>
            <span className="block text-xs text-muted-foreground">
              {settings.expressEta}
              {sameDay
                ? ` · Same-day ${formatPrice(settings.sameDayFee)} when you order before ${settings.sameDayCutoff}`
                : " · Same-day not available in this emirate"}
            </span>
          </span>
        </li>

        <li className="flex gap-2.5">
          <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-semibold">
              {settings.codEnabled ? "Cash on delivery available" : "Card & wallet payments"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {settings.codEnabled
                ? `${formatPrice(settings.codFee)} handling fee applies at checkout`
                : "Pay securely at checkout"}
            </span>
          </span>
        </li>

        <li className="flex gap-2.5">
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-semibold">
              {product.returnable ? `${settings.returnWindowDays}-day returns` : "Non-returnable"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {product.returnable
                ? "Request a return from your orders after delivery"
                : "This item can't be returned once delivered"}
            </span>
          </span>
        </li>
      </ul>
    </section>
  );
}

/** Price, variants, quantity and the add-to-cart actions. */
export function ProductBuyBox({
  product,
  selection,
  onReviewsClick,
}: {
  product: Product;
  selection: VariantSelection;
  onReviewsClick: () => void;
}) {
  const navigate = useNavigate();
  const settings = useSettings();
  const { addToCart, isWishlisted, toggleWishlist, isAuthenticated } = useStore();
  const { variant, optionNames, valuesFor, selected, select, isValueAvailable } = selection;

  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"cart" | "buy" | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  const displayPrice = useDisplayPrice();
  const price = variant?.price ?? product.price;
  const mrp = variant?.mrp ?? product.mrp;
  const discount = discountPercent(price, mrp);
  const stock = variant?.stock ?? product.totalStock;
  const maxQty = Math.max(1, Math.min(10, stock));
  const saved = isWishlisted(product._id);
  const flashActive =
    product.isFlashDeal &&
    (!product.flashDealEndsAt || new Date(product.flashDealEndsAt).getTime() > Date.now());
  const vendor =
    typeof product.vendor === "object" && product.vendor !== null ? product.vendor : null;

  useEffect(() => {
    setQty((current) => Math.min(Math.max(1, current), maxQty));
  }, [maxQty]);

  useEffect(() => {
    const node = anchor.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setShowSticky(Boolean(entries[0] && !entries[0].isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  async function add(mode: "cart" | "buy"): Promise<boolean> {
    if (!variant || stock <= 0) {
      toast.error("This option is out of stock");
      return false;
    }
    setBusy(mode);
    const ok = await addToCart({
      productId: product._id,
      variantSku: variant.sku,
      qty,
      title: product.title,
    });
    setBusy(null);
    return ok;
  }

  async function buyNow() {
    const ok = await add("buy");
    if (!ok) return;
    if (!isAuthenticated) {
      void navigate({ to: "/login", search: { redirect: "/checkout" } });
      return;
    }
    void navigate({ to: "/checkout" });
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: product.title, text: product.title, url });
        return;
      } catch {
        return; // the shopper dismissed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("We couldn't copy the link");
    }
  }

  const stockLine =
    stock <= 0 ? (
      <span className="font-semibold text-destructive">Out of stock</span>
    ) : stock <= 10 ? (
      <span className="font-semibold text-destructive">Only {stock} left — order soon</span>
    ) : (
      <span className="font-semibold text-success">In stock</span>
    );

  return (
    <div ref={anchor} className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/search"
            search={{ brand: product.brand }}
            className="text-xs font-bold tracking-wide text-muted-foreground uppercase hover:text-foreground hover:underline"
          >
            {product.brand}
          </Link>
          {flashActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold text-ink-foreground">
              <Zap className="h-3 w-3" /> Flash deal
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl leading-tight font-extrabold sm:text-3xl">
          {product.title}
        </h1>

        <button
          type="button"
          onClick={onReviewsClick}
          className="flex items-center gap-2 text-sm hover:underline"
          aria-label={`${product.rating.average.toFixed(1)} out of 5 from ${product.rating.count} reviews — read reviews`}
        >
          <RatingStars value={product.rating.average} size="md" />
          <span className="font-semibold">{product.rating.average.toFixed(1)}</span>
          <span className="text-muted-foreground">
            {product.rating.count > 0
              ? `(${compactCount(product.rating.count)} review${product.rating.count === 1 ? "" : "s"})`
              : "(no reviews yet)"}
          </span>
          {product.soldCount > 0 && (
            <span className="text-muted-foreground">· {compactCount(product.soldCount)} sold</span>
          )}
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-3xl font-extrabold">
            {formatPrice(displayPrice.display(price))}
          </span>
          {mrp > price && (
            <span className="text-base text-muted-foreground line-through">
              {formatPrice(displayPrice.display(mrp))}
            </span>
          )}
          {discount > 0 && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
              Save {discount}%
            </span>
          )}
        </div>
        {settings.vatEnabled && (
          <p className="text-xs text-muted-foreground">
            {displayPrice.inclusive
              ? `Price includes ${settings.vatPercent}% VAT`
              : `Prices exclude ${settings.vatPercent}% VAT`}
          </p>
        )}
      </div>

      {optionNames.map((name) => {
        const values = valuesFor(name);
        return (
          <fieldset key={name} className="space-y-2">
            <legend className="text-sm font-bold">
              {name}:{" "}
              <span className="font-medium text-muted-foreground">
                {selected[name] ?? "Choose"}
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const active = selected[name] === value;
                const available = isValueAvailable(name, value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => select(name, value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors",
                      active ? "border-foreground bg-accent" : "border-border hover:bg-accent",
                      !available && "text-muted-foreground line-through opacity-60",
                    )}
                  >
                    {value}
                    {!available && <span className="sr-only"> (sold out)</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <QuantityStepper value={qty} onChange={setQty} min={1} max={maxQty} disabled={stock <= 0} />
        {stockLine}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Button
          size="lg"
          onClick={() => void add("cart")}
          disabled={stock <= 0 || busy !== null}
          className="h-12 rounded-xl text-base font-bold"
        >
          {busy === "cart" ? (
            <Loader2 className="mr-1.5 h-5 w-5 animate-spin" />
          ) : (
            <ShoppingCart className="mr-1.5 h-5 w-5" />
          )}
          {stock > 0 ? "Add to cart" : "Out of stock"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => void buyNow()}
          disabled={stock <= 0 || busy !== null}
          className="h-12 rounded-xl text-base font-bold"
        >
          {busy === "buy" && <Loader2 className="mr-1.5 h-5 w-5 animate-spin" />}
          Buy now
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void toggleWishlist(product._id, product.title)}
          aria-pressed={saved}
          className="rounded-xl font-semibold"
        >
          <Heart className={cn("mr-1.5 h-4 w-4", saved && "fill-destructive text-destructive")} />
          {saved ? "Saved" : "Save for later"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void share()}
          className="rounded-xl font-semibold"
        >
          <Share2 className="mr-1.5 h-4 w-4" /> Share
        </Button>
      </div>

      <DeliveryPanel
        product={product}
        price={price * qty}
        weightKg={(variant?.weightKg ?? 0) * qty}
      />

      {vendor && (
        <section
          className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
          aria-label="Seller"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Store className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Sold by</p>
            {vendor.isPlatform ? (
              <p className="truncate text-sm font-bold">{vendor.name}</p>
            ) : (
              <Link
                to="/search"
                search={{ vendor: vendor._id }}
                className="block truncate text-sm font-bold hover:underline"
              >
                {vendor.name}
              </Link>
            )}
            {vendor.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {vendor.description}
              </p>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold text-success">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        </section>
      )}

      {showSticky && (
        <div className="fixed inset-x-0 bottom-[57px] z-40 border-t border-border bg-card/95 px-4 py-2.5 shadow-lift backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">{product.title}</p>
              <p className="font-display text-lg leading-tight font-extrabold">
                {formatPrice(displayPrice.display(price))}
              </p>
            </div>
            <Button
              onClick={() => void add("cart")}
              disabled={stock <= 0 || busy !== null}
              className="h-11 shrink-0 rounded-xl px-5 font-bold"
            >
              {busy === "cart" ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-1.5 h-4 w-4" />
              )}
              {stock > 0 ? "Add to cart" : "Sold out"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
