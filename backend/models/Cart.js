import mongoose from "mongoose";

const CartLineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantSku: { type: String, required: true, uppercase: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const CartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [CartLineSchema],
    // "Save for later" lines are not priced or reserved
    savedForLater: [CartLineSchema],
  },
  { timestamps: true },
);

const Cart = mongoose.model("Cart", CartSchema);
export default Cart;
