import type { ReactNode } from "react";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/common/status-badge";
import { RatingStars } from "@/components/common/rating-stars";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Read-only review panel so an admin can judge a pending product without leaving the queue. */
export function ProductPreviewPanel({
  product,
  vendorName,
  categoryName,
  actions,
  onClose,
}: {
  product: Product | null;
  vendorName?: string | undefined;
  categoryName?: string | undefined;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);
  const images = product?.images?.length
    ? product.images
    : product?.thumbnail
      ? [product.thumbnail]
      : [];
  const hero = images[Math.min(active, images.length - 1)] ?? product?.thumbnail;
  const specs = Object.entries(product?.specifications ?? {});

  return (
    <Sheet
      open={Boolean(product)}
      onOpenChange={(open) => {
        if (!open) {
          setActive(0);
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[40rem]"
        aria-describedby={undefined}
      >
        {product && (
          <>
            <SheetHeader className="space-y-2 border-b border-border p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={product.status} />
                {product.isFeatured && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Featured
                  </span>
                )}
                {product.isFlashDeal && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Flash deal
                  </span>
                )}
              </div>
              <SheetTitle className="text-base">{product.title}</SheetTitle>
              <SheetDescription>
                {[product.brand, vendorName, categoryName].filter(Boolean).join(" · ")}
              </SheetDescription>
              {product.rejectionReason && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                  <span className="font-semibold">Rejection reason: </span>
                  {product.rejectionReason}
                </p>
              )}
            </SheetHeader>

            <div className="space-y-5 p-5">
              {hero && (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-2xl border border-border bg-muted">
                    <img
                      src={hero}
                      alt={product.title}
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                  {images.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {images.map((image, index) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => setActive(index)}
                          aria-label={`Image ${index + 1}`}
                          className={cn(
                            "h-14 w-14 overflow-hidden rounded-lg border-2 transition-colors",
                            index === active
                              ? "border-foreground"
                              : "border-border hover:border-foreground/40",
                          )}
                        >
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-2xl font-extrabold">
                  {formatPrice(product.price)}
                </span>
                {product.mrp > product.price && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.mrp)}
                    </span>
                    <span className="rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-bold text-success">
                      {product.discountPercent}% off
                    </span>
                  </>
                )}
                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RatingStars value={product.rating.average} size="xs" />
                  {product.rating.count} review{product.rating.count === 1 ? "" : "s"}
                </span>
              </div>

              <section>
                <h3 className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Description
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </section>

              {product.highlights.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    Highlights
                  </h3>
                  <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm">
                    {product.highlights.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Variants ({product.variants.length})
                </h3>
                <div className="mt-1.5 -mx-1 overflow-x-auto px-1">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] text-muted-foreground uppercase">
                        <th className="py-1.5 pr-2 font-bold">SKU</th>
                        <th className="py-1.5 pr-2 font-bold">Options</th>
                        <th className="py-1.5 pr-2 text-right font-bold">Price</th>
                        <th className="py-1.5 text-right font-bold">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {product.variants.map((variant) => (
                        <tr key={variant.sku}>
                          <td className="py-1.5 pr-2 font-mono text-xs">{variant.sku}</td>
                          <td className="py-1.5 pr-2 text-xs">
                            {Object.entries(variant.options ?? {})
                              .map(([name, value]) => `${name}: ${value}`)
                              .join(" · ") || "—"}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">
                            {formatPrice(variant.price)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{variant.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {specs.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    Specifications
                  </h3>
                  <dl className="mt-1.5 divide-y divide-border rounded-xl border border-border">
                    {specs.map(([name, value]) => (
                      <div key={name} className="flex justify-between gap-4 px-3 py-2 text-sm">
                        <dt className="text-muted-foreground">{name}</dt>
                        <dd className="text-right font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p>
                  Total stock: {product.totalStock} · Sold: {product.soldCount}
                </p>
                <p>
                  Submitted {formatDateTime(product.createdAt)} · Updated{" "}
                  {formatDateTime(product.updatedAt)}
                </p>
                {product.tags.length > 0 && <p>Tags: {product.tags.join(", ")}</p>}
              </div>

              <Link
                to="/product/$slug"
                params={{ slug: product.slug }}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open the storefront page
              </Link>
            </div>

            {actions && (
              <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-card/95 p-4 backdrop-blur">
                {actions}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
