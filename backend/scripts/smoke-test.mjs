/**
 * End-to-end API check. Exercises the customer, seller and admin journeys plus the
 * main security rules against a running server, and cleans up what it creates.
 *
 * Usage:  npm run smoke            (from /backend, with the API running)
 *         SMOKE_API_URL=https://api.example.com/api npm run smoke
 *
 * Best run right after `npm run seed`. Exits non-zero if any check fails.
 */

const BASE = process.env.SMOKE_API_URL || "http://localhost:5050/api";
const ACCOUNTS = {
  customer: { email: "user@smartdeal.ae", password: "userpassword1234" },
  vendor: { email: "vendor@smartdeal.ae", password: "vendorpassword1234" },
  admin: { email: "admin@smartdeal.ae", password: "adminpassword1234" },
  staff: { email: "support@smartdeal.ae", password: "Support@12345" },
};

const cookies = new Map();
let failures = 0;
let checks = 0;

function rememberCookies(response) {
  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function call(method, path, { body, token, withCookies = false } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (withCookies && cookies.size)
    headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    console.error(`\n  Cannot reach ${BASE} — is the API running?  (${error.message})`);
    process.exit(1);
  }
  rememberCookies(response);
  const data = await response.json().catch(() => ({}));
  return { ...data, __status: response.status, __ok: response.ok };
}

