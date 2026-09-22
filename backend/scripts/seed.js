/**
 * Resets the database and loads a realistic demo marketplace:
 * staff, sellers and customers, a categorised catalogue with variants,
 * order history in every status, verified reviews, coupons, banners,
 * CMS pages, a payout, a support ticket and notifications.
 *
 * Usage: npm run seed   (from /backend)
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { PRIVATE_UPLOAD_DIR } from "../config/paths.js";
import User from "../models/User.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import Coupon from "../models/Coupon.js";
import Banner from "../models/Banner.js";
import Setting from "../models/Setting.js";
import Page from "../models/Page.js";
import Payout from "../models/Payout.js";
import Ticket from "../models/Ticket.js";
import Notification from "../models/Notification.js";
import Subscriber from "../models/Subscriber.js";
import ContactMessage from "../models/ContactMessage.js";
import Brand from "../models/Brand.js";
import AdminRole from "../models/AdminRole.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import Campaign from "../models/Campaign.js";
import { computeTotals } from "../utils/pricing.js";
import { pick, round2, slugify } from "../utils/http.js";
import { variantLabel } from "../utils/catalog.js";
import { computeVendorBalances } from "../services/orderService.js";

dotenv.config();

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const img = (id, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

/** A one-page placeholder PDF standing in for a scanned trade licence. */
function writeSampleLicence(owner) {
  const dir = path.join(PRIVATE_UPLOAD_DIR, "vendor-docs");
  fs.mkdirSync(dir, { recursive: true });
  const text = "Sample trade licence - Smart Deal demo data";
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const file = `seed-${owner}-tradeLicense.pdf`;
  fs.writeFileSync(path.join(dir, file), pdf);
  return {
    file,
    originalName: "trade-licence.pdf",
    mimeType: "application/pdf",
    size: pdf.length,
    uploadedAt: new Date(),
    expiresAt: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
  };
}

// Deterministic randomness so every seed produces the same store.
function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20260916);
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const pickOne = (list) => list[Math.floor(random() * list.length)];
const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  {
    slug: "makeup",
    name: "Beauty & Makeup",
    description: "Lips, eyes, complexion",
    commissionRate: 12,
    image: img("photo-1596704017254-9b121068fb31", 600),
    children: ["Lips", "Eyes", "Face", "Tools"],
  },
  {
    slug: "skincare",
    name: "Skincare",
    description: "Serums, moisturisers, SPF",
    commissionRate: 12,
    image: img("photo-1617897903246-719242758050", 600),
    children: ["Serums", "Moisturisers", "Cleansers", "Sun Care", "Masks"],
  },
  {
    slug: "haircare",
    name: "Hair Care",
    description: "Shampoo, oils, styling",
    commissionRate: 10,
    image: img("photo-1522338140262-f46f5913618a", 600),
    children: ["Shampoo", "Conditioner", "Hair Oil", "Treatments", "Styling Tools"],
  },
  {
    slug: "perfume",
    name: "Perfumes",
    description: "Eau de parfum, oud & oils",
    commissionRate: 15,
    image: img("photo-1622618991746-fe6004db3a47", 600),
    children: ["Unisex", "Perfume Oils", "Gift Sets"],
  },
  {
    slug: "electronics",
    name: "Electronics",
    description: "Audio, wearables, charging",
    commissionRate: 8,
    image: img("photo-1498049794561-7780e7231661", 600),
    children: ["Audio", "Wearables", "Chargers & Cables"],
  },
  {
    slug: "fashion",
    name: "Fashion",
    description: "Bags, apparel & accessories",
    commissionRate: 15,
    image: img("photo-1445205170230-053b83016050", 600),
    children: ["Bags", "Men", "Footwear", "Watches", "Eyewear"],
  },
  {
    slug: "home",
    name: "Home & Kitchen",
    description: "Cook, dine, decorate",
    commissionRate: 10,
    image: img("photo-1586023492125-27b2c045efd7", 600),
    children: ["Cookware", "Dining", "Decor", "Cleaning"],
  },
  {
    slug: "wellness",
    name: "Health & Wellness",
    description: "Supplements & daily care",
    commissionRate: 10,
    image: img("photo-1544367567-0f2fcb009e0b", 600),
    children: ["Supplements", "Oral Care", "Fitness"],
  },
];

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

