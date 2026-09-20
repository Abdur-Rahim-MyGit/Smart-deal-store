/** Shapes returned by the Smart Deal API (see backend/API.md). */

export type Role = "Customer" | "Vendor" | "Admin";
export type Emirate =
  "Dubai" | "Abu Dhabi" | "Sharjah" | "Ajman" | "Umm Al Quwain" | "Ras Al Khaimah" | "Fujairah";
export type OrderStatus =
  | "Placed"
  | "Confirmed"
  | "Processing"
  | "Shipped"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled"
  | "Return Requested"
  | "Returned"
  | "Refunded";
export type ProductStatus = "Draft" | "Pending Approval" | "Active" | "Rejected" | "Suspended";
export type VendorStatus = "Pending Review" | "Active" | "Rejected" | "Suspended";
export type PaymentMethod = "COD" | "Card" | "Wallet";
export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";
export type ShippingCode = "Standard" | "Express" | "SameDay";
export type AdminPermission =
  | "orders"
  | "products"
  | "customers"
  | "vendors"
  | "marketing"
  | "reviews"
  | "support"
  | "finance"
  | "settings";

export interface Paginated {
  total: number;
  page: number;
  pages: number;
}

/* ---------- Accounts ---------- */

export interface Address {
  _id?: string | undefined;
  receiverName: string;
  receiverPhone: string;
  emirate: Emirate;
  area: string;
  street: string;
  buildingDetails: string;
  landmark?: string | undefined;
  addressType?: "Home" | "Office" | "Other" | undefined;
  isDefault?: boolean | undefined;
}

export interface BankAccount {
  bankName?: string | undefined;
  accountName?: string | undefined;
  accountNumber?: string | undefined;
  iban?: string | undefined;
}

export type VendorDocumentType = "tradeLicense" | "vatCertificate";

export interface VendorDocument {
  originalName?: string | undefined;
  mimeType?: string | undefined;
  size?: number | undefined;
  uploadedAt: string;
  expiresAt?: string | undefined;
}

export interface VendorDetails {
  businessName?: string | undefined;
  tradeLicenseNumber?: string | undefined;
  corporateAddress?: string | undefined;
  vatNumber?: string | undefined;
  storeDescription?: string | undefined;
  supportEmail?: string | undefined;
  supportPhone?: string | undefined;
  bankAccount?: BankAccount | undefined;
  isApproved?: boolean | undefined;
  status?: VendorStatus | undefined;
  rejectionReason?: string | undefined;
  commissionRateOverride?: number | undefined;
  documents?: Partial<Record<VendorDocumentType, VendorDocument>> | undefined;
}

export interface NotificationPrefs {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string | undefined;
  avatar?: string | undefined;
  gender?: "Male" | "Female" | "Prefer not to say" | undefined;
  role: Role;
  status: "Active" | "Blocked";
  isSuperAdmin?: boolean | undefined;
  /** Console areas this admin can view and change. */
  permissions?: AdminPermission[] | undefined;
  /** Console areas this admin can only view. */
  viewPermissions?: AdminPermission[] | undefined;
  adminRole?: string | { _id: string; name: string } | null | undefined;
  /** Two-step sign-in (authenticator app) is on for this account. */
  mfaEnabled?: boolean | undefined;
  authProvider: "local" | "google";
  isVerified: boolean;
  addresses: Address[];
  wishlist: string[];
  notificationPrefs: NotificationPrefs;
  vendorDetails?: VendorDetails | undefined;
  walletBalance: number;
  lastLoginAt?: string | undefined;
  lastActiveAt?: string | undefined;
  signupSource?: string | undefined;
  /** Set when an admin deleted (anonymised) the account. */
  deletedAt?: string | undefined;
  createdAt: string;
}

/* ---------- Catalog ---------- */

export interface CategoryRef {
  _id: string;
  name: string;
  slug: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  parentCategory: string | null;
  description?: string | undefined;
  image?: string | undefined;
  icon?: string | undefined;
  banner?: string | undefined;
  sortOrder: number;
  isActive: boolean;
  commissionRate: number;
  productCount?: number | undefined;
  activeProductCount?: number | undefined;
}

export interface Rating {
  average: number;
  count: number;
}

/** Compact product used by cards, rails and search results. */
export interface ProductListing {
  _id: string;
  slug: string;
  title: string;
  brand: string;
  category: CategoryRef | string | null;
  vendor: { _id: string; name: string } | null;
  thumbnail: string;
  hoverImage: string | null;
  price: number;
  mrp: number;
  discountPercent: number;
  totalStock: number;
  inStock: boolean;
  rating: Rating;
  soldCount: number;
  tags: string[];
  isFeatured: boolean;
  isClearance?: boolean | undefined;
  /** True only while the deal is running (started, not ended, not sold out). */
  isFlashDeal: boolean;
  flashDealEndsAt: string | null;
  flashDealStock?: number | null | undefined;
  flashDealSold?: number | undefined;
  status: ProductStatus;
  createdAt: string;
  defaultSku: string | null;
  variantCount: number;
}

