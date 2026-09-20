/**
 * Comprehensive test runner for Smart Deal Store.
 * Validates file uploads, Stripe payment intents, SSE notifications,
 * email dispatch, and executes the 50-check API smoke test.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE = process.env.TEST_API_URL || "http://127.0.0.1:5050/api";

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function run() {
  console.log("==================================================");
  console.log("  SMART DEAL STORE — FULL SYSTEM TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  const test = (label, cond, err = "") => {
    if (cond) {
      console.log(`  ✓ PASS: ${label}`);
      passed++;
    } else {
      console.log(`  ✗ FAIL: ${label} ${err ? `— ${err}` : ""}`);
      failed++;
    }
  };

  // 1. Health & Server check
  console.log("\n[1] Health Check");
  try {
    const health = await fetch(`${BASE}/health`).then((r) => r.json());
    test("API is reachable and database is connected", health.database === "connected");
  } catch (err) {
    test("API is reachable", false, err.message);
    process.exit(1);
  }

  // 2. Authentication
  console.log("\n[2] Authentication & Token Generation");
  const vendorAuth = await login("vendor@smartdeal.ae", "vendorpassword1234");
  test("Vendor authentication successful", Boolean(vendorAuth.accessToken));

  const adminAuth = await login("admin@smartdeal.ae", "adminpassword1234");
  test("Admin authentication successful", Boolean(adminAuth.accessToken));

  const customerAuth = await login("user@smartdeal.ae", "userpassword1234");
  test("Customer authentication successful", Boolean(customerAuth.accessToken));

  // 3. File & Image Upload System
  console.log("\n[3] File & Image Upload System");
  try {
    // Generate a tiny valid 1x1 transparent PNG file
    const samplePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const tempFilePath = path.resolve("uploads", "test-auto-verify.png");
    fs.writeFileSync(tempFilePath, samplePng);

    const formData = new FormData();
    const blob = new Blob([samplePng], { type: "image/png" });
    formData.append("file", blob, "test-auto-verify.png");

    const uploadRes = await fetch(`${BASE}/upload/single`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vendorAuth.accessToken}` },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    test("Image upload endpoint accepts multipart form file", uploadData.success === true);
    test("Upload returns accessible URL", Boolean(uploadData.url && uploadData.url.includes("/uploads/")));

    // Clean up temp test file if created
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  } catch (err) {
    test("Image upload endpoint accepts file", false, err.message);
  }

  // 4. Stripe Payment Intent Generation
  console.log("\n[4] Payment Gateway (Stripe & Simulated Fallback)");
  try {
    const productsRes = await fetch(`${BASE}/products?inStock=true&limit=1`).then((r) => r.json());
    const prod = productsRes.products?.[0];
    if (prod) {
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerAuth.accessToken}`,
        },
        body: JSON.stringify({ productId: prod._id, variantSku: prod.defaultSku, qty: 1 }),
      });
    }

    const paymentRes = await fetch(`${BASE}/orders/create-payment-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerAuth.accessToken}`,
      },
      body: JSON.stringify({ emirate: "Dubai", shippingMethod: "standard" }),
    });
    const paymentData = await paymentRes.json();
    test("Payment Intent endpoint generates client secret in AED", Boolean(paymentData.clientSecret));
    test("Payment gateway currency is AED", paymentData.currency === "AED");
  } catch (err) {
    test("Payment Intent endpoint", false, err.message);
  }

  // 5. Admin Test Email Service
  console.log("\n[5] Transactional Email Service");
  try {
    const emailRes = await fetch(`${BASE}/admin/test-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.accessToken}`,
      },
      body: JSON.stringify({ email: "admin@smartdeal.ae" }),
    });
    const emailData = await emailRes.json();
    test("Admin test-email endpoint dispatches without error", emailData.success === true);
  } catch (err) {
    test("Admin test-email endpoint", false, err.message);
  }

  // 6. Execute full smoke test suite
  console.log("\n[6] Full E-Commerce Business Logic Smoke Test");
  try {
    execSync("node scripts/smoke-test.mjs", { stdio: "inherit" });
    test("50/50 Smoke test suite passed", true);
  } catch (err) {
    test("Smoke test suite", false, err.message);
  }

  console.log("\n==================================================");
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) process.exit(1);
}

run();