// vendor: beauty | tech | lifestyle ; v = variants
const PRODUCTS = [
  // Beauty & Makeup
  {
    vendor: "beauty",
    category: "makeup",
    sub: "Lips",
    brand: "Aurelle",
    title: "Velvet Matte Lipstick",
    images: ["photo-1625093742435-6fa192b6fb10"],
    tags: ["bestseller", "deal"],
    featured: true,
    description:
      "A weightless matte lipstick with 10-hour wear and a cushiony shea butter base that never dries lips out. Highly pigmented in one swipe, transfer-resistant and comfortable enough to wear all day in the UAE heat.",
    highlights: [
      "10-hour transfer-resistant wear",
      "Enriched with shea butter & vitamin E",
      "Vegan, cruelty-free and paraben-free",
      "Precision bullet for a crisp lip line",
    ],
    specs: { Finish: "Matte", "Net weight": "3.8 g", "Skin type": "All", Origin: "France" },
    v: [
      { options: { Shade: "Rosewood" }, price: 49, mrp: 79, stock: 64 },
      { options: { Shade: "Ruby Red" }, price: 49, mrp: 79, stock: 38 },
      { options: { Shade: "Warm Nude" }, price: 49, mrp: 79, stock: 3 },
    ],
  },
  {
    vendor: "beauty",
    category: "makeup",
    sub: "Face",
    brand: "Aurelle",
    title: "Luminous Silk Foundation SPF 25",
    images: ["photo-1583209814683-c023dd293cc6"],
    tags: ["trending"],
    flash: true,
    description:
      "Buildable medium coverage with a soft-focus, luminous finish and broad-spectrum SPF 25. The breathable serum texture evens tone without clogging pores.",
    highlights: [
      "Buildable medium coverage",
      "SPF 25 broad-spectrum protection",
      "Non-comedogenic, oil-free formula",
      "Up to 12 hours of fresh wear",
    ],
    specs: { Finish: "Luminous", Coverage: "Medium, buildable", Volume: "30 ml", SPF: "25" },
    v: [
      { options: { Shade: "110 Ivory" }, price: 120, mrp: 180, stock: 22 },
      { options: { Shade: "220 Beige" }, price: 120, mrp: 180, stock: 31 },
      { options: { Shade: "330 Honey" }, price: 120, mrp: 180, stock: 18 },
    ],
  },
  {
    vendor: "beauty",
    category: "makeup",
    sub: "Eyes",
    brand: "Petal & Pigment",
    title: "12-Shade Nude Eyeshadow Palette",
    images: ["photo-1596704017254-9b121068fb31", "photo-1583241800698-e8ab01830a07"],
    tags: ["bestseller", "toprated"],
    description:
      "Six mattes and six shimmers milled for buttery blendability, from bare beige to smoked cocoa. Designed for effortless day looks and intense evening smokey eyes.",
    highlights: [
      "6 mattes + 6 shimmers",
      "Crease-proof with primer",
      "Mirror included",
      "Cruelty-free",
    ],
    specs: { Shades: "12", "Net weight": "14.4 g", Finish: "Matte & shimmer" },
    v: [{ options: {}, price: 110, mrp: 160, stock: 51 }],
  },
  {
    vendor: "beauty",
    category: "makeup",
    sub: "Eyes",
    brand: "Petal & Pigment",
    title: "Lift & Curl Volumising Mascara",
    images: ["photo-1631214540553-ff044a3ff1d4"],
    tags: ["deal"],
    description:
      "A tapered fibre brush that lifts lashes from the root for smudge-proof volume that lasts from morning coffee to evening plans.",
    highlights: [
      "Smudge-proof & humidity resistant",
      "Tapered fibre brush",
      "Removes easily with warm water",
    ],
    specs: { Volume: "10 ml", Waterproof: "Humidity resistant" },
    v: [
      { options: { Colour: "Black" }, price: 45, mrp: 75, stock: 120 },
      { options: { Colour: "Brown Black" }, price: 45, mrp: 75, stock: 46 },
    ],
  },
  {
    vendor: "beauty",
    category: "makeup",
    sub: "Eyes",
    brand: "Aurelle",
    title: "Precision Liquid Eyeliner",
    images: ["photo-1631214524020-7e18db9a8f92"],
    tags: ["new"],
    description:
      "An ultra-fine felt tip for sharp wings and tight lines. Intensely black, quick-drying and flake-free for 24 hours.",
    highlights: ["Ultra-fine 0.1 mm tip", "Quick-drying, flake-free", "24-hour wear"],
    specs: { Colour: "Intense black", Volume: "0.6 ml" },
    v: [{ options: {}, price: 39, mrp: 59, stock: 88 }],
  },
  {
    vendor: "beauty",
    category: "makeup",
    sub: "Tools",
    brand: "Studio Nine",
    title: "Pro Blend Brush Set of 8",
    images: ["photo-1596462502278-27bfdc403348"],
    tags: ["deal"],
    flash: true,
    description:
      "Eight vegan-fibre brushes for base, contour and eyes, packed in a magnetic travel roll. Soft, dense and easy to clean.",
    highlights: ["8 essential brushes", "Ultra-soft vegan fibres", "Magnetic travel roll included"],
    specs: { Pieces: "8", "Handle material": "Birch wood", Fibre: "Synthetic vegan" },
    v: [{ options: {}, price: 140, mrp: 240, stock: 27 }],
  },

  // Skincare
  {
    vendor: "beauty",
    category: "skincare",
    sub: "Serums",
    brand: "Lumen Lab",
    title: "10% Vitamin C Brightening Serum",
    images: ["photo-1617897903246-719242758050", "photo-1608571423902-eed4a5ad8108"],
    tags: ["bestseller", "trending"],
    featured: true,
    flash: true,
    description:
      "Stabilised ethyl ascorbic acid with ferulic acid and vitamin E to even skin tone and visibly fade dark spots in six weeks. Lightweight, fast-absorbing and suitable for daily use under SPF.",
    highlights: [
      "10% stabilised vitamin C",
      "Fades dark spots in 6 weeks",
      "Dermatologist tested",
      "Fragrance-free",
    ],
    specs: {
      "Key ingredients": "Ethyl ascorbic acid, ferulic acid, vitamin E",
      "Skin type": "All, incl. sensitive",
      Directions: "2–3 drops every morning before SPF",
    },
    v: [
      { options: { Size: "30 ml" }, price: 89, mrp: 149, stock: 88 },
      { options: { Size: "50 ml" }, price: 129, mrp: 199, stock: 40 },
    ],
  },
  {
    vendor: "beauty",
    category: "skincare",
    sub: "Moisturisers",
    brand: "Lumen Lab",
    title: "Hyaluronic Hydra Boost Moisturiser",
    images: ["photo-1601049541289-9b1b7bbbfe19"],
    tags: ["bestseller"],
    description:
      "A triple-weight hyaluronic acid gel-cream that holds moisture for 72 hours without a sticky film — ideal under air-conditioning all day.",
    highlights: [
      "72-hour hydration",
      "Triple-weight hyaluronic acid",
      "Non-greasy gel-cream texture",
    ],
    specs: { Volume: "50 ml", "Skin type": "Normal to dry" },
    v: [{ options: {}, price: 75, mrp: 109, stock: 132 }],
  },
  {
    vendor: "beauty",
    category: "skincare",
    sub: "Cleansers",
    brand: "Lumen Lab",
    title: "Gentle Amino Foaming Cleanser",
    images: ["photo-1620916566398-39f1143ab7be"],
    tags: ["deal"],
    description:
      "pH-balanced amino-acid surfactants lift sunscreen, makeup and grime while keeping the skin barrier intact.",
    highlights: ["pH 5.5 balanced", "Removes SPF & light makeup", "Soap and sulphate free"],
    specs: { Volume: "150 ml", "Skin type": "All" },
    v: [{ options: {}, price: 55, mrp: 75, stock: 96 }],
  },
  {
    vendor: "beauty",
    category: "skincare",
    sub: "Sun Care",
    brand: "Solstice",
    title: "Invisible Finish Sunscreen SPF 50 PA++++",
    images: ["photo-1629198688000-71f23e745b6e"],
    tags: ["toprated", "bestseller"],
    featured: true,
    description:
      "A weightless hybrid SPF 50 PA++++ fluid that layers cleanly under makeup with zero white cast. Sweat and humidity resistant for the UAE summer.",
    highlights: ["SPF 50 PA++++", "No white cast on any skin tone", "Sweat & humidity resistant"],
    specs: { Volume: "50 ml", Protection: "UVA/UVB broad spectrum", Finish: "Invisible matte" },
    v: [{ options: {}, price: 69, mrp: 99, stock: 210 }],
  },
  {
    vendor: "beauty",
    category: "skincare",
    sub: "Serums",
    brand: "Solstice",
    title: "Retinol 0.3% Night Renewal Oil",
    images: ["photo-1600428877878-1a0fd85beda8"],
    tags: ["new", "trending"],
    description:
      "Encapsulated retinol in a squalane base smooths texture overnight with minimal irritation. Wake up to softer, brighter skin.",
    highlights: ["0.3% encapsulated retinol", "Squalane for comfort", "Beginner friendly"],
    specs: { Volume: "30 ml", Use: "Night only, follow with SPF in the morning" },
    v: [{ options: {}, price: 125, mrp: 189, stock: 33 }],
  },
  {
    vendor: "beauty",
    category: "skincare",
    sub: "Masks",
    brand: "Petal & Pigment",
    title: "Clay & Charcoal Detox Mask",
    images: ["photo-1570172619644-dfd03ed5d881"],
    tags: ["deal"],
    description:
      "Kaolin clay and bamboo charcoal draw out congestion in 10 minutes without stripping the skin.",
    highlights: ["Clears pores in 10 minutes", "Kaolin & bamboo charcoal", "Won't over-dry"],
    specs: { Volume: "100 ml", "Skin type": "Oily & combination" },
    v: [{ options: {}, price: 49, mrp: 79, stock: 71 }],
  },

  // Hair care
  {
    vendor: "beauty",
    category: "haircare",
    sub: "Shampoo",
    brand: "Nordwell",
    title: "Repair Complex Shampoo",
    images: ["photo-1631729371254-42c2892f0e6e"],
    tags: ["bestseller"],
    description:
      "A sulphate-free wash with bond-repair peptides for colour-treated or heat-stressed hair. Protects against hard water build-up.",
    highlights: ["Sulphate-free", "Bond-repair peptides", "Colour safe"],
    specs: { "Hair type": "Damaged, coloured", Scent: "Fig & cedar" },
    v: [
      { options: { Size: "250 ml" }, price: 45, mrp: 59, stock: 90 },
      { options: { Size: "400 ml" }, price: 65, mrp: 89, stock: 140 },
    ],
  },
  {
    vendor: "beauty",
    category: "haircare",
    sub: "Conditioner",
    brand: "Nordwell",
    title: "Deep Nourish Conditioner 400ml",
    images: ["photo-1611930022073-b7a4ba5fcccd"],
    tags: ["deal"],
    description:
      "Ceramides and murumuru butter detangle instantly and cut frizz, leaving hair soft without weighing it down.",
    highlights: ["Instant detangling", "Frizz control in humidity", "Silicone-free"],
    specs: { Volume: "400 ml", "Hair type": "All" },
    v: [{ options: {}, price: 65, mrp: 89, stock: 128 }],
  },
  {
    vendor: "beauty",
    category: "haircare",
    sub: "Hair Oil",
    brand: "Nordwell",
    title: "Cold-Pressed Coconut & Rosemary Hair Oil",
    images: ["photo-1526947425960-945c6e72858f"],
    tags: ["trending"],
    flash: true,
    description:
      "Cold-pressed virgin coconut oil infused with rosemary to nourish the scalp and support thicker-looking hair, with a non-greasy finish.",
    highlights: ["100% natural oils", "Supports hair density", "Use as pre-wash treatment"],
    specs: { Volume: "200 ml", Ingredients: "Coconut oil, rosemary, castor oil" },
    v: [{ options: {}, price: 45, mrp: 69, stock: 174 }],
  },
  {
    vendor: "tech",
    category: "haircare",
    sub: "Styling Tools",
    brand: "Volt Nine",
    title: "Ionic Fast-Dry Hair Dryer 1800W",
    images: ["photo-1522338140262-f46f5913618a"],
    tags: ["deal"],
    flash: true,
    description:
      "A brushless ionic motor with three heat settings and a cool-shot lock for a smooth, salon-style blow-dry in half the time.",
    highlights: [
      "1800 W brushless motor",
      "Ionic frizz control",
      "3 heat / 2 speed settings",
      "UK 3-pin plug",
    ],
    specs: { Power: "1800 W", Warranty: "2 years", "Cable length": "2.5 m" },
    v: [{ options: {}, price: 299, mrp: 499, stock: 22 }],
  },
  {
    vendor: "beauty",
    category: "haircare",
    sub: "Treatments",
    brand: "Lumen Lab",
    title: "Scalp Revive Serum",
    images: ["photo-1608571423539-e951b9b3871e"],
    tags: ["new"],
    description:
      "A lightweight redensyl and caffeine serum for a balanced, less itchy scalp and fuller-looking roots.",
    highlights: ["Redensyl + caffeine", "Leave-in, non-greasy", "Suitable for daily use"],
    specs: { Volume: "50 ml" },
    v: [{ options: {}, price: 89, mrp: 129, stock: 58 }],
  },

  // Perfumes
  {
    vendor: "beauty",
    category: "perfume",
    sub: "Perfume Oils",
    brand: "Maison Solaire",
    title: "Amber Oud Concentrated Perfume Oil",
    images: ["photo-1602928298849-325cec8771c0"],
    tags: ["toprated", "bestseller"],
    featured: true,
    description:
      "Smoky Cambodian oud, amber resin and bourbon vanilla in an alcohol-free concentrated oil. A few drops last well over 12 hours.",
    highlights: ["Alcohol-free perfume oil", "12+ hour longevity", "Hand-blended in Dubai"],
    specs: {
      "Scent family": "Woody oriental",
      "Top notes": "Saffron",
      "Base notes": "Oud, amber, vanilla",
    },
    v: [
      { options: { Size: "6 ml" }, price: 149, mrp: 229, stock: 19 },
      { options: { Size: "12 ml" }, price: 249, mrp: 399, stock: 12 },
    ],
  },
  {
    vendor: "beauty",
    category: "perfume",
    sub: "Unisex",
    brand: "Maison Solaire",
    title: "Citrus Neroli Eau de Parfum",
    images: ["photo-1622618991746-fe6004db3a47"],
    tags: ["trending"],
    description:
      "Bergamot and neroli over white musk — bright, clean and office-friendly, with a soft skin-like dry-down.",
    highlights: ["Fresh citrus aromatic", "Office & daytime friendly", "Recyclable glass bottle"],
    specs: {
      Concentration: "Eau de parfum",
      "Top notes": "Bergamot, neroli",
      "Base notes": "White musk",
    },
    v: [
      { options: { Size: "50 ml" }, price: 219, mrp: 329, stock: 31 },
      { options: { Size: "100 ml" }, price: 289, mrp: 449, stock: 26 },
    ],
  },
  {
    vendor: "beauty",
    category: "perfume",
    sub: "Gift Sets",
    brand: "Maison Solaire",
    title: "Discovery Set — 5 × 10ml",
    images: ["photo-1615634260167-c8cdede054de"],
    tags: ["new", "deal"],
    description:
      "Five signature fragrances in a magnetic gift box — the easiest way to find your scent or surprise someone special.",
    highlights: [
      "5 × 10 ml travel sprays",
      "Gift-ready magnetic box",
      "Includes Amber Oud & Citrus Neroli",
    ],
    specs: { Contents: "5 × 10 ml" },
    v: [{ options: {}, price: 179, mrp: 299, stock: 63 }],
  },

  // Electronics
  {
    vendor: "tech",
    category: "electronics",
    sub: "Audio",
    brand: "Volt Nine",
    title: "Pulse Air ANC Wireless Earbuds",
    images: ["photo-1590658268037-6bf12165a8df", "photo-1606220588913-b3aacb4d2f46"],
    tags: ["bestseller", "trending"],
    featured: true,
    flash: true,
    description:
      "Hybrid active noise cancellation, a 48-hour charging case and low-latency game mode. IPX5 sweat resistance for gym sessions and runs along the Corniche.",
    highlights: [
      "Hybrid ANC up to −35 dB",
      "48 h total battery with case",
      "Bluetooth 5.3 multipoint",
      "IPX5 sweat resistant",
    ],
    specs: {
      Battery: "8 h earbuds / 48 h with case",
      Charging: "USB-C & wireless",
      Warranty: "1 year UAE warranty",
    },
    v: [
      { options: { Colour: "Midnight Black" }, price: 349, mrp: 699, stock: 74 },
      { options: { Colour: "Pearl White" }, price: 349, mrp: 699, stock: 30 },
    ],
  },
  {
    vendor: "tech",
    category: "electronics",
    sub: "Wearables",
    brand: "Volt Nine",
    title: "Aero Fit Smart Band AMOLED",
    images: ["photo-1575311373937-040b8e1fd5b6"],
    tags: ["deal", "trending"],
    description:
      'A 1.62" AMOLED fitness band with SpO2, heart rate and sleep tracking, 14-day battery and 5ATM water resistance.',
    highlights: [
      '1.62" AMOLED display',
      "14-day battery life",
      "100+ workout modes",
      "5ATM water resistant",
    ],
    specs: { Display: '1.62" AMOLED', Battery: "14 days", Compatibility: "iOS & Android" },
    v: [{ options: {}, price: 199, mrp: 349, stock: 52 }],
  },
  {
    vendor: "tech",
    category: "electronics",
    sub: "Audio",
    brand: "Volt Nine",
    title: "Boom Mini Bluetooth Speaker",
    images: ["photo-1589003077984-894e133dabab"],
    tags: ["deal"],
    description:
      "Passive-radiator bass, IPX7 waterproofing and 20 hours of playback in a palm-sized shell — made for beach days.",
    highlights: ["IPX7 waterproof", "20-hour playtime", "Stereo pairing"],
    specs: { Battery: "20 h", Connectivity: "Bluetooth 5.3", Weight: "380 g" },
    v: [{ options: {}, price: 199, mrp: 349, stock: 118 }],
  },
  {
    vendor: "tech",
    category: "electronics",
    sub: "Chargers & Cables",
    brand: "Volt Nine",
    title: "65W GaN Dual-Port Fast Charger",
    images: ["photo-1600490722773-35753aea6332"],
    tags: ["bestseller"],
    description:
      "Charge a laptop and phone together with efficient GaN technology and fold-flat UK pins.",
    highlights: ["65 W USB-C PD", "Charges laptop + phone together", "Fold-flat UK plug"],
    specs: { Output: "65 W max", Ports: "2 × USB-C", Warranty: "18 months" },
    v: [{ options: {}, price: 169, mrp: 279, stock: 160 }],
  },
  {
    vendor: "tech",
    category: "electronics",
    sub: "Audio",
    brand: "Volt Nine",
    title: "Studio Over-Ear Headphones",
    images: ["photo-1505740420928-5e560c06d30e"],
    tags: ["toprated", "new"],
    featured: true,
    description:
      "40 mm drivers, adaptive ANC and memory-foam cups tuned for long listening sessions and long-haul flights.",
    highlights: [
      "Adaptive ANC",
      "40-hour battery",
      "Memory-foam cushions",
      "Foldable with travel case",
    ],
    specs: { Drivers: "40 mm", Battery: "40 h (ANC on)", Warranty: "1 year UAE warranty" },
    v: [{ options: { Colour: "Black" }, price: 649, mrp: 1199, stock: 26 }],
  },
  {
    vendor: "tech",
    category: "electronics",
    sub: "Chargers & Cables",
    brand: "Volt Nine",
    title: "Travel Charging Kit — 30W Adapter + 2m Cable",
    images: ["photo-1583863788434-e58a36330cf0"],
    tags: [],
    description:
      "A compact 30 W USB-C adapter with a 2 m braided cable — everything you need in your carry-on.",
    highlights: ["30 W USB-C PD", "2 m braided cable", "Compact travel size"],
    specs: { Output: "30 W", "Cable length": "2 m" },
    v: [{ options: {}, price: 89, mrp: 139, stock: 143 }],
  },

  // Fashion
  {
    vendor: "lifestyle",
    category: "fashion",
    sub: "Bags",
    brand: "Rue Atelier",
    title: "Structured Leather Handbag",
    images: ["photo-1584917865442-de89df76afd3"],
    tags: ["trending"],
    featured: true,
    description:
      "A full-grain leather handbag with a polished turn-lock, detachable strap and suede-lined interior pockets.",
    highlights: ["Full-grain leather", "Detachable shoulder strap", "Suede-lined interior"],
    specs: { Material: "Full-grain leather", Dimensions: "26 × 18 × 11 cm" },
    v: [{ options: { Colour: "Scarlet" }, price: 429, mrp: 749, stock: 29 }],
  },
  {
    vendor: "lifestyle",
    category: "fashion",
    sub: "Men",
    brand: "Rue Atelier",
    title: "Relaxed Linen Overshirt",
    images: ["photo-1596755094514-f87e34085b2c"],
    tags: ["new"],
    description:
      "Breathable 100% European linen with a boxy drape that layers year-round — cool enough for Dubai evenings.",
    highlights: ["100% European linen", "Relaxed boxy fit", "Pre-washed for softness"],
    specs: { Material: "100% linen", Care: "Machine wash 30°C" },
    v: [
      { options: { Size: "S" }, price: 219, mrp: 349, stock: 12 },
      { options: { Size: "M" }, price: 219, mrp: 349, stock: 24 },
      { options: { Size: "L" }, price: 219, mrp: 349, stock: 20 },
      { options: { Size: "XL" }, price: 219, mrp: 349, stock: 0 },
    ],
  },
  {
    vendor: "lifestyle",
    category: "fashion",
    sub: "Eyewear",
    brand: "Rue Atelier",
    title: "Polarised Round Sunglasses",
    images: ["photo-1511499767150-a48a237f0083"],
    tags: ["bestseller"],
    description: "UV400 polarised lenses in a lightweight metal frame with adjustable nose pads.",
    highlights: ["UV400 polarised lenses", "Lightweight metal frame", "Hard case included"],
    specs: { Protection: "UV400", "Lens width": "50 mm" },
    v: [{ options: {}, price: 179, mrp: 299, stock: 84 }],
  },
  {
    vendor: "lifestyle",
    category: "fashion",
    sub: "Footwear",
    brand: "Rue Atelier",
    title: "Buckle Leather Slides",
    images: ["photo-1603487742131-4160ec999306"],
    tags: ["deal"],
    description:
      "Soft suede straps with adjustable buckles on a cushioned cork footbed that moulds to your step.",
    highlights: ["Contoured cork footbed", "Adjustable buckles", "Suede upper"],
    specs: { Upper: "Suede", Sole: "EVA" },
    v: [
      { options: { Size: "EU 40" }, price: 249, mrp: 399, stock: 9 },
      { options: { Size: "EU 41" }, price: 249, mrp: 399, stock: 14 },
      { options: { Size: "EU 42" }, price: 249, mrp: 399, stock: 11 },
      { options: { Size: "EU 43" }, price: 249, mrp: 399, stock: 7 },
    ],
  },
  {
    vendor: "lifestyle",
    category: "fashion",
    sub: "Watches",
    brand: "Studio Nine",
    title: "Minimal Steel Mesh Watch",
    images: ["photo-1523275335684-37898b6baf30"],
    tags: ["toprated"],
    flash: true,
    description:
      "Sapphire-coated crystal, a 38 mm case and a Milanese mesh band with a magnetic clasp.",
    highlights: ["Sapphire-coated crystal", "Japanese quartz movement", "3 ATM water resistant"],
    specs: { "Case size": "38 mm", Movement: "Japanese quartz", Warranty: "2 years" },
    v: [{ options: {}, price: 379, mrp: 649, stock: 35 }],
  },
  {
    vendor: "lifestyle",
    category: "fashion",
    sub: "Bags",
    brand: "Rue Atelier",
    title: "Woven Straw Summer Bag",
    images: ["photo-1590874103328-eac38a683ce7"],
    tags: ["new"],
    description:
      "A hand-woven straw bag with a leather flap and top handle — the easy finishing touch for brunch and beach clubs.",
    highlights: ["Hand-woven straw", "Leather trims", "Magnetic flap closure"],
    specs: { Dimensions: "30 × 22 × 12 cm" },
    v: [{ options: {}, price: 159, mrp: 229, stock: 40 }],
  },

  // Home & Kitchen
  {
    vendor: "lifestyle",
    category: "home",
    sub: "Dining",
    brand: "Hearth & Co",
    title: "Matte Stoneware Mug Set of 4",
    images: ["photo-1514228742587-6b1558fcca3d"],
    tags: ["bestseller"],
    description: "Minimal matte stoneware mugs, 350 ml each, dishwasher and microwave safe.",
    highlights: ["Set of 4 × 350 ml", "Dishwasher & microwave safe", "Chip-resistant glaze"],
    specs: { Capacity: "350 ml each", Material: "Stoneware" },
    v: [{ options: {}, price: 99, mrp: 149, stock: 92 }],
  },
  {
    vendor: "lifestyle",
    category: "home",
    sub: "Cookware",
    brand: "Hearth & Co",
    title: "Triple-Layer Ceramic Frypan",
    images: ["photo-1592156328697-079f6ee0cfa5"],
    tags: ["deal"],
    flash: true,
    description:
      "PFOA-free ceramic non-stick with an induction-ready base and a stay-cool wooden handle.",
    highlights: ["PFOA & PTFE free", "Induction compatible", "Oven safe to 200°C"],
    specs: { Material: "Aluminium with ceramic coating", Hob: "All incl. induction" },
    v: [
      { options: { Size: "24 cm" }, price: 119, mrp: 199, stock: 58 },
      { options: { Size: "28 cm" }, price: 149, mrp: 239, stock: 36 },
    ],
  },
  {
    vendor: "lifestyle",
    category: "home",
    sub: "Cookware",
    brand: "Hearth & Co",
    title: "Enamelled Cast Iron Casserole 24cm",
    images: ["photo-1590794056226-79ef3a8147e1"],
    tags: ["toprated"],
    featured: true,
    description:
      "Even heat, a self-basting lid and a chip-resistant enamel finish for slow-cooked machboos, stews and fresh bread.",
    highlights: ["4.2 L capacity", "Self-basting lid", "Suitable for all hobs & oven"],
    specs: { Capacity: "4.2 L", Weight: "4.6 kg", Warranty: "Lifetime" },
    v: [{ options: {}, price: 349, mrp: 549, stock: 18 }],
  },
  {
    vendor: "lifestyle",
    category: "home",
    sub: "Dining",
    brand: "Hearth & Co",
    title: "Wood & Ceramic Serveware Set",
    images: ["photo-1610701596061-2ecf227e85b2"],
    tags: ["new"],
    description:
      "Acacia serving boards paired with hand-glazed ceramic bowls — ready for mezze nights and gatherings.",
    highlights: ["2 acacia boards + 3 bowls", "Food-safe oiled finish", "Gift boxed"],
    specs: { Pieces: "5" },
    v: [{ options: {}, price: 189, mrp: 289, stock: 24 }],
  },
  {
    vendor: "lifestyle",
    category: "home",
    sub: "Decor",
    brand: "Hearth & Co",
    title: "Stonewashed Linen Cushion Covers — Set of 2",
    images: ["photo-1616627561950-9f746e330187"],
    tags: ["trending"],
    description: "Soft stonewashed linen covers with hidden zips that get softer with every wash.",
    highlights: ["100% stonewashed linen", "Hidden zip closure", "45 × 45 cm"],
    specs: { Size: "45 × 45 cm", Material: "Linen" },
    v: [
      { options: { Colour: "Terracotta Stripe" }, price: 89, mrp: 139, stock: 44 },
      { options: { Colour: "Sand" }, price: 89, mrp: 139, stock: 38 },
    ],
  },
  {
    vendor: "lifestyle",
    category: "home",
    sub: "Cleaning",
    brand: "Hearth & Co",
    title: "Amber Glass Spray Bottles — Set of 2",
    images: ["photo-1528740561666-dc2479dc08ab"],
    tags: [],
    description:
      "Refillable 500 ml amber glass bottles with trigger sprayers and waterproof labels for a plastic-free cleaning routine.",
    highlights: [
      "2 × 500 ml amber glass",
      "Adjustable mist/stream nozzles",
      "Waterproof labels included",
    ],
    specs: { Capacity: "500 ml each" },
    v: [{ options: {}, price: 49, mrp: 69, stock: 66 }],
  },

  // Health & Wellness
  {
    vendor: "lifestyle",
    category: "wellness",
    sub: "Supplements",
    brand: "Vitalis",
    title: "Daily Multivitamin — 60 Tablets",
    images: ["photo-1584308666744-24d5c474f2ae"],
    tags: ["bestseller"],
    returnable: false,
    description:
      "24 essential vitamins and minerals, including vitamin D3 for indoor lifestyles, in one daily tablet.",
    highlights: ["24 vitamins & minerals", "Vitamin D3 2000 IU", "Halal certified"],
    specs: { Servings: "60", Certification: "Halal" },
    v: [{ options: {}, price: 59, mrp: 89, stock: 190 }],
  },
  {
    vendor: "lifestyle",
    category: "wellness",
    sub: "Supplements",
    brand: "Vitalis",
    title: "Marine Collagen Peptides 250g",
    images: ["photo-1593095948071-474c5cc2989d"],
    tags: ["trending"],
    flash: true,
    returnable: false,
    description:
      "Hydrolysed type-I marine collagen with vitamin C for skin elasticity — unflavoured and instant-mix.",
    highlights: ["10 g collagen per serving", "Unflavoured, mixes instantly", "Halal certified"],
    specs: { Weight: "250 g", Servings: "25" },
    v: [{ options: {}, price: 129, mrp: 189, stock: 62 }],
  },
  {
    vendor: "lifestyle",
    category: "wellness",
    sub: "Oral Care",
    brand: "Vitalis",
    title: "Bamboo Toothbrush — 4 Pack",
    images: ["photo-1607613009820-a29f7bb81c04"],
    tags: ["deal"],
    returnable: false,
    description: "Biodegradable bamboo handles with soft charcoal-infused bristles.",
    highlights: ["Biodegradable handles", "Soft charcoal bristles", "Plastic-free packaging"],
    specs: { Pack: "4 brushes" },
    v: [{ options: {}, price: 29, mrp: 45, stock: 150 }],
  },
  {
    vendor: "lifestyle",
    category: "wellness",
    sub: "Fitness",
    brand: "Vitalis",
    title: "Home Fitness Dumbbell Set — 2 × 5kg",
    images: ["photo-1584735935682-2f2b69dff9d2"],
    tags: ["new"],
    description:
      "Neoprene-coated hex dumbbells that won't roll, plus a resistance skipping rope for full home workouts.",
    highlights: ["2 × 5 kg hex dumbbells", "Anti-roll design", "Skipping rope included"],
    specs: { Weight: "5 kg each", Coating: "Neoprene" },
    v: [{ options: {}, price: 169, mrp: 259, stock: 20 }],
  },
];

