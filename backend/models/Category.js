import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    description: { type: String },
    icon: { type: String },
    image: { type: String }, // Tile image shown on the storefront
    banner: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    commissionRate: { type: Number, required: true, default: 10, min: 0, max: 100 },
  },
  { timestamps: true },
);

const Category = mongoose.model("Category", CategorySchema);
export default Category;