export interface ProductVariant {
  _id?: string | undefined;
  sku: string;
  options: Record<string, string>;
  price: number;
  mrp: number;
  stock: number;
  lowStockThreshold?: number | undefined;
  weightKg?: number | undefined;
  images?: string[] | undefined;
}

/** Full product document (product page, vendor & admin editors). */
export interface Product {
  _id: string;
  slug: string;
  title: string;
  brand: string;
  category: CategoryRef | string;
  subcategory?: CategoryRef | string | null | undefined;
  /** Top-level category down to the product's deepest one (product page only). */
  categoryTrail?: CategoryRef[] | undefined;
  vendor:
    | {
        _id: string;
        name: string;
        email?: string;
        description?: string;
        memberSince?: string;
        isPlatform?: boolean;
      }
    | string
    | null;
  description: string;
  highlights: string[];
  specifications: Record<string, string>;
  thumbnail: string;
  images: string[];
  variants: ProductVariant[];
  tags: string[];
  status: ProductStatus;
  rejectionReason?: string | undefined;
  rating: Rating;
  soldCount: number;
  isFeatured: boolean;
  isBestSeller?: boolean | undefined;
  isNewArrival?: boolean | undefined;
  isClearance?: boolean | undefined;
  isFlashDeal: boolean;
  flashDealStartsAt?: string | null | undefined;
  flashDealEndsAt?: string | null | undefined;
  flashDealStock?: number | null | undefined;
  flashDealSold?: number | undefined;
  returnable: boolean;
  price: number;
  mrp: number;
  discountPercent: number;
  totalStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReview {
  _id: string;
  rating: number;
  title?: string | undefined;
  comment: string;
  isVerifiedPurchase: boolean;
  vendorResponse?: { comment?: string; respondedAt?: string } | undefined;
  createdAt: string;
  author: string;
}

export interface Facets {
  brands: Array<{ name: string; count: number }>;
  priceRange: { min: number; max: number };
  categories: Array<{ slug: string; name: string; count: number }>;
}

/* ---------- Cart & checkout ---------- */

export type CartIssue = "unavailable" | "out_of_stock" | "insufficient_stock";

export interface CartLine {
  productId: string;
  slug?: string | undefined;
  title: string;
  brand?: string | undefined;
  thumbnail?: string | undefined;
  vendorName?: string | undefined;
  variantSku: string;
  variantLabel?: string | undefined;
  options?: Record<string, string> | undefined;
  price: number;
  mrp: number;
  stock: number;
  weightKg?: number | undefined;
  qty: number;
  returnable?: boolean | undefined;
  issue: CartIssue | null;
  isAvailable: boolean;
}

export interface CartData {
  items: CartLine[];
  savedForLater: CartLine[];
  summary: { itemCount: number; subtotal: number; savings: number; hasIssues: boolean };
}

export interface ShippingOption {
  code: ShippingCode;
  label: string;
  fee: number;
  baseFee: number;
  freeThreshold?: number | undefined;
  eta: string;
  available: boolean;
}

export interface AppliedCoupon {
  code: string;
  description?: string | undefined;
  discountType?: "Percentage" | "Fixed" | "Free Shipping" | undefined;
  discount?: number | undefined;
  freeShipping?: boolean | undefined;
  error?: string | undefined;
}

export interface Quote {
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  taxableSubtotal: number;
  vatRate: number;
  vat: number;
  total: number;
  savings: number;
  freeShippingApplied: boolean;
  shippingOptions: ShippingOption[];
  shippingMethod: { code: ShippingCode; label: string; eta: string } | null;
  emirate: Emirate;
  items: CartLine[];
  hasIssues: boolean;
  coupon: AppliedCoupon | null;
  walletBalance: number;
  paymentMethods: Record<PaymentMethod, boolean>;
  cardTestMode: boolean;
}

/* ---------- Orders ---------- */

export interface OrderItem {
  _id: string;
  product: string;
  variantSku: string;
  title: string;
  thumbnail?: string | undefined;
  variantLabel?: string | undefined;
  options?: Record<string, string> | undefined;
  price: number;
  mrp?: number | undefined;
  qty: number;
  vendor: string;
  commissionRate?: number | undefined;
  commission?: number | undefined;
  vendorEarning?: number | undefined;
  status: OrderStatus;
  carrier?: string | undefined;
  trackingNumber?: string | undefined;
}

export interface OrderPricing {
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  taxableSubtotal: number;
  vatRate: number;
  vat: number;
  total: number;
}

export interface TimelineEntry {
  _id?: string | undefined;
  status: string;
  updatedAt: string;
  remarks?: string | undefined;
}

export type RefundMethod = "wallet" | "card" | "bank";

/** Money sent back to the customer for an order. */
export interface OrderRefund {
  _id: string;
  amount: number;
  method: RefundMethod;
  status: "Processing" | "Completed";
  reference?: string | undefined;
  bankAccount?: { accountName?: string | undefined; iban?: string | undefined } | undefined;
  reason?: string | undefined;
  completedAt?: string | undefined;
  createdAt: string;
}

export interface OrderCapabilities {
  canCancel: boolean;
  canReturn: boolean;
  returnWindowEndsAt: string | null;
  /** Delivered items that can be sent back; the rest were non-returnable at purchase. */
  returnableItemIds?: string[] | undefined;
  /** Where this customer's refund can go, given how they paid (first is the default). */
  refundOptions?: RefundMethod[] | undefined;
  canReview: boolean;
  reviewedProductIds: string[];
  allowedNextStatuses: OrderStatus[];
}

export interface Order {
  _id: string;
  orderId: string;
  user: { _id: string; name: string; email?: string; phone?: string } | string;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress?: Address | undefined;
  shippingMethod?: { code: ShippingCode; label: string; eta: string } | undefined;
  deliveryInstructions?: string | undefined;
  couponCode?: string | undefined;
  pricing: OrderPricing;
  paymentDetails: {
    method: PaymentMethod;
    status: PaymentStatus;
    transactionId?: string | undefined;
    cardBrand?: string | undefined;
    cardLast4?: string | undefined;
    paidAt?: string | undefined;
  };
  shippingDetails?:
    | {
        carrier?: string | undefined;
        trackingNumber?: string | undefined;
        shippedAt?: string | undefined;
        deliveredAt?: string | undefined;
      }
    | undefined;
  status: OrderStatus;
  statusTimeline: TimelineEntry[];
  cancellationReason?: string | undefined;
  returnDetails?:
    | {
        reason?: string;
        comments?: string;
        requestedAt?: string;
        resolvedAt?: string;
        resolution?: "Approved" | "Rejected";
        rejectReason?: string;
        refundAmount?: number;
        refundMethod?: RefundMethod;
        bankAccount?: { accountName?: string; iban?: string };
      }
    | undefined;
  refunds?: OrderRefund[] | undefined;
  capabilities?: OrderCapabilities | undefined;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Platform ---------- */

export interface ShippingRule {
  emirate: Emirate;
  fee: number;
  freeThreshold: number;
  eta: string;
  /** Weight the fee covers; each extra kg (rounded up) costs extraPerKg. */
  includedWeightKg?: number | undefined;
  extraPerKg?: number | undefined;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  trn: string;
  announcement: string;
  vatEnabled: boolean;
  vatPercent: number;
  /** Show storefront prices with VAT included. */
  pricesIncludeVat?: boolean | undefined;
  codEnabled: boolean;
  codFee: number;
  walletEnabled: boolean;
  cardEnabled: boolean;
  cardTestMode: boolean;
  shippingMatrix: ShippingRule[];
  expressFee: number;
  expressEta: string;
  sameDayFee: number;
  sameDayEmirates: Emirate[];
  sameDayCutoff: string;
  returnWindowDays: number;
  social: { instagram?: string; facebook?: string; x?: string; youtube?: string };
  googleClientId: string | null;
}

export interface AppNotification {
  _id: string;
  type: "order" | "product" | "payout" | "support" | "account" | "promo" | "stock" | "review";
  title: string;
  message: string;
  link?: string | undefined;
  isRead: boolean;
  createdAt: string;
}

export interface Banner {
  _id: string;
  title: string;
  subtitle?: string | undefined;
  eyebrow?: string | undefined;
  ctaLabel?: string | undefined;
  imageUrl: string;
  linkUrl?: string | undefined;
  position: "Hero Carousel" | "Promo Grid" | "Sidebar" | "Flash Sale Banner";
  tone: "light" | "dark";
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  order: number;
  isActive: boolean;
}

export interface CmsPage {
  _id: string;
  slug: string;
  title: string;
  summary?: string | undefined;
  content?: string | undefined;
  titleAr?: string | undefined;
  summaryAr?: string | undefined;
  contentAr?: string | undefined;
  footerGroup: "Help" | "Company" | "Policies" | "None";
  sortOrder: number;
  isPublished?: boolean | undefined;
  updatedAt?: string | undefined;
}

export interface TicketMessage {
  _id: string;
  sender: { _id: string; name: string; role: Role } | string;
  message: string;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  ticketId: string;
  user: { _id: string; name: string; email: string; role: Role };
  order?: { _id: string; orderId: string } | null | undefined;
  subject: string;
  category: string;
  status: "New" | "Assigned" | "In Progress" | "Resolved" | "Closed";
  priority: "Low" | "Medium" | "High";
  assignedAgent?: { _id: string; name: string } | null | undefined;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface HomeData {
  /** Hero carousel slides. */
  banners: Banner[];
  promoBanners: Banner[];
  flashBanner: Banner | null;
  categories: Category[];
  flashDeals: ProductListing[];
  flashEndsAt: string | null;
  featured: ProductListing[];
  bestSellers: ProductListing[];
  topRated: ProductListing[];
  newArrivals: ProductListing[];
  deals: ProductListing[];
  trending: ProductListing[];
  reviews: Array<{
    _id: string;
    rating: number;
    title?: string;
    comment: string;
    createdAt: string;
    author: string;
    product: { _id: string; title: string; slug: string; thumbnail: string };
  }>;
  brands: Array<{ name: string; count: number; image: string }>;
}
