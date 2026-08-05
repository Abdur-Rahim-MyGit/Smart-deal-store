/** Currency + number formatting helpers shared across the storefront. */

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return currency.format(value);
}

export function discountPercent(price: number, mrp: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function compactCount(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}
