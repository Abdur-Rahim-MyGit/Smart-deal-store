/** Response shapes for the seller endpoints (see backend/API.md → Seller). */

import type { DailyPoint } from "@/components/dashboard/charts";
import type {
  Address,
  BankAccount,
  Emirate,
  OrderItem,
  OrderStatus,
  Paginated,
  PaymentMethod,
  PaymentStatus,
  Product,
  ShippingCode,
  VendorStatus,
} from "@/lib/types";

export type VendorTabId = "overview" | "products" | "orders" | "payouts" | "reviews" | "store";

/** Lets one section hand the seller to another (e.g. low stock → products). */
export interface VendorTabProps {
  onNavigate: (tab: VendorTabId, options?: { lowStock?: boolean | undefined }) => void;
}

/* ---------- Overview ---------- */

export interface VendorBalances {
  clearedEarnings: number;
  onHold: number;
  inProgress: number;
  paidOut: number;
  availableBalance: number;
  holdDays: number;
  minPayout: number;
}

export interface VendorStats extends VendorBalances {
  products: Record<string, number>;
  productCount: number;
  grossSales: number;
  commission: number;
  netEarnings: number;
  unitsSold: number;
  orderCount: number;
  pendingFulfilment: number;
  rating: number;
  reviewCount: number;
}

export interface TopProductRow {
  _id: string;
  title: string;
  thumbnail?: string | undefined;
  units: number;
  revenue: number;
}

export interface LowStockRow {
  _id: string;
  title: string;
  slug: string;
  thumbnail?: string | undefined;
  sku: string;
  stock: number;
}

export interface RecentOrderRow {
  _id: string;
  orderId: string;
  status: OrderStatus;
  createdAt: string;
  emirate?: Emirate | undefined;
  customer?: string | undefined;
  itemCount: number;
  total: number;
}

export interface VendorDashboardResponse {
  vendorStatus?: VendorStatus | undefined;
  stats: VendorStats;
  salesByDay: DailyPoint[];
  topProducts: TopProductRow[];
  lowStock: LowStockRow[];
  recentOrders: RecentOrderRow[];
}

/* ---------- Products ---------- */

export interface VendorProductsResponse extends Paginated {
  products: Product[];
  statusCounts: Record<string, number>;
}

/* ---------- Orders ---------- */

export type VendorOrderView = "to-fulfil" | "shipped" | "delivered" | "cancelled";

export interface VendorOrder {
  _id: string;
  orderId: string;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
  shippingAddress: Address;
  shippingMethod?: { code: ShippingCode; label: string; eta: string } | undefined;
  deliveryInstructions?: string | undefined;
  paymentDetails: { method: PaymentMethod; status: PaymentStatus };
  shippingDetails?:
    | {
        carrier?: string | undefined;
        trackingNumber?: string | undefined;
        shippedAt?: string | undefined;
        deliveredAt?: string | undefined;
      }
    | undefined;
  /** Totals for this seller's lines only. */
  vendorTotal: number;
  vendorEarning: number;
}

export interface VendorOrdersResponse extends Paginated {
  orders: VendorOrder[];
}

/* ---------- Payouts ---------- */

export type PayoutStatus = "Requested" | "Processing" | "Transferred" | "Declined";

export interface Payout {
  _id: string;
  amount: number;
  status: PayoutStatus;
  bankSnapshot?: BankAccount | undefined;
  reference?: string | undefined;
  remarks?: string | undefined;
  processedAt?: string | undefined;
  createdAt: string;
}

export interface VendorPayoutsResponse {
  payouts: Payout[];
  balances: VendorBalances;
  bankAccount: BankAccount;
}

/* ---------- Reviews ---------- */

export interface VendorReview {
  _id: string;
  product: { _id: string; title: string; slug: string; thumbnail?: string | undefined } | null;
  rating: number;
  title?: string | undefined;
  comment: string;
  author: string;
  createdAt: string;
  isVerifiedPurchase?: boolean | undefined;
  vendorResponse?: { comment?: string | undefined; respondedAt?: string | undefined } | undefined;
}

export interface VendorReviewsResponse extends Paginated {
  reviews: VendorReview[];
}
