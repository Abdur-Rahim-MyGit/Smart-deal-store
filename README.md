# Smart Deal

A multi-vendor e-commerce platform for the UAE market: a customer storefront, a seller
centre and an admin console, backed by an Express + MongoDB API.

Prices are in AED, 5% UAE VAT is applied at checkout, delivery is priced per emirate,
and payment options are cash on delivery, store-credit wallet and card (test mode).

The original product brief lives in [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md);
the full endpoint reference is in [docs/API.md](docs/API.md).

## Stack

| Layer      | Technology                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| Storefront | React 19, TanStack Start & Router (SSR), TanStack Query, Tailwind CSS v4, shadcn/ui, Recharts |
| API        | Node.js, Express 4, MongoDB, Mongoose 8, JWT auth with rotating refresh cookies               |
| Tooling    | Vite 7, TypeScript (strict), ESLint, Prettier, Docker                                         |

## Quick start

Prerequisites: **Node.js 20+** and **MongoDB** running locally (or use Docker, below).

```bash
# 1. API
cd backend
npm install
cp .env.example .env        # then edit the secrets
npm run seed                # loads demo catalogue, orders, users
npm run dev                 # http://localhost:5050

# 2. Storefront (second terminal, from the repo root)
npm install
npm run dev                 # http://localhost:8080
```

Health check: <http://localhost:5050/api/health>

> The API listens on **5050**. If that port is taken, change `PORT` in `backend/.env`
> and point the storefront at it with `VITE_API_URL` (see `.env.example`).

### Demo accounts (after seeding)

| Role                                  | Email                                | Password           |
| ------------------------------------- | ------------------------------------ | ------------------ |
| Super admin                           | admin@smartdeal.ae                   | adminpassword1234  |
| Staff (orders, support, reviews only) | support@smartdeal.ae                 | Support@12345      |
| Seller                                | vendor@smartdeal.ae                  | vendorpassword1234 |
| Seller (electronics)                  | vendor2@smartdeal.ae                 | Vendor@12345       |
| Seller (lifestyle)                    | vendor3@smartdeal.ae                 | Vendor@12345       |
| Seller awaiting approval              | newseller@smartdeal.ae               | Vendor@12345       |
| Customer                              | user@smartdeal.ae                    | userpassword1234   |
| More customers                        | omar@example.ae, aisha@example.ae, … | Customer@123       |

`npm run seed` **wipes the database** and rebuilds it: 8 categories with subcategories,
42 products with variants, ~70 orders across every status, 100 approved reviews, coupons,
banners, CMS pages, a payout history, a support ticket and notifications.

## What each role can do

**Customers** — browse categories, faceted search (brand, price, rating, discount, stock),
product pages with variants, reviews and delivery estimates, wishlist, cart with save-for-later,
coupons, multi-step checkout (address book, delivery speed, COD/wallet/card), order tracking with
a status timeline, cancellations, returns within the return window, VAT invoices, verified-purchase
reviews, support tickets, notifications and a store-credit wallet.

**Sellers** — sales dashboard with charts and balances, product management with variants/stock/images,
an approval workflow, order fulfilment (confirm → pack → ship with carrier and tracking), packing slips,
review replies, payout requests, and store/bank settings.

**Admins** — KPI dashboard, order management with valid status transitions, returns and refunds,
product moderation, categories, reviews, customers and sellers (approve, suspend, commission overrides),
staff accounts with per-module permissions, coupons, banners, CMS pages, subscribers, seller payouts,
support tickets, the contact inbox, store settings (VAT, COD, per-emirate delivery, policies) and an audit log.

## Project structure

```
backend/
  models/         Mongoose schemas (User, Product, Order, Cart, Coupon, Setting, …)
  controllers/    Route handlers grouped by domain
  services/       Order lifecycle, vendor balances, notifications
  middleware/     Auth, RBAC, rate limiting, input sanitising, error handling
  utils/          Pricing engine, catalog queries, validation helpers
  scripts/seed.js Demo data
src/
  routes/         File-based routes (storefront, account, dashboards)
  components/     layout, product, catalog, cart, checkout, account, vendor, admin, dashboard, common, ui
  context/store.tsx  Session, cart and wishlist state
  hooks/          Settings, categories, auth guard, notifications, recently viewed
  lib/            API client, shared types, formatting, constants
```

## Environment

`backend/.env` (see `backend/.env.example`):

| Variable                                  | Purpose                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `PORT`                                    | API port (default 5050)                                                     |
| `MONGODB_URI`                             | MongoDB connection string                                                   |
| `CLIENT_URL`                              | Comma-separated storefront origins allowed by CORS                          |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`        | Token signing secrets — use long random values                              |
| `JWT_ACCESS_EXPIRE`, `JWT_REFRESH_EXPIRE` | Token lifetimes (default 15m / 7d)                                          |
| `COOKIE_SAMESITE`                         | `lax` locally; `none` (with HTTPS) when the storefront is on another domain |
| `PAYMENT_MODE`                            | `test` enables the simulated card gateway. Leave unset in production        |
| `GOOGLE_CLIENT_ID`                        | Enables "Sign in with Google" (ID tokens are verified server-side)          |

Storefront: `VITE_API_URL` (see `.env.example`).

## Integrations that still need credentials

These are wired behind configuration and degrade cleanly when unset:

- **Card payments** run through a simulated gateway while `PAYMENT_MODE=test` (no card number
  ever reaches the server — only the brand and last four digits are stored). Leave the variable
  unset in production and card checkout is hidden until a real provider is integrated.
- **Email and SMS** (order confirmations, password resets, OTP codes) are written to the server
  log instead of being sent. In development the API returns the OTP code and reset link in the
  response so the flows are testable end to end.
- **Google sign-in** appears only when `GOOGLE_CLIENT_ID` is set.

## Scripts

Root: `npm run dev` · `npm run build` · `npm run lint` · `npm run format`
Backend: `npm run dev` (nodemon) · `npm start` · `npm run seed`

## Docker

`docker compose up -d --build` starts MongoDB and the API (the storefront is deployed separately).
Create a `.env` next to `docker-compose.yml` with at least `JWT_SECRET` and `JWT_REFRESH_SECRET`,
then optionally seed with `docker compose exec api npm run seed`.

## Security notes

Passwords are hashed with bcrypt and must contain upper, lower, number and symbol characters.
Access tokens are short-lived and kept in memory; refresh tokens rotate and live in an httpOnly
cookie. Accounts lock for 15 minutes after five failed sign-ins. Admin accounts can only be created
by an existing super admin, roles are enforced per route with per-module permissions, request bodies
are sanitised against operator injection, auth endpoints are rate limited, and every administrative
action is recorded in the audit log.
