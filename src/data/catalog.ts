/**
 * Smart Deal catalog data layer.
 *
 * Phase 1 seeds the catalog from typed modules. Every consumer reads through the
 * exported selectors below, so migrating to the Cloud database in Phase 2 only
 * changes this file — no component edits required.
 */

import catMakeup from "@/assets/cat-makeup.jpg";
import catSkincare from "@/assets/cat-skincare.jpg";
import catHaircare from "@/assets/cat-haircare.jpg";
import catPerfume from "@/assets/cat-perfume.jpg";
import catElectronics from "@/assets/cat-electronics.jpg";
import catFashion from "@/assets/cat-fashion.jpg";
import catHome from "@/assets/cat-home.jpg";
import catWellness from "@/assets/cat-wellness.jpg";
import heroBeauty from "@/assets/hero-beauty.jpg";
import heroElectronics from "@/assets/hero-electronics.jpg";
import heroFashion from "@/assets/hero-fashion.jpg";

export type CategoryId =
  | "makeup"
  | "skincare"
  | "haircare"
  | "perfume"
  | "electronics"
  | "fashion"
  | "home"
  | "wellness";

export interface Category {
  id: CategoryId;
  name: string;
  tagline: string;
  image: string;
  children: string[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CategoryId;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  stock: number;
  image: string;
  badges?: string[];
  tags: Array<"trending" | "bestseller" | "new" | "deal" | "flash" | "toprated">;
  description: string;
}

export interface Banner {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  tone: "light" | "dark";
}

export interface Brand {
  id: string;
  name: string;
  claim: string;
}

export interface Review {
  id: string;
  name: string;
  city: string;
  rating: number;
  text: string;
  product: string;
}

export const categories: Category[] = [
  {
    id: "makeup",
    name: "Beauty & Makeup",
    tagline: "Lips, eyes, complexion",
    image: catMakeup,
    children: ["Lipstick", "Eyes", "Face", "Nails", "Brushes"],
  },
  {
    id: "skincare",
    name: "Skincare",
    tagline: "Serums, moisturisers, SPF",
    image: catSkincare,
    children: ["Serums", "Moisturisers", "Cleansers", "Sunscreen", "Masks"],
  },
  {
    id: "haircare",
    name: "Hair Care",
    tagline: "Shampoo, oils, styling",
    image: catHaircare,
    children: ["Shampoo", "Conditioner", "Hair Oil", "Styling", "Tools"],
  },
  {
    id: "perfume",
    name: "Perfumes",
    tagline: "Eau de parfum & mists",
    image: catPerfume,
    children: ["For Her", "For Him", "Unisex", "Gift Sets", "Body Mists"],
  },
  {
    id: "electronics",
    name: "Electronics",
    tagline: "Audio, wearables, tech",
    image: catElectronics,
    children: ["Audio", "Wearables", "Mobile", "Accessories", "Smart Home"],
  },
  {
    id: "fashion",
    name: "Fashion",
    tagline: "Apparel & accessories",
    image: catFashion,
    children: ["Women", "Men", "Bags", "Footwear", "Watches"],
  },
  {
    id: "home",
    name: "Home & Kitchen",
    tagline: "Cook, dine, decorate",
    image: catHome,
    children: ["Cookware", "Dining", "Storage", "Decor", "Cleaning"],
  },
  {
    id: "wellness",
    name: "Health & Wellness",
    tagline: "Supplements & daily care",
    image: catWellness,
    children: ["Supplements", "Oral Care", "Fitness", "Devices", "Mom & Baby"],
  },
];

const categoryImage: Record<CategoryId, string> = {
  makeup: catMakeup,
  skincare: catSkincare,
  haircare: catHaircare,
  perfume: catPerfume,
  electronics: catElectronics,
  fashion: catFashion,
  home: catHome,
  wellness: catWellness,
};

interface Seed {
  name: string;
  brand: string;
  category: CategoryId;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  stock: number;
  tags: Product["tags"];
  badges?: string[];
  description: string;
}

const seeds: Seed[] = [
  // Beauty & Makeup
  { name: "Velvet Matte Lipstick — Rosewood", brand: "Aurelle", category: "makeup", price: 649, mrp: 999, rating: 4.6, reviews: 2148, stock: 64, tags: ["bestseller", "deal"], badges: ["Vegan"], description: "Weightless matte pigment with 10-hour wear and a cushiony shea base that never dries lips out." },
  { name: "Luminous Silk Foundation SPF 25", brand: "Aurelle", category: "makeup", price: 1299, mrp: 1899, rating: 4.5, reviews: 1436, stock: 38, tags: ["trending", "flash"], description: "Buildable medium coverage with a soft-focus finish and broad-spectrum SPF 25 protection." },
  { name: "12-Shade Nude Eyeshadow Palette", brand: "Petal & Pigment", category: "makeup", price: 1099, mrp: 1699, rating: 4.7, reviews: 3204, stock: 51, tags: ["bestseller", "toprated"], badges: ["Cruelty free"], description: "Six mattes and six shimmers milled for buttery blendability, from bare beige to smoked cocoa." },
  { name: "Lift & Curl Volumising Mascara", brand: "Petal & Pigment", category: "makeup", price: 549, mrp: 799, rating: 4.4, reviews: 986, stock: 120, tags: ["deal"], description: "A tapered fibre brush that lifts from the root for smudge-proof volume all day." },
  { name: "Soft Blur Setting Powder", brand: "Aurelle", category: "makeup", price: 899, mrp: 1299, rating: 4.3, reviews: 641, stock: 44, tags: ["new"], description: "Finely milled translucent powder that blurs pores and locks makeup without flashback." },
  { name: "Pro Blend Brush Set of 8", brand: "Studio Nine", category: "makeup", price: 1499, mrp: 2499, rating: 4.6, reviews: 512, stock: 27, tags: ["deal", "flash"], description: "Eight vegan-fibre brushes for base, contour, and eyes in a magnetic travel roll." },

  // Skincare
  { name: "10% Vitamin C Brightening Serum", brand: "Lumen Lab", category: "skincare", price: 899, mrp: 1499, rating: 4.7, reviews: 5127, stock: 88, tags: ["bestseller", "trending", "flash"], badges: ["Dermat tested"], description: "Stabilised ethyl ascorbic acid with ferulic acid to even tone and fade dark spots in 6 weeks." },
  { name: "Hyaluronic Hydra Boost Moisturiser", brand: "Lumen Lab", category: "skincare", price: 749, mrp: 1099, rating: 4.6, reviews: 3418, stock: 132, tags: ["bestseller"], description: "Triple-weight hyaluronic acid gel-cream that holds moisture for 72 hours without a sticky film." },
  { name: "Gentle Amino Foaming Cleanser", brand: "Lumen Lab", category: "skincare", price: 549, mrp: 749, rating: 4.5, reviews: 2210, stock: 96, tags: ["deal"], description: "pH-balanced amino surfactants lift sunscreen and grime while leaving the barrier intact." },
  { name: "Invisible Finish Sunscreen SPF 50 PA++++", brand: "Solstice", category: "skincare", price: 699, mrp: 999, rating: 4.8, reviews: 7841, stock: 210, tags: ["toprated", "bestseller"], badges: ["No white cast"], description: "A weightless hybrid SPF 50 PA++++ fluid that layers cleanly under makeup." },
  { name: "Retinol 0.3% Night Renewal Oil", brand: "Solstice", category: "skincare", price: 1249, mrp: 1899, rating: 4.4, reviews: 1187, stock: 33, tags: ["new", "trending"], description: "Encapsulated retinol with squalane to smooth texture overnight with minimal irritation." },
  { name: "Clay & Charcoal Detox Mask", brand: "Petal & Pigment", category: "skincare", price: 499, mrp: 799, rating: 4.2, reviews: 743, stock: 71, tags: ["deal"], description: "Kaolin and bamboo charcoal draw out congestion in 10 minutes without stripping skin." },

  // Hair Care
  { name: "Repair Complex Shampoo 400ml", brand: "Nordwell", category: "haircare", price: 649, mrp: 899, rating: 4.5, reviews: 1902, stock: 140, tags: ["bestseller"], description: "Sulphate-free wash with bond-repair peptides for chemically treated or heat-stressed hair." },
  { name: "Deep Nourish Conditioner 400ml", brand: "Nordwell", category: "haircare", price: 649, mrp: 899, rating: 4.5, reviews: 1544, stock: 128, tags: ["deal"], description: "Ceramide and murumuru butter conditioner that detangles instantly and cuts frizz." },
  { name: "Cold-Pressed Rosemary Hair Oil", brand: "Nordwell", category: "haircare", price: 449, mrp: 699, rating: 4.6, reviews: 2687, stock: 174, tags: ["trending", "flash"], badges: ["100% natural"], description: "Rosemary, bhringraj, and castor blend to support density with a non-greasy finish." },
  { name: "Ionic Fast-Dry Hair Dryer 1800W", brand: "Volt Nine", category: "haircare", price: 2999, mrp: 4999, rating: 4.4, reviews: 861, stock: 22, tags: ["deal", "flash"], description: "Brushless ionic motor with three heat settings and a cool-shot lock for a salon finish." },
  { name: "Scalp Revive Serum", brand: "Lumen Lab", category: "haircare", price: 899, mrp: 1299, rating: 4.3, reviews: 476, stock: 58, tags: ["new"], description: "Lightweight redensyl and caffeine serum for a balanced, less itchy scalp." },

  // Perfumes
  { name: "Amber Oud Eau de Parfum 100ml", brand: "Maison Solaire", category: "perfume", price: 3499, mrp: 5999, rating: 4.8, reviews: 1345, stock: 19, tags: ["toprated", "bestseller", "flash"], badges: ["Long lasting"], description: "Smoky oud, amber resin, and vanilla bourbon with a 10-hour dry-down." },
  { name: "Citrus Neroli Eau de Parfum 100ml", brand: "Maison Solaire", category: "perfume", price: 2899, mrp: 4499, rating: 4.6, reviews: 902, stock: 31, tags: ["trending"], description: "Bergamot and neroli over white musk — bright, clean, and office-safe." },
  { name: "Velvet Rose Eau de Parfum 50ml", brand: "Maison Solaire", category: "perfume", price: 2199, mrp: 3299, rating: 4.5, reviews: 654, stock: 47, tags: ["deal"], description: "Turkish rose absolute layered with lychee and soft patchouli." },
  { name: "Discovery Set — 5 x 10ml", brand: "Maison Solaire", category: "perfume", price: 1799, mrp: 2999, rating: 4.7, reviews: 388, stock: 63, tags: ["new", "deal"], badges: ["Gift ready"], description: "Five signature parfums in a magnetic gift box — the easiest way to find your scent." },

  // Electronics
  { name: "Pulse Air ANC Wireless Earbuds", brand: "Volt Nine", category: "electronics", price: 3499, mrp: 6999, rating: 4.5, reviews: 6420, stock: 74, tags: ["bestseller", "flash", "trending"], badges: ["48h battery"], description: "Hybrid active noise cancellation, 48-hour case battery, and low-latency game mode." },
  { name: "Aero Fit Smartwatch 1.85\" AMOLED", brand: "Volt Nine", category: "electronics", price: 4299, mrp: 8999, rating: 4.4, reviews: 3811, stock: 52, tags: ["deal", "trending"], description: "AMOLED always-on display, SpO2 and sleep tracking, 12-day battery, 5ATM water resistance." },
  { name: "Boom Mini Bluetooth Speaker", brand: "Volt Nine", category: "electronics", price: 1999, mrp: 3499, rating: 4.3, reviews: 2287, stock: 118, tags: ["deal"], description: "Passive-radiator bass, IPX7 waterproofing, and 20 hours of playback in a palm-sized shell." },
  { name: "65W GaN Dual-Port Fast Charger", brand: "Volt Nine", category: "electronics", price: 1699, mrp: 2799, rating: 4.6, reviews: 1442, stock: 160, tags: ["bestseller"], description: "Charges a laptop and phone together with GaN III efficiency and foldable pins." },
  { name: "Studio Over-Ear Headphones", brand: "Volt Nine", category: "electronics", price: 6499, mrp: 11999, rating: 4.7, reviews: 987, stock: 26, tags: ["toprated", "new"], description: "40mm drivers, adaptive ANC, and memory-foam cups tuned for long listening sessions." },
  { name: "10000mAh Slim Magnetic Power Bank", brand: "Volt Nine", category: "electronics", price: 1899, mrp: 2999, rating: 4.2, reviews: 1129, stock: 143, tags: ["deal"], description: "Magnetic wireless charging plus 20W USB-C PD in a 12mm aluminium body." },

  // Fashion
  { name: "Structured Leather Tote", brand: "Rue Atelier", category: "fashion", price: 4299, mrp: 7499, rating: 4.6, reviews: 742, stock: 29, tags: ["trending", "deal"], badges: ["Full grain"], description: "Full-grain leather tote with a padded 14-inch laptop sleeve and detachable strap." },
  { name: "Relaxed Linen Overshirt", brand: "Rue Atelier", category: "fashion", price: 2199, mrp: 3499, rating: 4.4, reviews: 517, stock: 66, tags: ["new"], description: "Breathable 100% European linen with a boxy drape that layers year-round." },
  { name: "Polarised Aviator Sunglasses", brand: "Rue Atelier", category: "fashion", price: 1799, mrp: 2999, rating: 4.5, reviews: 1236, stock: 84, tags: ["bestseller"], description: "UV400 polarised lenses in a lightweight titanium frame with adjustable nose pads." },
  { name: "Handwoven Leather Slides", brand: "Rue Atelier", category: "fashion", price: 2499, mrp: 3999, rating: 4.3, reviews: 431, stock: 47, tags: ["deal"], description: "Vegetable-tanned woven uppers on a cushioned cork footbed that moulds to your step." },
  { name: "Minimal Steel Mesh Watch", brand: "Studio Nine", category: "fashion", price: 3799, mrp: 6499, rating: 4.6, reviews: 658, stock: 35, tags: ["toprated", "flash"], description: "Sapphire-coated crystal, 38mm case, and a Milanese mesh band with a magnetic clasp." },

  // Home & Kitchen
  { name: "Stoneware Mug Set of 4", brand: "Hearth & Co", category: "home", price: 1299, mrp: 1999, rating: 4.5, reviews: 892, stock: 92, tags: ["bestseller"], description: "Reactive-glaze stoneware mugs, 350ml each, dishwasher and microwave safe." },
  { name: "Triple-Layer Ceramic Frypan 24cm", brand: "Hearth & Co", category: "home", price: 1899, mrp: 3299, rating: 4.4, reviews: 1174, stock: 58, tags: ["deal", "flash"], description: "PFOA-free ceramic nonstick with an induction base and a stay-cool bakelite handle." },
  { name: "Acacia Wood Serving Board", brand: "Hearth & Co", category: "home", price: 999, mrp: 1699, rating: 4.6, reviews: 402, stock: 74, tags: ["new"], description: "Solid acacia board with a juice groove and oiled finish, ready for cheese or roasts." },
  { name: "Borosilicate Glass Storage — Set of 6", brand: "Hearth & Co", category: "home", price: 1699, mrp: 2799, rating: 4.5, reviews: 653, stock: 88, tags: ["deal"], description: "Oven-to-fridge borosilicate containers with airtight bamboo lids in six sizes." },
  { name: "Aroma Diffuser with Warm Light", brand: "Hearth & Co", category: "home", price: 1499, mrp: 2499, rating: 4.2, reviews: 519, stock: 63, tags: ["trending"], description: "Ultrasonic 300ml diffuser with a 7-hour timer and a dimmable amber night light." },

  // Wellness
  { name: "Daily Multivitamin — 60 Tablets", brand: "Vitalis", category: "wellness", price: 749, mrp: 1199, rating: 4.4, reviews: 2043, stock: 190, tags: ["bestseller"], badges: ["FSSAI approved"], description: "24 essential vitamins and minerals in one daily tablet, formulated for Indian diets." },
  { name: "Marine Collagen Peptides 250g", brand: "Vitalis", category: "wellness", price: 1899, mrp: 2999, rating: 4.5, reviews: 1287, stock: 62, tags: ["trending", "flash"], description: "Hydrolysed type-I collagen with vitamin C for skin elasticity, unflavoured and instant-mix." },
  { name: "Sonic Electric Toothbrush", brand: "Vitalis", category: "wellness", price: 2299, mrp: 3999, rating: 4.6, reviews: 934, stock: 41, tags: ["deal", "toprated"], description: "38,000 strokes a minute, five modes, and a 40-day battery with two brush heads." },
  { name: "Smart Body Composition Scale", brand: "Vitalis", category: "wellness", price: 1599, mrp: 2799, rating: 4.3, reviews: 726, stock: 55, tags: ["new"], description: "Tracks 13 body metrics over Bluetooth with multi-user profiles and trend charts." },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const products: Product[] = seeds.map((seed, index) => ({
  id: `SD-${String(index + 1).padStart(4, "0")}`,
  slug: slugify(seed.name),
  image: categoryImage[seed.category],
  ...seed,
}));

export const brands: Brand[] = [
  { id: "aurelle", name: "Aurelle", claim: "Colour cosmetics" },
  { id: "lumen-lab", name: "Lumen Lab", claim: "Active skincare" },
  { id: "solstice", name: "Solstice", claim: "Sun & barrier care" },
  { id: "nordwell", name: "Nordwell", claim: "Hair repair" },
  { id: "maison-solaire", name: "Maison Solaire", claim: "Fine fragrance" },
  { id: "volt-nine", name: "Volt Nine", claim: "Audio & wearables" },
  { id: "rue-atelier", name: "Rue Atelier", claim: "Everyday luxury" },
  { id: "hearth-co", name: "Hearth & Co", claim: "Home & kitchen" },
  { id: "vitalis", name: "Vitalis", claim: "Health & wellness" },
  { id: "studio-nine", name: "Studio Nine", claim: "Tools & accessories" },
  { id: "petal-pigment", name: "Petal & Pigment", claim: "Clean beauty" },
];

export const banners: Banner[] = [
  {
    id: "beauty",
    eyebrow: "Beauty Week",
    title: "Up to 60% off on glow-getters",
    subtitle: "Serums, palettes and parfums from the labels people actually keep repurchasing.",
    cta: "Shop beauty",
    image: heroBeauty,
    tone: "light",
  },
  {
    id: "electronics",
    eyebrow: "Tech Drop",
    title: "Audio that earns its shelf space",
    subtitle: "ANC earbuds, AMOLED wearables and fast charging — with 2-day Smart Delivery.",
    cta: "Shop electronics",
    image: heroElectronics,
    tone: "dark",
  },
  {
    id: "fashion",
    eyebrow: "New Season",
    title: "Quiet luxury, honestly priced",
    subtitle: "Full-grain leather, European linen and steel mesh, without the boutique markup.",
    cta: "Shop fashion",
    image: heroFashion,
    tone: "light",
  },
];

export const testimonials: Review[] = [
  { id: "r1", name: "Ananya Rao", city: "Bengaluru", rating: 5, text: "The vitamin C serum arrived in 26 hours and the packaging was flawless. Six weeks in and my pigmentation has genuinely faded.", product: "10% Vitamin C Brightening Serum" },
  { id: "r2", name: "Kabir Sheikh", city: "Mumbai", rating: 5, text: "I compared the Pulse Air earbuds against a pair twice the price. The ANC holds up on the metro and the case really does last two days of travel.", product: "Pulse Air ANC Wireless Earbuds" },
  { id: "r3", name: "Meera Iyer", city: "Chennai", rating: 4, text: "Ordered the discovery set as a gift and it looked far more expensive than it cost. Amber Oud is now my mother's signature.", product: "Discovery Set — 5 x 10ml" },
  { id: "r4", name: "Rohan Gupta", city: "Delhi", rating: 5, text: "Returns took one pickup and the refund hit my account the same evening. That is the part most stores get wrong.", product: "Structured Leather Tote" },
  { id: "r5", name: "Sara Menon", city: "Kochi", rating: 5, text: "Finally a sunscreen with no white cast that survives a humid commute. I've reordered three times.", product: "Invisible Finish Sunscreen SPF 50" },
];

/* ---------- selectors ---------- */

export function byTag(tag: Product["tags"][number], limit = 12): Product[] {
  return products.filter((product) => product.tags.includes(tag)).slice(0, limit);
}

export function byCategory(category: CategoryId, limit = 12): Product[] {
  return products.filter((product) => product.category === category).slice(0, limit);
}

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getCategory(id: CategoryId): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function searchProducts(query: string, limit = 8): Product[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return products
    .filter((product) =>
      `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

export function relatedProducts(product: Product, limit = 8): Product[] {
  return products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, limit);
}

export const trendingSearches = [
  "vitamin c serum",
  "anc earbuds",
  "matte lipstick",
  "sunscreen spf 50",
  "leather tote",
  "hair oil",
];

export const collections = [
  { id: "beauty", title: "Beauty Edit", copy: "Editor-approved makeup", category: "makeup" as CategoryId },
  { id: "luxury", title: "Luxury Collection", copy: "Fine fragrance & leather", category: "perfume" as CategoryId },
  { id: "tech", title: "Tech Collection", copy: "Audio, wearables, power", category: "electronics" as CategoryId },
  { id: "skin", title: "Skincare Lab", copy: "Actives that work", category: "skincare" as CategoryId },
  { id: "fashion", title: "Fashion Collection", copy: "Quiet luxury staples", category: "fashion" as CategoryId },
];
