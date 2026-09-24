# Smart Deal E-Commerce Platform — Client Handover & Credentials

This guide contains all access credentials, platform URLs, test accounts, coupons, and infrastructure settings for the **Smart Deal Store**.

---

## 🌐 1. Live URLs & Portals

| Portal | URL | Description |
| :--- | :--- | :--- |
| **🛍️ Main Storefront** | [https://spicesoshop.com](https://spicesoshop.com) | Customer shopping catalog, cart & checkout |
| **⚙️ Backend API** | [https://api.spicesoshop.com/api/health](https://api.spicesoshop.com/api/health) | REST API & server health status |
| **🔐 Sign In / Login** | [https://spicesoshop.com/login](https://spicesoshop.com/login) | Universal login for admin, sellers & customers |
| **👑 Admin Dashboard** | [https://spicesoshop.com/admin-dashboard](https://spicesoshop.com/admin-dashboard) | Full administrative control center |
| **🏪 Vendor Dashboard** | [https://spicesoshop.com/vendor-dashboard](https://spicesoshop.com/vendor-dashboard) | Seller store management & packing slips |

---

## 👑 2. Administrator & Staff Logins

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@smartdeal.ae` | `adminpassword1234` | Full access to products, orders, payouts, settings & users |
| **Staff Member** | `support@smartdeal.ae` | `Support@12345` | Order management, tickets & review moderation |

---

## 🏪 3. Vendor & Seller Logins

| Store / Department | Email | Password | Status |
| :--- | :--- | :--- | :--- |
| **Beauty & Cosmetics** | `vendor@smartdeal.ae` | `vendorpassword1234` | Active Seller |
| **Electronics & Gadgets** | `vendor2@smartdeal.ae` | `Vendor@12345` | Active Seller |
| **Lifestyle & Fashion** | `vendor3@smartdeal.ae` | `Vendor@12345` | Active Seller |
| **Pending Seller** | `newseller@smartdeal.ae` | `Vendor@12345` | Awaiting Admin Approval |

---

## 🛍️ 4. Customer Test Accounts

| Account Type | Email | Password | History |
| :--- | :--- | :--- | :--- |
| **Primary Demo User** | `user@smartdeal.ae` | `userpassword1234` | Preloaded with delivered, shipped & active test orders |
| **Customer Profile** | `omar@example.ae` | `Customer@123` | Standard shopper account |
| **Customer Profile** | `aisha@example.ae` | `Customer@123` | Standard shopper account |

---

## 🎟️ 5. Promo & Coupon Codes

- **`WELCOME10`**: 10% discount on orders over AED 100 (Max discount AED 50)
- **`FREESHIP`**: Free shipping on orders over AED 50
- **`SAVE50`**: AED 50 flat discount on orders over AED 400
- **`BEAUTY15`**: 15% discount on all Beauty & Skincare items

---

## ☁️ 6. Infrastructure & Cloud Config

### 🍃 MongoDB Atlas Cloud Database
- **Cluster:** `cluster0.fr74tkn.mongodb.net`
- **Database Name:** `smartdeal`
- **Connection URI:**
  ```text
  mongodb+srv://souban:souban@cluster0.fr74tkn.mongodb.net/smartdeal?retryWrites=true&w=majority
  ```

### 🏢 Hostinger Web Hosting (hPanel)
- **Storefront Application:** `spicesoshop.com` (Node.js 22.x / Nitro Server)
- **Backend API Subdomain:** `api.spicesoshop.com` (Node.js 22.x / Express)
- **Persistent Image Storage:** `/home/u118048059/smartdeal-storage`
- **Payment Mode:** Simulated Test Gateway (`PAYMENT_MODE=test`)

---

## 📄 How to save as PDF:
Open [CLIENT_HANDOVER_GUIDE.html](file:///e:/Smart-deal-store/docs/CLIENT_HANDOVER_GUIDE.html) in your browser and click **"Save as PDF / Print"** or press `Ctrl + P` to save a clean PDF copy for your client!
