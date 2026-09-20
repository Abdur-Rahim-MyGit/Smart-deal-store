import mongoose from "mongoose";

export const ORDER_STATUSES = [
  "Placed",
  "Confirmed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
  "Return Requested",
  "Returned",
  "Refunded",
];

// Forward fulfilment pipeline, used to compare how far an order/item has progressed.
export const FULFILMENT_FLOW = [
  "Placed",
  "Confirmed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  variantSku: { type: String, required: true },
  title: { type: String, required: true }, // Snapshot at purchase
  thumbnail: { type: String },
  variantLabel: { type: String },
  options: { type: Map, of: String },
  price: { type: Number, required: true }, // Unit price at purchase (AED)
  mrp: { type: Number },
  qty: { type: Number, required: true, min: 1 },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  commissionRate: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  vendorEarning: { type: Number, default: 0 },
  // Return policy at purchase time. Unset on orders placed before it was recorded.
  returnable: { type: Boolean },
  flashDeal: { type: Boolean }, // Bought during a running flash deal (counts toward its cap)
  status: { type: String, enum: ORDER_STATUSES, default: "Placed" },
  shippedAt: { type: Date },
  carrier: { type: String },
  trackingNumber: { type: String },
});

// Money sent back to the customer: instantly (wallet, card) or by a later bank transfer.
const RefundSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["wallet", "card", "bank"], required: true },
    status: { type: String, enum: ["Processing", "Completed"], default: "Completed" },
    reference: { type: String }, // Gateway or bank transfer reference
    bankAccount: { accountName: { type: String }, iban: { type: String } },
    reason: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

const AddressSnapshotSchema = new mongoose.Schema(
  {
    receiverName: { type: String, required: true },
    receiverPhone: { type: String, required: true },
    emirate: { type: String, required: true },
    area: { type: String, required: true },
    street: { type: String, required: true },
    buildingDetails: { type: String, required: true },
    landmark: { type: String },
  },
  { _id: false },
);

const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, uppercase: true }, // SD-YYYYMMDD-XXXXXX
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [OrderItemSchema],
    shippingAddress: { type: AddressSnapshotSchema, required: true },
    billingAddress: AddressSnapshotSchema,

    shippingMethod: {
      code: { type: String, enum: ["Standard", "Express", "SameDay"], default: "Standard" },
      label: { type: String },
      eta: { type: String },
    },
    deliveryInstructions: { type: String, trim: true, maxlength: 500 },
    couponCode: { type: String },
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },

    pricing: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      shippingFee: { type: Number, required: true },
      codFee: { type: Number, default: 0 },
      taxableSubtotal: { type: Number, required: true },
      vatRate: { type: Number, default: 5 },
      vat: { type: Number, required: true },
      total: { type: Number, required: true },
    },

    paymentDetails: {
      method: { type: String, enum: ["Card", "COD", "Wallet"], required: true },
      status: { type: String, enum: ["Pending", "Paid", "Failed", "Refunded"], default: "Pending" },
      transactionId: { type: String },
      cardBrand: { type: String },
      cardLast4: { type: String },
      paidAt: { type: Date },
    },

    shippingDetails: {
      carrier: { type: String },
      trackingNumber: { type: String },
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
    },

    status: { type: String, enum: ORDER_STATUSES, default: "Placed" },

    statusTimeline: [
      {
        status: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now },
        remarks: { type: String },
      },
    ],

    cancellationReason: { type: String },
    returnDetails: {
      reason: { type: String },
      comments: { type: String },
      photos: [{ type: String }],
      requestedAt: { type: Date },
      resolvedAt: { type: Date },
      resolution: { type: String, enum: ["Approved", "Rejected"] },
      rejectReason: { type: String },
      refundAmount: { type: Number },
      refundMethod: { type: String, enum: ["wallet", "card", "bank"] }, // Customer's choice
      bankAccount: { accountName: { type: String }, iban: { type: String } },
    },
    refunds: [RefundSchema],
  },
  { timestamps: true },
);

OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ "items.vendor": 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ "refunds.status": 1 });

OrderSchema.pre("validate", function () {
  if (this.isNew && this.statusTimeline.length === 0) {
    this.statusTimeline.push({ status: this.status, remarks: "Order placed successfully." });
  }
});

const Order = mongoose.model("Order", OrderSchema);
export default Order;