const check = (label, condition, detail = "") => {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `  — ${detail}` : ""}`);
  }
};
const section = (name) => console.log(`\n${name}`);
const login = (account) =>
  call("POST", "/auth/login", { body: ACCOUNTS[account], withCookies: true });

async function run() {
  console.log(`Smart Deal API smoke test → ${BASE}`);

  /* ---------------- Public ---------------- */
  section("Public catalogue");
  const health = await call("GET", "/health");
  check("health reports a database connection", health.database === "connected");

  const home = await call("GET", "/public/home");
  check("home feed returns banners", (home.home?.banners?.length ?? 0) >= 1);
  check("home feed returns best sellers", (home.home?.bestSellers?.length ?? 0) >= 1);

  const search = await call("GET", "/products?q=serums");
  check("search handles plurals ('serums' → serum)", (search.total ?? 0) >= 1);

  const facets = await call("GET", "/products/facets?category=skincare");
  check(
    "facets return brands and a price range",
    (facets.facets?.brands?.length ?? 0) >= 1 && facets.facets?.priceRange?.max > 0,
  );

  const listing = await call("GET", "/products?category=skincare&sort=price-asc&inStock=true");
  check("category filter with price sort", (listing.total ?? 0) >= 1);
  const sample = (listing.products ?? []).find(
    (product) => product.variantCount === 1 && product.price >= 60,
  );
  check("found a single-variant product to test with", Boolean(sample));
  if (!sample) return;

  const detail = await call("GET", `/products/${sample.slug}`);
  check(
    "product detail includes variants and rating breakdown",
    (detail.product?.variants?.length ?? 0) >= 1 && Boolean(detail.ratingBreakdown),
  );
  check(
    "public settings expose the 7-emirate delivery matrix",
    (await call("GET", "/public/settings")).settings?.shippingMatrix?.length === 7,
  );
  check("CMS page loads", Boolean((await call("GET", "/public/pages/faq")).page?.title));

  /* ---------------- Security ---------------- */
  section("Security");
  const unique = Date.now().toString().slice(-7);
  const escalation = await call("POST", "/auth/register", {
    body: {
      name: "Role Test",
      email: `role${unique}@example.com`,
      phone: `+97155${unique}`,
      password: "Str0ng!Pass",
      role: "Admin",
    },
  });
  check("registration cannot self-assign the Admin role", escalation.user?.role === "Customer");
  const weak = await call("POST", "/auth/register", {
    body: {
      name: "Weak",
      email: `weak${unique}@example.com`,
      phone: `+97156${unique}`,
      password: "password",
    },
  });
  check("weak passwords are rejected", weak.__status === 400);
  const forged = await call("POST", "/auth/google", { body: { credential: "forged-token" } });
  check(
    "Google sign-in never trusts an unverified token",
    forged.__status === 503 || forged.__status === 401,
  );
  check(
    "public admin registration endpoint is gone",
    (await call("POST", "/auth/register-admin", { body: {} })).__status === 404,
  );
  const injection = await call("POST", "/auth/login", {
    body: { email: { $ne: "x" }, password: { $ne: "x" } },
  });
  check("query-operator injection is blocked", !injection.__ok);

  /* ---------------- Customer ---------------- */
  section("Customer journey");
  const signIn = await login("customer");
  check("customer sign-in", Boolean(signIn.accessToken));
  const refreshed = await call("POST", "/auth/refresh", { withCookies: true });
  check("refresh cookie issues a new access token", Boolean(refreshed.accessToken));
  const token = refreshed.accessToken || signIn.accessToken;

  const stockOf = async () => {
    const current = await call("GET", `/products/${sample.slug}`);
    return (
      current.product.variants.find((variant) => variant.sku === sample.defaultSku)?.stock ?? 0
    );
  };
  const stockBefore = await stockOf();

  const added = await call("POST", "/cart/items", {
    body: { productId: sample._id, variantSku: sample.defaultSku, qty: 2 },
    token,
  });
  check("add to cart", (added.cart?.summary?.itemCount ?? 0) >= 2, added.message);

  const me = await call("GET", "/auth/me", { token });
  const addressId = me.user?.addresses?.[0]?._id;
  check("customer has a saved address", Boolean(addressId));

  const quote = await call("POST", "/orders/quote", {
    body: { addressId, shippingMethod: "Express", paymentMethod: "COD", couponCode: "WELCOME10" },
    token,
  });
  const q = quote.quote ?? {};
  const expectedVat = Math.round((q.subtotal - q.discount + q.shippingFee + q.codFee) * 5) / 100;
  check("quote applies the coupon", q.discount > 0, q.coupon?.error);
  check(
    "quote VAT = 5% of items − discount + delivery + COD",
    Math.abs(q.vat - expectedVat) < 0.011,
    `vat=${q.vat} expected=${expectedVat}`,
  );

  const stale = await call("POST", "/orders", {
    body: {
      addressId,
      shippingMethod: "Express",
      paymentMethod: "COD",
      expectedTotal: q.total + 5,
    },
    token,
  });
  check("order is refused when the client total is stale", stale.__status === 409);

  const order = await call("POST", "/orders", {
    body: {
      addressId,
      shippingMethod: "Express",
      paymentMethod: "COD",
      couponCode: "WELCOME10",
      expectedTotal: q.total,
    },
    token,
  });
  check("place a cash-on-delivery order", Boolean(order.order?.orderId), order.message);
  check("charged total matches the quote", order.order?.pricing?.total === q.total);
  check("stock decremented by the ordered quantity", (await stockOf()) === stockBefore - 2);
  check(
    "cart is emptied after checkout",
    ((await call("GET", "/cart", { token })).cart?.items?.length ?? -1) === 0,
  );

  const cancelled = await call("POST", `/orders/${order.order._id}/cancel`, {
    body: { reason: "Smoke test cleanup" },
    token,
  });
  check("cancel an order before it ships", cancelled.order?.status === "Cancelled");
  check("stock is restored after cancellation", (await stockOf()) === stockBefore);
  check(
    "an order cannot be cancelled twice",
    (await call("POST", `/orders/${order.order._id}/cancel`, { body: {}, token })).__status === 400,
  );

  const guestPreview = await call("POST", "/cart/preview", {
    body: { items: [{ productId: sample._id, variantSku: sample.defaultSku, qty: 9999 }] },
  });
  check(
    "guest cart preview flags insufficient stock",
    guestPreview.cart?.items?.[0]?.issue === "insufficient_stock",
  );

  const address = await call("POST", "/auth/addresses", {
    body: {
      receiverName: "Smoke Test",
      receiverPhone: "050 123 4567",
      emirate: "Sharjah",
      area: "Al Nahda",
      street: "Street 5",
      buildingDetails: "Tower 3, Apt 12",
    },
    token,
  });
  check(
    "address saved with a normalised UAE phone number",
    address.address?.receiverPhone === "+971501234567",
  );
  await call("DELETE", `/auth/addresses/${address.address?._id}`, { token });

  const unpurchased = (await call("GET", "/products?q=dumbbell")).products?.[0];
  if (unpurchased) {
    const blocked = await call("POST", `/products/${unpurchased._id}/reviews`, {
      body: { rating: 5, comment: "Never bought this product at all." },
      token,
    });
    check("reviews require a delivered purchase", !blocked.__ok);
  }
  check(
    "customers cannot reach the admin API",
    (await call("GET", "/admin/dashboard", { token })).__status === 403,
  );

  /* ---------------- Seller ---------------- */
  section("Seller");
  const vendorToken = (await login("vendor")).accessToken;
  const dashboard = await call("GET", "/vendors/dashboard", { token: vendorToken });
  check(
    "seller dashboard returns stats and a 30-day series",
    dashboard.stats?.productCount >= 1 && dashboard.salesByDay?.length === 30,
  );

  const queue = await call("GET", "/vendors/orders?view=to-fulfil", { token: vendorToken });
  check("seller sees orders awaiting fulfilment", (queue.orders?.length ?? 0) >= 1);
  const pendingOrder = (queue.orders ?? []).find((entry) =>
    entry.items.some((item) => item.status === "Placed"),
  );
  if (pendingOrder) {
    const item = pendingOrder.items.find((entry) => entry.status === "Placed");
    const skipped = await call(
      "PUT",
      `/vendors/orders/${pendingOrder._id}/items/${item._id}/status`,
      { body: { status: "Shipped", carrier: "Aramex" }, token: vendorToken },
    );
    check("seller cannot skip fulfilment steps", skipped.__status === 400);
  }

  const category = (await call("GET", "/products/categories")).categories?.find(
    (entry) => entry.slug === "skincare",
  );
  const created = await call("POST", "/products", {
    body: {
      title: `Smoke Test Serum ${unique}`,
      brand: "Lumen Lab",
      category: category?._id,
      description: "Temporary product created by the automated smoke test.",
      thumbnail: "https://images.unsplash.com/photo-1617897903246-719242758050?w=600",
      variants: [{ sku: `SMOKE-${unique}`, price: 50, mrp: 80, stock: 10 }],
    },
    token: vendorToken,
  });
  check(
    "new seller products await approval",
    created.product?.status === "Pending Approval",
    created.message,
  );
  const selfApprove = await call("PUT", `/products/${created.product?._id}`, {
    body: { status: "Active" },
    token: vendorToken,
  });
  check("sellers cannot approve their own products", selfApprove.product?.status !== "Active");
  const restock = await call("PATCH", `/products/${created.product?._id}/stock`, {
    body: { variants: [{ sku: `SMOKE-${unique}`, stock: 25 }] },
    token: vendorToken,
  });
  check("stock-only updates apply immediately", restock.product?.totalStock === 25);

  const otherSellersProduct = (await call("GET", "/products?q=earbuds")).products?.[0];
  if (otherSellersProduct) {
    const hijack = await call("PUT", `/products/${otherSellersProduct._id}`, {
      body: { title: "Hijacked" },
      token: vendorToken,
    });
    check("sellers cannot edit another seller's product", hijack.__status === 403);
  }

  /* ---------------- Admin ---------------- */
  section("Admin");
  const adminToken = (await login("admin")).accessToken;
  const adminDashboard = await call("GET", "/admin/dashboard", { token: adminToken });
  check(
    "admin dashboard returns KPIs",
    adminDashboard.stats?.gmv > 0 && adminDashboard.salesByDay?.length > 0,
  );
  check(
    "admin can list orders",
    ((await call("GET", "/admin/orders", { token: adminToken })).total ?? 0) >= 1,
  );
  check(
    "admin can list customers",
    ((await call("GET", "/admin/customers", { token: adminToken })).total ?? 0) >= 1,
  );
  check(
    "admin settings expose the delivery matrix",
    (await call("GET", "/admin/settings", { token: adminToken })).settings?.shippingMatrix
      ?.length === 7,
  );
  check(
    "an incomplete delivery matrix is rejected",
    (
      await call("PUT", "/admin/settings", {
        body: { shippingMatrix: [{ emirate: "Dubai", fee: 10, freeThreshold: 100 }] },
        token: adminToken,
      })
    ).__status === 400,
  );
  check(
    "rejecting a product requires a reason",
    (
      await call("PUT", `/admin/products/${created.product?._id}/moderate`, {
        body: { status: "Rejected" },
        token: adminToken,
      })
    ).__status === 400,
  );
  const approved = await call("PUT", `/admin/products/${created.product?._id}/moderate`, {
    body: { status: "Active" },
    token: adminToken,
  });
  check("admin can approve a product", approved.product?.status === "Active");
  check(
    "audit log records administrative actions",
    ((await call("GET", "/admin/audit-logs", { token: adminToken })).total ?? 0) >= 1,
  );

  await call("DELETE", `/products/${created.product?._id}`, { token: adminToken });

  section("Staff permissions");
  const staffToken = (await login("staff")).accessToken;
  check(
    "support staff can work on orders",
    ((await call("GET", "/admin/orders", { token: staffToken })).total ?? 0) >= 1,
  );
  check(
    "support staff cannot open store settings",
    (await call("GET", "/admin/settings", { token: staffToken })).__status === 403,
  );

  console.log(
    `\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : ""}`,
  );
  process.exit(failures ? 1 : 0);
}

run().catch((error) => {
  console.error("\nSmoke test crashed:", error);
  process.exit(1);
});
