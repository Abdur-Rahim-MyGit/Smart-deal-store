/** Currency, number and date formatting shared across the storefront and dashboards. */

const currency = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(value: number | null | undefined): string {
  return currency.format(Number(value) || 0);
}

/** "AED 1.2K" style for chart axes and KPI tiles. */
export function formatCompactPrice(value: number): string {
  return `AED ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0)}`;
}

export function discountPercent(price: number, mrp: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function compactCount(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value || 0);
}

export function formatDate(
  value: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(
    "en-AE",
    options ?? { day: "numeric", month: "short", year: "numeric" },
  );
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "just now", "5 min ago", "3 days ago". */
export function timeAgo(value: string | Date): string {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let amount = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [step, name] of units) {
    unit = name;
    if (Math.abs(amount) < step) break;
    amount /= step;
  }
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.round(amount), unit);
}

export function initials(name: string | undefined): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
