import mongoose from "mongoose";

const BannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    eyebrow: { type: String, trim: true },
    ctaLabel: { type: String, trim: true, default: "Shop now" },
    imageUrl: { type: String, required: true },
    linkUrl: { type: String, default: "/" },
    position: {
      type: String,
      enum: ["Hero Carousel", "Promo Grid", "Sidebar", "Flash Sale Banner"],
      default: "Hero Carousel",
    },
    tone: { type: String, enum: ["light", "dark"], default: "dark" },
    startDate: { type: Date },
    endDate: { type: Date },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Banner = mongoose.model("Banner", BannerSchema);
export default Banner;
