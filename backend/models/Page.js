import mongoose from "mongoose";

// CMS page (About, FAQ, policies). Content is plain text with light markup:
// "## " headings, "- " bullets, blank lines between paragraphs.
const PageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, trim: true },
    content: { type: String, default: "" },
    // Optional Arabic version, shown right-to-left when a shopper switches language.
    titleAr: { type: String, trim: true, default: "" },
    summaryAr: { type: String, trim: true, default: "" },
    contentAr: { type: String, default: "" },
    footerGroup: { type: String, enum: ["Help", "Company", "Policies", "None"], default: "None" },
    sortOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Page = mongoose.model("Page", PageSchema);
export default Page;