const PENDING_PRODUCT = {
  vendor: "beauty",
  category: "skincare",
  sub: "Cleansers",
  brand: "Lumen Lab",
  title: "Rose Water Facial Toner 200ml",
  images: ["photo-1612817288484-6f916006741a"],
  tags: ["new"],
  description:
    "Steam-distilled Taif rose water with glycerin to refresh and prep skin after cleansing.",
  highlights: ["Taif rose water", "Alcohol-free", "Hydrating & soothing"],
  specs: { Volume: "200 ml" },
  v: [{ options: {}, price: 59, mrp: 79, stock: 80 }],
};

/* ------------------------------------------------------------------ */
/* Review copy                                                         */
/* ------------------------------------------------------------------ */

const REVIEW_COPY = {
  makeup: [
    [
      5,
      "Stays put all day",
      "Wore it from a 9am meeting to dinner and only needed one touch-up. The colour is exactly like the photos.",
    ],
    [
      5,
      "My new everyday favourite",
      "Blends in seconds and doesn't settle into fine lines. I've already bought a second one as a backup.",
    ],
    [
      4,
      "Beautiful, slightly pricey",
      "Lovely finish and very comfortable. Knocked off a star only because I wish it came in a bigger size.",
    ],
    [
      3,
      "Good but not perfect",
      "Nice quality for the price, but the shade was a little warmer than I expected on my skin tone.",
    ],
  ],
  skincare: [
    [
      5,
      "Visible results in weeks",
      "My skin looks brighter and more even after about a month. No irritation at all, even with sensitive skin.",
    ],
    [
      5,
      "Perfect for the UAE heat",
      "Lightweight, absorbs quickly and doesn't feel sticky even in humid weather. Sits well under makeup.",
    ],
    [
      4,
      "Really good texture",
      "Works well and feels lovely. Delivery was next day which was a nice surprise.",
    ],
    [
      4,
      "Would repurchase",
      "Gentle and effective. Packaging was sealed and the expiry date was well over a year away.",
    ],
  ],
  haircare: [
    [
      5,
      "Hair feels so soft",
      "Dubai water was wrecking my hair and this has made a big difference in two weeks. Less frizz too.",
    ],
    [4, "Great value", "Smells amazing and lasts a long time. Would love a bigger bottle option."],
    [
      5,
      "Salon results at home",
      "Does exactly what it says. My blow-dries are faster and much smoother now.",
    ],
    [3, "Decent", "It's fine, not life-changing. Does the job for the price."],
  ],
  perfume: [
    [
      5,
      "Compliments everywhere",
      "Lasts all day and I get compliments every time I wear it. Beautifully packaged too.",
    ],
    [
      5,
      "Authentic and long lasting",
      "Still smell it on my scarf the next morning. Arrived well protected.",
    ],
    [
      4,
      "Lovely scent",
      "Gorgeous and sophisticated. Projection is moderate, which I actually prefer for the office.",
    ],
    [4, "Great gift", "Bought it for my sister and she loved it. Gift wrapping looked premium."],
  ],
  electronics: [
    [
      5,
      "Excellent for the price",
      "Compared it against a pair costing twice as much and honestly can't tell the difference. Battery is great.",
    ],
    [
      5,
      "Works perfectly",
      "Paired instantly with my phone and laptop. Delivery to Abu Dhabi took under 48 hours.",
    ],
    [
      4,
      "Very good",
      "Solid build and good sound. The app could be better but the hardware is excellent.",
    ],
    [
      3,
      "Okay",
      "Does the job but the case feels a bit plasticky. Customer support was quick to respond though.",
    ],
  ],
  fashion: [
    [
      5,
      "Better than expected",
      "The quality is excellent and it fits true to size. Looks even better in person.",
    ],
    [
      4,
      "Stylish and comfortable",
      "Really nice piece. The colour is slightly deeper than in the photos but I like it.",
    ],
    [5, "Worth every dirham", "Great craftsmanship. I've worn it constantly since it arrived."],
    [
      4,
      "Good quality",
      "Well made and arrived nicely packed. Exchange for a different size was easy.",
    ],
  ],
  home: [
    [
      5,
      "Beautiful and practical",
      "Looks gorgeous in my kitchen and cleans up easily. Arrived well packed with no damage.",
    ],
    [5, "Great quality", "Heavier and sturdier than I expected. Very happy with this purchase."],
    [4, "Lovely", "Nice finish and good size. Took 3 days to Sharjah which was fine."],
    [4, "Recommended", "Does exactly what I needed. Would buy from this seller again."],
  ],
  wellness: [
    [
      5,
      "Part of my daily routine",
      "Easy to take and I genuinely feel more energetic. Will keep ordering.",
    ],
    [4, "Good product", "No aftertaste and mixes well. Delivery was quick."],
    [5, "Great value", "Much cheaper than the pharmacy and arrived with a long expiry date."],
    [4, "Happy with it", "Does what it says. Subscription option would be nice."],
  ],
};

