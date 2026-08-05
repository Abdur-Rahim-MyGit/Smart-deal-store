# Smart Deal — Phase 1: Storefront Home Page

## Stack note (important)

MongoDB, Express, Mongoose, Socket.io and React Native cannot run on this platform. What runs here:

| You asked for | What I'll use |
|---|---|
| Express + Mongoose APIs | Server functions on the same codebase |
| MongoDB | Lovable Cloud database (Postgres) |
| JWT / refresh tokens / bcrypt | Lovable Cloud auth (email + Google), row-level security |
| Cloudinary | Lovable Cloud storage |
| Socket.io realtime | Cloud realtime subscriptions (admin edits push live to storefront) |
| React Native app | Fully responsive web app, installable as a PWA |
| Stripe | Built-in Stripe payments integration |

Everything in your spec — catalog, cart, checkout, orders, admin dashboard, roles, reviews, coupons, flash deals — is buildable this way. Same features, different plumbing.

## Phase 1 scope: brand + home page (this plan)

Build the Smart Deal identity and a complete, real storefront home page with a seeded catalog. No backend yet beyond the seeded product data — Phase 2 adds Cloud, auth, and admin CRUD.

### Design system
- Primary `#FEEE00`, secondary `#FFD400`, ink/accent `#232F3E`, page bg `#F7F8FA`, white cards.
- All values as semantic tokens in `src/styles.css` (oklch), light + dark mode.
- Rounded-xl buttons, soft layered shadows, generous spacing, restrained motion.
- Typography: Outfit (headings) + Figtree (body), loaded via a link tag in the root route.
- Custom Smart Deal logo mark (yellow tag/spark motif) + favicon, generated.

### Home page sections
1. Sticky header — logo, location selector, expanding search bar with suggestions, mega category nav, wishlist, cart, notifications, account, dark-mode toggle.
2. Hero banner slider — 3 auto-advancing slides, arrows + dots.
3. Category carousel — circular category tiles.
4. Flash deals rail with live countdown timer.
5. Today's deals / trending / best sellers / new arrivals product rails.
6. Featured brands strip.
7. Collection tiles (Beauty, Luxury, Electronics, Fashion, Skincare).
8. Customer reviews carousel.
9. Newsletter + app-download band.
10. Full footer with link columns, payment icons, socials.

### Data
Seeded catalog of ~40 products across beauty, skincare, hair care, perfume, electronics, fashion, home & kitchen — name, price, MRP, discount, rating, review count, stock, badges, brand, category. Stored as typed TS modules now, migrated into the Cloud database in Phase 2 without changing component code (single `catalog` data layer).

Product imagery: a set of generated category/collection images plus per-rail hero art; product thumbnails use generated images shared per category to keep the build light.

### Behavior that actually works in Phase 1
- Search filters the seeded catalog with live suggestions.
- Cart and wishlist are real (add/remove/quantity, badge counts, persisted locally) and carry over to the Cloud-backed version later.
- Countdown timers, sliders, carousels, hover states, skeleton loaders, empty states.
- Product cards link to `/product/$slug` (Phase 3 builds that page fully).

### Responsiveness
Mobile-first: header collapses to logo + search + cart with a drawer nav and bottom tab bar; rails become swipeable; grids step 2 → 3 → 4 → 5 columns up to ultra-wide.

### SEO
Route-level `head()` on `/` with Smart Deal title/description, og + twitter tags, Organization + WebSite JSON-LD, single H1, lazy-loaded imagery.

## Roadmap after approval
- Phase 2 — Lovable Cloud: schema (products, categories, brands, orders, reviews, coupons, addresses, roles), auth with customer/admin/super-admin roles, RLS, catalog migrated to the database.
- Phase 3 — Product detail, category/search listing with filters, cart, checkout with Stripe + COD, orders.
- Phase 4 — Admin dashboard: full CRUD for products, categories, brands, banners, coupons, flash deals, inventory, orders with status timeline, customers, analytics charts, realtime push to storefront.
- Phase 5 — Account area, order tracking, returns/refunds, wallet, notifications, support tickets, 2FA.
- Phase 6 — PWA install, performance pass, SEO pass, security review.

## Technical notes
- Routes: `src/routes/index.tsx` (home), `src/routes/__root.tsx` (fonts, Toaster, theme provider).
- Components split under `src/components/layout/`, `src/components/home/`, `src/components/product/`, `src/components/ui/`.
- Cart/wishlist state via a small typed context + localStorage, swapped for Cloud-backed hooks in Phase 3.
- Data access behind `src/data/catalog.ts` so the Postgres swap is a one-file change.
- Framer Motion (`motion`) for slider/rail/entrance animation; Zod + React Hook Form for the newsletter form.
