import type {
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShippingCode,
} from "@/lib/types";

/**
 * `GET /orders/my` returns a trimmed projection of each order (see
 * orderController.getMyOrders), so list views use this shape rather than `Order`.
 */
export interface OrderSummary {
  _id: string;
  orderId: string;
  status: OrderStatus;
  items: OrderItem[];
  pricing: { total: number };
  paymentDetails: { method: PaymentMethod; status: PaymentStatus };
  shippingMethod?: { code: ShippingCode; label: string; eta: string } | undefined;
  shippingDetails?:
    | {
        carrier?: string | undefined;
        trackingNumber?: string | undefined;
        shippedAt?: string | undefined;
        deliveredAt?: string | undefined;
      }
    | undefined;
  createdAt: string;
}

export interface MyOrdersResponse {
  orders: OrderSummary[];
  total: number;
  page: number;
  pages: number;
}

export const ORDER_FILTERS = [
  { value: "all", label: "All orders" },
  { value: "active", label: "Active" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled & returned" },
] as const;

export type OrderFilter = (typeof ORDER_FILTERS)[number]["value"];