/* ------------------------------------------------------------------ */
/* CMS pages                                                           */
/* ------------------------------------------------------------------ */

const PAGES = [
  {
    slug: "about-us",
    title: "About Smart Deal",
    footerGroup: "Company",
    sortOrder: 1,
    summary: "The UAE marketplace for authentic beauty, tech and lifestyle essentials.",
    content: `Smart Deal is a UAE-based multi-vendor marketplace connecting shoppers across all seven emirates with trusted local sellers of beauty, electronics, fashion, home and wellness products.

## Our promise
- 100% authentic products from licensed UAE sellers
- Transparent AED pricing with VAT shown at checkout
- Fast delivery across all seven emirates
- 14-day hassle-free returns on eligible items

## For sellers
Every seller on Smart Deal holds a valid UAE trade licence and is reviewed by our team before listing a single product. We handle payments, customer support and returns so sellers can focus on great products.

## Head office
Business Bay, Dubai, United Arab Emirates.`,
  },
  {
    slug: "sell-on-smart-deal",
    title: "Sell on Smart Deal",
    footerGroup: "Company",
    sortOrder: 2,
    summary: "Reach shoppers across the UAE with a fully managed storefront.",
    content: `Grow your business with a storefront that reaches customers in every emirate.

## How it works
- Register as a seller with your trade licence and bank details
- Our team reviews your application, usually within 2 business days
- List products with variants, images and stock levels
- Receive order alerts, pack and hand over to the courier
- Earnings clear 14 days after delivery and can be withdrawn to your UAE bank account

## Commission
Commission is charged per category, from 8% for electronics to 15% for fashion and fragrances. There are no listing fees.

## Ready to start?
Create a seller account from the Register page and choose "Seller".`,
  },
  {
    slug: "faq",
    title: "Frequently Asked Questions",
    footerGroup: "Help",
    sortOrder: 1,
    summary: "Answers about orders, delivery, payments and returns.",
    content: `## How long does delivery take?
Standard delivery takes 24 hours in Dubai and up to 72 hours in the Northern Emirates. Express and same-day options are available at checkout for eligible areas.

## Is delivery free?
Standard delivery is free above AED 150 in Dubai and Sharjah, AED 200 in Abu Dhabi and Ajman, and AED 250 elsewhere.

## Which payment methods do you accept?
Cash on delivery (AED 10 handling fee), your Smart Deal wallet balance, and debit/credit cards.

## Can I cancel my order?
Yes — you can cancel any time before your order is shipped from My Account → Orders. Prepaid orders are refunded to your wallet instantly.

## How do returns work?
Request a return within 14 days of delivery from the order page. Once approved, the refund is credited to your Smart Deal wallet.

## Are prices inclusive of VAT?
Product prices are shown before VAT. The 5% UAE VAT is added to your order total and shown clearly at checkout and on your tax invoice.`,
  },
  {
    slug: "shipping-policy",
    title: "Shipping & Delivery",
    footerGroup: "Help",
    sortOrder: 2,
    summary: "Delivery fees, timelines and free-shipping thresholds by emirate.",
    content: `We deliver to all seven emirates. Fees and timelines depend on your emirate and the delivery speed you choose.

## Standard delivery
- Dubai — AED 15, free over AED 150, within 24 hours
- Abu Dhabi — AED 20, free over AED 200, 24–48 hours
- Sharjah — AED 15, free over AED 150, 24–48 hours
- Ajman — AED 20, free over AED 200, 48 hours
- Umm Al Quwain, Ras Al Khaimah, Fujairah — AED 25, free over AED 250, 48–72 hours

## Express & same day
Express delivery (next business day) costs AED 25. Same-day delivery costs AED 35 for orders placed before 12:00 PM in Dubai, Sharjah and Ajman.

## Tracking
You'll receive a notification when your order ships, and you can follow every step from My Account → Orders.`,
  },
  {
    slug: "returns-and-refunds",
    title: "Returns & Refunds",
    footerGroup: "Help",
    sortOrder: 3,
    summary: "Our 14-day return window and how refunds are issued.",
    content: `## Return window
You can request a return within 14 days of delivery.

## Conditions
- Items must be unused, in original packaging with tags attached
- Personal care, supplements and opened fragrances can't be returned unless faulty

## Refunds
Once your return is approved, the full order amount is credited to your Smart Deal wallet, ready to use on your next order.

## Cancellations
Orders can be cancelled free of charge until they are shipped.`,
  },
  {
    slug: "terms-of-use",
    title: "Terms of Use",
    footerGroup: "Policies",
    sortOrder: 1,
    summary: "The terms that apply when you use Smart Deal.",
    content: `By using Smart Deal you agree to these terms.

## Accounts
You're responsible for keeping your login details secure and for all activity on your account.

## Orders & pricing
All prices are in UAE dirhams (AED). VAT at 5% is applied at checkout. We may cancel orders affected by pricing errors and will refund any payment in full.

## Marketplace sellers
Products are sold by independent, licensed sellers. Smart Deal manages payments, delivery coordination and customer support.

## Governing law
These terms are governed by the laws of the United Arab Emirates and the Emirate of Dubai.`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    footerGroup: "Policies",
    sortOrder: 2,
    summary: "How we collect, use and protect your personal data.",
    content: `We only collect the information we need to run your account and deliver your orders.

## What we collect
- Your name, email, phone number and delivery addresses
- Order history and support conversations

## How we use it
- To process and deliver orders
- To send order updates and, if you opt in, offers
- To prevent fraud and keep the platform secure

## Your choices
You can update your details and notification preferences at any time from My Account.`,
  },
  {
    slug: "authenticity-promise",
    title: "Authenticity Promise",
    footerGroup: "Policies",
    sortOrder: 3,
    summary: "Every product is genuine — or your money back.",
    content: `Every product on Smart Deal comes from a licensed seller that has been verified by our team.

## If something isn't right
If you ever receive a product you believe isn't genuine, contact support within 14 days of delivery and we'll refund you in full after investigation.`,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const FLOW = ["Placed", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered"];
const FLOW_OFFSET_HOURS = [0, 3, 10, 22, 40, 46];
const FLOW_REMARKS = {
  Placed: "Order placed successfully.",
  Confirmed: "Seller confirmed your order.",
  Processing: "Your order is being packed.",
  Shipped: "Handed over to Aramex.",
  "Out for Delivery": "Out for delivery today.",
  Delivered: "Delivered. Enjoy!",
};

const plainOptions = (options) =>
  options instanceof Map ? Object.fromEntries(options) : options || {};
const orderNumber = (date) =>
  `SD-${date.toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

function timelineFor(status, createdAt) {
  const reached =
    status === "Return Requested" ? FLOW.length - 1 : Math.max(0, FLOW.indexOf(status));
  const steps = FLOW.slice(0, reached + 1).map((step, index) => ({
    status: step,
    updatedAt: new Date(createdAt.getTime() + FLOW_OFFSET_HOURS[index] * HOUR),
    remarks: FLOW_REMARKS[step],
  }));
  if (status === "Cancelled") {
    return [
      steps[0],
      {
        status: "Cancelled",
        updatedAt: new Date(createdAt.getTime() + 2 * HOUR),
        remarks: "Cancelled by customer. Reason: Ordered by mistake",
      },
    ];
  }
  if (status === "Return Requested") {
    steps.push({
      status: "Return Requested",
      updatedAt: new Date(createdAt.getTime() + 4 * DAY),
      remarks: "Return requested: Item doesn't match the description",
    });
  }
  return steps;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected — resetting database…");
  await mongoose.connection.dropDatabase();
  await Promise.all(
    [
      User,
      Category,
      Product,
      Order,
      Review,
      Coupon,
      Banner,
      Setting,
      Page,
      Payout,
      Ticket,
      Notification,
      Subscriber,
      ContactMessage,
      Brand,
      AdminRole,
      NotificationTemplate,
      Campaign,
    ].map((model) => model.syncIndexes()),
  );

  const settings = await Setting.getSingleton();
  const now = Date.now();

  /* ---------------- Users ---------------- */
  const admin = await User.create({
    name: "Smart Deal Admin",
    email: "admin@smartdeal.ae",
    phone: "+971501111111",
    password: "adminpassword1234",
    role: "Admin",
    isSuperAdmin: true,
    isVerified: true,
  });
  await User.create({
    name: "Layla Haddad",
    email: "support@smartdeal.ae",
    phone: "+971501111122",
    password: "Support@12345",
    role: "Admin",
    permissions: ["orders", "support", "reviews"],
    isVerified: true,
  });

  const vendorAccounts = {
    beauty: await User.create({
      name: "Ahmed Al Mansoori",
      email: "vendor@smartdeal.ae",
      phone: "+971502222222",
      password: "vendorpassword1234",
      role: "Vendor",
      isVerified: true,
      vendorDetails: {
        businessName: "Al Noor Beauty & Fragrance LLC",
        tradeLicenseNumber: "DED-784512",
        corporateAddress: "Al Quoz Industrial 3, Dubai",
        vatNumber: "100245879600003",
        storeDescription: "Authentic skincare, makeup and hand-blended fragrances since 2012.",
        supportEmail: "care@alnoorbeauty.ae",
        supportPhone: "+97142223344",
        bankAccount: {
          bankName: "Emirates NBD",
          accountName: "Al Noor Beauty & Fragrance LLC",
          accountNumber: "101223344556",
          iban: "AE070331234567890123456",
        },
        isApproved: true,
        status: "Active",
      },
    }),
    tech: await User.create({
      name: "Rashid Karim",
      email: "vendor2@smartdeal.ae",
      phone: "+971502222333",
      password: "Vendor@12345",
      role: "Vendor",
      isVerified: true,
      vendorDetails: {
        businessName: "Volt Nine Electronics Trading",
        tradeLicenseNumber: "SHJ-339021",
        corporateAddress: "Sharjah Airport Free Zone",
        storeDescription: "Audio, wearables and charging gear with official UAE warranty.",
        supportEmail: "support@voltnine.ae",
        bankAccount: {
          bankName: "Mashreq",
          accountName: "Volt Nine Electronics Trading",
          accountNumber: "019100456789",
          iban: "AE460330000019100456789",
        },
        isApproved: true,
        status: "Active",
      },
    }),
    lifestyle: await User.create({
      name: "Mariam Qasim",
      email: "vendor3@smartdeal.ae",
      phone: "+971502222444",
      password: "Vendor@12345",
      role: "Vendor",
      isVerified: true,
      vendorDetails: {
        businessName: "Hearth & Atelier Lifestyle LLC",
        tradeLicenseNumber: "AUH-558812",
        corporateAddress: "Mussafah M-10, Abu Dhabi",
        storeDescription: "Considered fashion, homeware and wellness essentials.",
        bankAccount: {
          bankName: "First Abu Dhabi Bank",
          accountName: "Hearth & Atelier Lifestyle LLC",
          accountNumber: "7011223344",
          iban: "AE350351234567011223344",
        },
        isApproved: true,
        status: "Active",
      },
    }),
  };

  await User.create({
    name: "Noura Saeed",
    email: "newseller@smartdeal.ae",
    phone: "+971502222555",
    password: "Vendor@12345",
    role: "Vendor",
    isVerified: true,
    vendorDetails: {
      businessName: "Desert Rose Crafts",
      tradeLicenseNumber: "RAK-102938",
      corporateAddress: "Al Nakheel, Ras Al Khaimah",
      storeDescription: "Handmade candles, bakhoor and home fragrance.",
      bankAccount: { bankName: "RAKBANK", iban: "AE120400000012345678901" },
      isApproved: false,
      status: "Pending Review",
      documents: { tradeLicense: writeSampleLicence("newseller") },
    },
  });

  const addressFor = (name, phone, emirate, area, street, building) => ({
    receiverName: name,
    receiverPhone: phone,
    emirate,
    area,
    street,
    buildingDetails: building,
    addressType: "Home",
    isDefault: true,
  });

  const fatima = await User.create({
    name: "Fatima Al Suwaidi",
    email: "user@smartdeal.ae",
    phone: "+971503333333",
    password: "userpassword1234",
    role: "Customer",
    isVerified: true,
    walletBalance: 150,
    addresses: [
      addressFor(
        "Fatima Al Suwaidi",
        "+971503333333",
        "Dubai",
        "Dubai Marina",
        "Al Marsa Street",
        "Marina Heights, Apt 1404",
      ),
      {
        receiverName: "Fatima Al Suwaidi",
        receiverPhone: "+971503333333",
        emirate: "Dubai",
        area: "Business Bay",
        street: "Marasi Drive",
        buildingDetails: "Bay Square, Building 7, Office 402",
        landmark: "Opposite Marasi Promenade",
        addressType: "Office",
        isDefault: false,
      },
    ],
  });

  const otherCustomers = await User.create([
    {
      name: "Omar Haddad",
      email: "omar@example.ae",
      phone: "+971504444111",
      password: "Customer@123",
      role: "Customer",
      isVerified: true,
      addresses: [
        addressFor(
          "Omar Haddad",
          "+971504444111",
          "Abu Dhabi",
          "Al Reem Island",
          "Najmat Street",
          "Sky Tower, Apt 2203",
        ),
      ],
    },
    {
      name: "Aisha Rahman",
      email: "aisha@example.ae",
      phone: "+971504444222",
      password: "Customer@123",
      role: "Customer",
      isVerified: true,
      addresses: [
        addressFor(
          "Aisha Rahman",
          "+971504444222",
          "Sharjah",
          "Al Majaz 2",
          "Jamal Abdul Nasser Street",
          "Al Majaz Tower, Apt 905",
        ),
      ],
    },
    {
      name: "Rahul Menon",
      email: "rahul@example.ae",
      phone: "+971504444333",
      password: "Customer@123",
      role: "Customer",
      isVerified: true,
      addresses: [
        addressFor(
          "Rahul Menon",
          "+971504444333",
          "Dubai",
          "Jumeirah Village Circle",
          "District 12",
          "Belgravia Heights, Apt 316",
        ),
      ],
    },
    {
      name: "Sara Khoury",
      email: "sara@example.ae",
      phone: "+971504444444",
      password: "Customer@123",
      role: "Customer",
      isVerified: true,
      addresses: [
        addressFor(
          "Sara Khoury",
          "+971504444444",
          "Ajman",
          "Al Nuaimiya",
          "Sheikh Khalifa Street",
          "Villa 18",
        ),
      ],
    },
    {
      name: "Khalid Bin Zayed",
      email: "khalid@example.ae",
      phone: "+971504444555",
      password: "Customer@123",
      role: "Customer",
      isVerified: true,
      addresses: [
        addressFor(
          "Khalid Bin Zayed",
          "+971504444555",
          "Ras Al Khaimah",
          "Al Hamra Village",
          "Golf Drive",
          "Villa 42",
        ),
      ],
    },
    {
      name: "Priya Nair",
      email: "priya@example.ae",
      phone: "+971504444666",
      password: "Customer@123",
      role: "Customer",
      isVerified: true,
      addresses: [
        addressFor(
          "Priya Nair",
          "+971504444666",
          "Dubai",
          "Al Barsha 1",
          "Hessa Street",
          "Al Barsha Residence, Apt 507",
        ),
      ],
    },
    {
      name: "Hamdan Al Ketbi",
      email: "hamdan@example.ae",
      phone: "+971504444777",
      password: "Customer@123",
      role: "Customer",
      isVerified: true,
      addresses: [
        addressFor(
          "Hamdan Al Ketbi",
          "+971504444777",
          "Fujairah",
          "Dibba",
          "Corniche Road",
          "Villa 7",
        ),
      ],
    },
  ]);
  const customers = [fatima, ...otherCustomers];
  console.log(`✓ ${customers.length} customers, 3 active sellers, 1 pending seller, 2 staff`);

  /* ---------------- Categories ---------------- */
  const categoryBySlug = new Map();
  const subcategoryByKey = new Map();
  for (const [index, entry] of CATEGORIES.entries()) {
    const parent = await Category.create({
      name: entry.name,
      slug: entry.slug,
      description: entry.description,
      image: entry.image,
      commissionRate: entry.commissionRate,
      sortOrder: index,
    });
    categoryBySlug.set(entry.slug, parent);
    for (const [childIndex, childName] of entry.children.entries()) {
      const child = await Category.create({
        name: childName,
        slug: `${entry.slug}-${slugify(childName)}`,
        parentCategory: parent._id,
        commissionRate: entry.commissionRate,
        sortOrder: childIndex,
      });
      subcategoryByKey.set(`${entry.slug}/${childName}`, child);
    }
  }
  console.log(`✓ ${CATEGORIES.length} categories with subcategories`);

  /* ---------------- Products ---------------- */
  const flashEndsAt = new Date(now + 2 * DAY + 5 * HOUR);
  const createProduct = async (definition, index, status = "Active") => {
    const category = categoryBySlug.get(definition.category);
    const code = definition.category.slice(0, 3).toUpperCase();
    const variants = definition.v.map((variant) => {
      const suffix = Object.values(variant.options)
        .map((value) => slugify(value).toUpperCase())
        .join("-");
      return {
        ...variant,
        sku: `SD-${code}-${String(index + 1).padStart(3, "0")}${suffix ? `-${suffix}` : ""}`,
      };
    });
    return Product.create({
      title: definition.title,
      slug: slugify(definition.title),
      vendor: vendorAccounts[definition.vendor]._id,
      brand: definition.brand,
      category: category._id,
      subcategory: subcategoryByKey.get(`${definition.category}/${definition.sub}`)?._id,
      description: definition.description,
      highlights: definition.highlights,
      specifications: definition.specs,
      thumbnail: img(definition.images[0]),
      images: definition.images.map((id) => img(id, 1200)),
      variants,
      tags: definition.tags,
      status,
      isFeatured: Boolean(definition.featured),
      isFlashDeal: Boolean(definition.flash),
      flashDealEndsAt: definition.flash ? flashEndsAt : undefined,
      returnable: definition.returnable !== false,
      // Stagger creation dates so "New arrivals" has a meaningful order
      createdAt: new Date(now - (PRODUCTS.length - index) * 2 * DAY),
    });
  };

  const products = [];
  for (const [index, definition] of PRODUCTS.entries()) {
    const product = await createProduct(definition, index);
    product.$locals.definition = definition;
    products.push(product);
  }
  await createProduct(PENDING_PRODUCT, PRODUCTS.length, "Pending Approval");
  console.log(`✓ ${products.length} live products + 1 awaiting approval`);
  console.log(`✓ ${await Brand.syncFromCatalog()} brands in the directory`);
  console.log(`✓ ${await AdminRole.ensureDefaults()} staff roles`);

  /* ---------------- Orders ---------------- */
  const categoryRates = new Map(
    CATEGORIES.map((entry) => [String(categoryBySlug.get(entry.slug)._id), entry.commissionRate]),
  );

  async function seedOrder({ customer, lines, createdAt, status, paymentMethod, extra = {} }) {
    const address = customer.addresses.find((entry) => entry.isDefault) || customer.addresses[0];
    const priced = lines.map(({ product, variant, qty }) => ({
      product,
      variant,
      qty,
      price: variant.price,
      mrp: variant.mrp,
    }));
    const totals = computeTotals({
      lines: priced,
      settings,
      emirate: address.emirate,
      shippingMethod: "Standard",
      paymentMethod,
      couponResult: null,
    });
    const timeline = timelineFor(status, createdAt);
    const at = (step) => timeline.find((entry) => entry.status === step)?.updatedAt;
    const itemStatus = status === "Return Requested" ? "Delivered" : status;

    const items = priced.map(({ product, variant, qty, price, mrp }) => {
      const rate = categoryRates.get(String(product.category)) ?? 10;
      const gross = round2(price * qty);
      const commission = round2((gross * rate) / 100);
      return {
        product: product._id,
        variantSku: variant.sku,
        title: product.title,
        thumbnail: product.thumbnail,
        variantLabel: variantLabel(variant),
        options: plainOptions(variant.options),
        price,
        mrp,
        qty,
        vendor: product.vendor,
        category: product.category,
        commissionRate: rate,
        commission,
        vendorEarning: round2(gross - commission),
        status: itemStatus,
      };
    });

    const delivered = Boolean(at("Delivered"));
    const cardPaid = paymentMethod === "Card";
    let paymentStatus = cardPaid || (paymentMethod === "COD" && delivered) ? "Paid" : "Pending";
    if (status === "Cancelled" && cardPaid) {
      paymentStatus = "Refunded";
      timeline.push({
        status: "Refunded",
        updatedAt: new Date(createdAt.getTime() + 2 * HOUR),
        remarks: `AED ${totals.total.toFixed(2)} refunded to your Smart Deal wallet.`,
      });
    }

    const order = new Order({
      orderId: orderNumber(createdAt),
      user: customer._id,
      items,
      shippingAddress: pick(address, [
        "receiverName",
        "receiverPhone",
        "emirate",
        "area",
        "street",
        "buildingDetails",
        "landmark",
      ]),
      billingAddress: pick(address, [
        "receiverName",
        "receiverPhone",
        "emirate",
        "area",
        "street",
        "buildingDetails",
        "landmark",
      ]),
      shippingMethod: totals.shippingMethod,
      pricing: pick(totals, [
        "subtotal",
        "discount",
        "shippingFee",
        "codFee",
        "taxableSubtotal",
        "vatRate",
        "vat",
        "total",
      ]),
      paymentDetails: {
        method: paymentMethod,
        status: paymentStatus,
        transactionId: cardPaid
          ? `TEST-${crypto.randomBytes(5).toString("hex").toUpperCase()}`
          : undefined,
        cardBrand: cardPaid ? "Visa" : undefined,
        cardLast4: cardPaid ? "4242" : undefined,
        paidAt: paymentStatus === "Paid" ? (cardPaid ? createdAt : at("Delivered")) : undefined,
      },
      shippingDetails: {
        carrier: at("Shipped") ? "Aramex" : undefined,
        trackingNumber: at("Shipped") ? `ARX${between(10000000, 99999999)}` : undefined,
        shippedAt: at("Shipped"),
        deliveredAt: at("Delivered"),
      },
      status,
      statusTimeline: timeline,
      cancellationReason: status === "Cancelled" ? "Ordered by mistake" : undefined,
      createdAt,
      updatedAt: timeline[timeline.length - 1].updatedAt,
      ...extra,
    });
    await order.save({ timestamps: false });
    return order;
  }

  const variantOf = (product, index = 0) =>
    product.variants[Math.min(index, product.variants.length - 1)];
  const reviewsToCreate = [];

  // Purchase history: every product bought by 2–4 customers, delivered 16–90 days ago.
  const purchases = new Map(customers.map((customer) => [String(customer._id), []]));
  for (const product of products) {
    for (const [position, customer] of shuffle(customers).slice(0, between(2, 4)).entries()) {
      purchases.get(String(customer._id)).push({ product, alwaysReview: position === 0 });
    }
  }

  let historyCount = 0;
  for (const customer of customers) {
    const basket = shuffle(purchases.get(String(customer._id)));
    while (basket.length) {
      const chunk = basket.splice(0, between(1, 3));
      const createdAt = new Date(now - between(16, 90) * DAY - between(0, 20) * HOUR);
      const order = await seedOrder({
        customer,
        createdAt,
        status: "Delivered",
        paymentMethod: random() < 0.55 ? "COD" : "Card",
        lines: chunk.map(({ product }) => ({
          product,
          variant: variantOf(product, between(0, product.variants.length - 1)),
          qty: random() < 0.8 ? 1 : 2,
        })),
      });
      historyCount += 1;
      for (const { product, alwaysReview } of chunk) {
        if (alwaysReview || random() < 0.7)
          reviewsToCreate.push({
            product,
            customer,
            order,
            createdAt: new Date(order.shippingDetails.deliveredAt.getTime() + between(1, 6) * DAY),
          });
      }
    }
  }

  const find = (title) => products.find((product) => product.title === title);
  const [omar, aisha, rahul] = otherCustomers;

  // Demo orders covering every stage of the lifecycle
  await seedOrder({
    customer: fatima,
    createdAt: new Date(now - 3 * DAY),
    status: "Delivered",
    paymentMethod: "Card",
    lines: [
      {
        product: find("Invisible Finish Sunscreen SPF 50 PA++++"),
        variant: variantOf(find("Invisible Finish Sunscreen SPF 50 PA++++")),
        qty: 2,
      },
      {
        product: find("Studio Over-Ear Headphones"),
        variant: variantOf(find("Studio Over-Ear Headphones")),
        qty: 1,
      },
    ],
  });
  await seedOrder({
    customer: fatima,
    createdAt: new Date(now - 30 * HOUR),
    status: "Shipped",
    paymentMethod: "Card",
    lines: [
      {
        product: find("Amber Oud Concentrated Perfume Oil"),
        variant: variantOf(find("Amber Oud Concentrated Perfume Oil"), 1),
        qty: 1,
      },
    ],
  });
  await seedOrder({
    customer: fatima,
    createdAt: new Date(now - 2 * HOUR),
    status: "Placed",
    paymentMethod: "COD",
    lines: [
      {
        product: find("Velvet Matte Lipstick"),
        variant: variantOf(find("Velvet Matte Lipstick")),
        qty: 2,
      },
      {
        product: find("Pulse Air ANC Wireless Earbuds"),
        variant: variantOf(find("Pulse Air ANC Wireless Earbuds")),
        qty: 1,
      },
    ],
  });
  await seedOrder({
    customer: fatima,
    createdAt: new Date(now - 10 * DAY),
    status: "Cancelled",
    paymentMethod: "Card",
    lines: [
      {
        product: find("Minimal Steel Mesh Watch"),
        variant: variantOf(find("Minimal Steel Mesh Watch")),
        qty: 1,
      },
    ],
  });
  await seedOrder({
    customer: omar,
    createdAt: new Date(now - 6 * DAY),
    status: "Return Requested",
    paymentMethod: "COD",
    lines: [
      {
        product: find("Boom Mini Bluetooth Speaker"),
        variant: variantOf(find("Boom Mini Bluetooth Speaker")),
        qty: 1,
      },
    ],
    extra: {
      returnDetails: {
        reason: "Item doesn't match the description",
        comments: "The bass is much weaker than described.",
        requestedAt: new Date(now - 2 * DAY),
      },
    },
  });
  await seedOrder({
    customer: aisha,
    createdAt: new Date(now - 20 * HOUR),
    status: "Processing",
    paymentMethod: "COD",
    lines: [
      {
        product: find("Triple-Layer Ceramic Frypan"),
        variant: variantOf(find("Triple-Layer Ceramic Frypan"), 1),
        qty: 1,
      },
      {
        product: find("Matte Stoneware Mug Set of 4"),
        variant: variantOf(find("Matte Stoneware Mug Set of 4")),
        qty: 1,
      },
    ],
  });
  await seedOrder({
    customer: rahul,
    createdAt: new Date(now - 5 * HOUR),
    status: "Confirmed",
    paymentMethod: "Card",
    lines: [
      {
        product: find("65W GaN Dual-Port Fast Charger"),
        variant: variantOf(find("65W GaN Dual-Port Fast Charger")),
        qty: 2,
      },
    ],
  });
  console.log(`✓ ${historyCount} historical orders + 7 live demo orders`);

  /* ---------------- Reviews ---------------- */
  const reviewed = new Set();
  for (const { product, customer, order, createdAt } of reviewsToCreate) {
    const key = `${product._id}:${customer._id}`;
    if (reviewed.has(key)) continue;
    reviewed.add(key);
    const [rating, title, comment] = pickOne(REVIEW_COPY[product.$locals.definition.category]);
    await Review.create({
      product: product._id,
      user: customer._id,
      order: order._id,
      rating,
      title,
      comment,
      isVerifiedPurchase: true,
      status: "Approved",
      createdAt,
      updatedAt: createdAt,
      ...(random() < 0.25
        ? {
            vendorResponse: {
              comment: "Thank you so much for your feedback — we're glad you're enjoying it!",
              respondedAt: new Date(createdAt.getTime() + DAY),
            },
          }
        : {}),
    });
  }
  // One review waiting in the moderation queue, from a customer who hasn't reviewed that product yet
  const pendingReviewProduct = find("Aero Fit Smart Band AMOLED");
  const pendingReviewer =
    customers.find(
      (customer) =>
        customer !== fatima && !reviewed.has(`${pendingReviewProduct._id}:${customer._id}`),
    ) || fatima;
  const pendingReviewOrder = await seedOrder({
    customer: pendingReviewer,
    createdAt: new Date(now - 25 * DAY),
    status: "Delivered",
    paymentMethod: "COD",
    lines: [{ product: pendingReviewProduct, variant: variantOf(pendingReviewProduct), qty: 1 }],
  });
  await Review.create({
    product: pendingReviewProduct._id,
    user: pendingReviewer._id,
    order: pendingReviewOrder._id,
    rating: 2,
    title: "Strap broke quickly",
    comment:
      "The display is great but the strap clasp broke after three weeks. Hoping the seller can send a replacement.",
    isVerifiedPurchase: true,
    status: "Pending Approval",
  });

  // Ratings and sold counts derived from the data just created
  const ratingRows = await Review.aggregate([
    { $match: { status: "Approved" } },
    { $group: { _id: "$product", average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const soldRows = await Order.aggregate([
    { $match: { status: { $nin: ["Cancelled", "Returned", "Refunded"] } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", sold: { $sum: "$items.qty" } } },
  ]);
  const soldMap = new Map(soldRows.map((row) => [String(row._id), row.sold]));
  const ratingMap = new Map(ratingRows.map((row) => [String(row._id), row]));
  for (const product of products) {
    const rating = ratingMap.get(String(product._id));
    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          "rating.average": rating ? Math.round(rating.average * 10) / 10 : 0,
          "rating.count": rating?.count || 0,
          // Scale history so bestseller ranking looks like a real store
          soldCount: (soldMap.get(String(product._id)) || 0) * between(18, 40),
        },
      },
    );
  }
  console.log(`✓ ${await Review.countDocuments()} reviews (ratings recalculated)`);

  /* ---------------- Payouts ---------------- */
  for (const vendor of Object.values(vendorAccounts)) {
    const balances = await computeVendorBalances(vendor._id, settings);
    const paid = Math.floor((balances.clearedEarnings * 0.45) / 10) * 10;
    if (paid >= settings.minPayout) {
      await Payout.create({
        vendor: vendor._id,
        amount: paid,
        status: "Transferred",
        reference: `FT${between(100000000, 999999999)}`,
        bankSnapshot: pick(vendor.vendorDetails.bankAccount, [
          "bankName",
          "accountName",
          "accountNumber",
          "iban",
        ]),
        processedBy: admin._id,
        processedAt: new Date(now - 9 * DAY),
        createdAt: new Date(now - 11 * DAY),
      });
    }
  }
  const techBalances = await computeVendorBalances(vendorAccounts.tech._id, settings);
  if (techBalances.availableBalance >= settings.minPayout) {
    await Payout.create({
      vendor: vendorAccounts.tech._id,
      amount: Math.floor(techBalances.availableBalance / 2 / 10) * 10 || settings.minPayout,
      status: "Requested",
      bankSnapshot: pick(vendorAccounts.tech.vendorDetails.bankAccount, [
        "bankName",
        "accountName",
        "accountNumber",
        "iban",
      ]),
    });
  }
  console.log("✓ Vendor payouts");

  /* ---------------- Marketing ---------------- */
  const yearStart = new Date(now - 60 * DAY);
  const yearEnd = new Date(now + 365 * DAY);
  await Coupon.create([
    {
      code: "WELCOME10",
      description: "10% off your order (max AED 50)",
      discountType: "Percentage",
      discountValue: 10,
      maxDiscount: 50,
      minOrderValue: 100,
      startDate: yearStart,
      endDate: yearEnd,
      usageLimit: 5000,
      limitPerUser: 1,
    },
    {
      code: "FREESHIP",
      description: "Free standard delivery",
      discountType: "Free Shipping",
      discountValue: 0,
      minOrderValue: 50,
      startDate: yearStart,
      endDate: yearEnd,
      usageLimit: 5000,
      limitPerUser: 3,
    },
    {
      code: "SAVE50",
      description: "AED 50 off orders over AED 400",
      discountType: "Fixed",
      discountValue: 50,
      minOrderValue: 400,
      startDate: yearStart,
      endDate: yearEnd,
      limitPerUser: 2,
    },
    {
      code: "BEAUTY15",
      description: "15% off beauty & skincare",
      discountType: "Percentage",
      discountValue: 15,
      maxDiscount: 75,
      minOrderValue: 150,
      startDate: yearStart,
      endDate: yearEnd,
      limitPerUser: 2,
      excludedCategories: ["electronics", "fashion", "home", "wellness"].map(
        (slug) => categoryBySlug.get(slug)._id,
      ),
    },
    {
      code: "SUMMER20",
      description: "Summer sale (ended)",
      discountType: "Percentage",
      discountValue: 20,
      minOrderValue: 200,
      startDate: new Date(now - 120 * DAY),
      endDate: new Date(now - 20 * DAY),
    },
  ]);

  await Banner.create([
    {
      title: "Glow season: up to 40% off skincare",
      subtitle: "Serums, SPF and moisturisers from the labels our customers keep repurchasing.",
      eyebrow: "Beauty Week",
      ctaLabel: "Shop skincare",
      imageUrl: img("photo-1487412947147-5cebf100ffc2", 1800),
      linkUrl: "/category/skincare",
      tone: "dark",
      order: 1,
    },
    {
      title: "Audio that earns its shelf space",
      subtitle: "ANC earbuds, over-ear headphones and fast chargers — with official UAE warranty.",
      eyebrow: "Tech Drop",
      ctaLabel: "Shop electronics",
      imageUrl: img("photo-1498049794561-7780e7231661", 1800),
      linkUrl: "/category/electronics",
      tone: "light",
      order: 2,
    },
    {
      title: "Quiet luxury, honestly priced",
      subtitle: "Full-grain leather, European linen and steel mesh without the boutique markup.",
      eyebrow: "New Season",
      ctaLabel: "Shop fashion",
      imageUrl: img("photo-1441986300917-64674bd600d8", 1800),
      linkUrl: "/category/fashion",
      tone: "dark",
      order: 3,
    },
    {
      title: "Refresh your kitchen",
      subtitle: "Cast iron, ceramic non-stick and handcrafted serveware for every gathering.",
      eyebrow: "Home Edit",
      ctaLabel: "Shop home",
      imageUrl: img("photo-1556911220-bff31c812dba", 1800),
      linkUrl: "/category/home",
      tone: "light",
      order: 4,
    },
    {
      title: "Oud, amber & fresh",
      subtitle: "Signature scents and gift sets, authentic and UAE-stocked.",
      eyebrow: "Fragrance Edit",
      ctaLabel: "Shop perfumes",
      imageUrl: img("photo-1622618991746-fe6004db3a47", 1200),
      linkUrl: "/category/perfume",
      position: "Promo Grid",
      tone: "dark",
      order: 1,
    },
    {
      title: "Salon-grade hair care",
      subtitle: "Masks, oils and heat protection for every hair type.",
      eyebrow: "Hair Care",
      ctaLabel: "Shop hair care",
      imageUrl: img("photo-1522338140262-f46f5913618a", 1200),
      linkUrl: "/category/haircare",
      position: "Promo Grid",
      tone: "dark",
      order: 2,
    },
    {
      title: "Small daily habits",
      subtitle: "Vitamins, collagen and wellness essentials from verified sellers.",
      eyebrow: "Wellness",
      ctaLabel: "Shop wellness",
      imageUrl: img("photo-1544367567-0f2fcb009e0b", 1200),
      linkUrl: "/category/wellness",
      position: "Promo Grid",
      tone: "light",
      order: 3,
    },
    {
      title: "Flash sale: up to 50% off",
      subtitle: "Limited stock at the lowest prices of the week — while the timer runs.",
      eyebrow: "Today only",
      ctaLabel: "See all deals",
      imageUrl: img("photo-1596704017254-9b121068fb31", 1600),
      linkUrl: "/search?flash=true&sort=discount",
      position: "Flash Sale Banner",
      tone: "dark",
      order: 1,
    },
    {
      title: "Free delivery over AED 150",
      subtitle: "Dubai and Sharjah orders ship free above AED 150, with 14-day easy returns.",
      eyebrow: "Delivery",
      ctaLabel: "Start shopping",
      imageUrl: img("photo-1586023492125-27b2c045efd7", 800),
      linkUrl: "/search?sort=popular",
      position: "Sidebar",
      tone: "dark",
      order: 1,
    },
  ]);

  await Page.create(PAGES);
  await Subscriber.create([
    { email: "priya@example.ae" },
    { email: "deals.lover@example.com" },
    { email: "khalid@example.ae", source: "checkout" },
  ]);
  await ContactMessage.create({
    name: "Yousef Ali",
    email: "yousef.ali@example.com",
    phone: "+971509998877",
    subject: "Corporate gifting enquiry",
    message:
      "Hi, we'd like to order 60 perfume discovery sets for Ramadan gifts. Do you offer corporate pricing and custom wrapping?",
  });
  console.log("✓ Coupons, banners, CMS pages, subscribers, contact message");

  /* ---------------- Support & notifications ---------------- */
  const shippedOrder = await Order.findOne({ user: fatima._id, status: "Shipped" });
  await Ticket.create({
    ticketId: `SD-TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
    user: fatima._id,
    order: shippedOrder._id,
    subject: "Can I change the delivery time?",
    category: "Order & Shipping",
    priority: "Medium",
    status: "In Progress",
    assignedAgent: admin._id,
    messages: [
      {
        sender: fatima._id,
        message: "Hi, I won't be home tomorrow morning. Can the courier deliver after 6pm instead?",
        createdAt: new Date(now - 20 * HOUR),
      },
      {
        sender: admin._id,
        message:
          "Hi Fatima, we've asked Aramex to schedule an evening delivery (6–9pm). You'll get an SMS when the driver is on the way.",
        createdAt: new Date(now - 18 * HOUR),
      },
    ],
  });

  await Notification.create([
    {
      user: fatima._id,
      type: "order",
      title: "Order shipped",
      message: `Your order ${shippedOrder.orderId} is on its way.`,
      link: `/account/orders/${shippedOrder._id}`,
    },
    {
      user: fatima._id,
      type: "support",
      title: "Support replied to your ticket",
      message: "We've asked Aramex to schedule an evening delivery.",
      link: "/account?tab=support",
    },
    {
      user: fatima._id,
      type: "promo",
      title: "Beauty Week is live",
      message: "Use BEAUTY15 for 15% off skincare and makeup.",
      link: "/category/skincare",
      isRead: true,
    },
    {
      user: vendorAccounts.beauty._id,
      type: "order",
      title: "New order received",
      message: "A new order is waiting for confirmation.",
      link: "/vendor-dashboard?tab=orders",
    },
    {
      user: vendorAccounts.beauty._id,
      type: "stock",
      title: "Low stock",
      message: "Velvet Matte Lipstick (Warm Nude) has 3 units left.",
      link: "/vendor-dashboard?tab=products",
    },
    {
      user: admin._id,
      type: "account",
      title: "New seller application",
      message: "Desert Rose Crafts applied to sell on Smart Deal.",
      link: "/admin-dashboard?tab=vendors",
    },
    {
      user: admin._id,
      type: "order",
      title: "Return requested",
      message: "Omar Haddad requested a return.",
      link: "/admin-dashboard?tab=returns",
    },
  ]);
  console.log("✓ Support ticket & notifications");

  console.log(`
Seed complete. Sign in with:
  Super admin   admin@smartdeal.ae      adminpassword1234
  Support staff support@smartdeal.ae    Support@12345
  Seller        vendor@smartdeal.ae     vendorpassword1234   (also vendor2@ / vendor3@ with Vendor@12345)
  Customer      user@smartdeal.ae       userpassword1234     (others: omar@example.ae … Customer@123)
`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Seeding failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
