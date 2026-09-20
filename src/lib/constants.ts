import type { Emirate, OrderStatus, ProductStatus } from "@/lib/types";

export const EMIRATES: Emirate[] = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

export const CATALOG_SORTS = [
  { value: "relevance", label: "Most relevant" },
  { value: "popular", label: "Best sellers" },
  { value: "newest", label: "Newest arrivals" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "discount", label: "Biggest discount" },
] as const;

export const TICKET_CATEGORIES = [
  "Order & Shipping",
  "Payment & Refund",
  "Returns",
  "Vendor Dispute",
  "Account",
  "Technical Support",
  "Other",
] as const;

export const RETURN_REASONS = [
  "Item doesn't match the description",
  "Received a damaged or faulty item",
  "Received the wrong item",
  "Size or fit isn't right",
  "No longer needed",
  "Other",
] as const;

export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery is taking too long",
  "Want to change items or address",
  "Other",
] as const;

/** Tailwind classes for status pills. */
export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  Placed: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  Confirmed: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
  Processing: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Shipped: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  "Out for Delivery": "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300",
  Delivered: "bg-success/12 text-success",
  Cancelled: "bg-destructive/12 text-destructive",
  "Return Requested": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  Returned: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  Refunded: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

export const PRODUCT_STATUS_STYLES: Record<ProductStatus, string> = {
  Draft: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  "Pending Approval": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Active: "bg-success/12 text-success",
  Rejected: "bg-destructive/12 text-destructive",
  Suspended: "bg-destructive/12 text-destructive",
};

export const FULFILMENT_STEPS: OrderStatus[] = [
  "Placed",
  "Confirmed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];
