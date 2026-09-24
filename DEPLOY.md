# Deploying Smart Deal on Hostinger

Written for someone who has never deployed a Node app. Follow it top to bottom.

---

## 0. What you are deploying

Smart Deal is two Node.js programs plus a database:

| Part       | What it does                      | Code               | Lives at                      |
| ---------- | --------------------------------- | ------------------ | ----------------------------- |
| Storefront | Renders the shop pages            | repo root (`src/`) | `https://spicesoshop.com`     |
| API        | Logins, products, orders, uploads | `backend/`         | `https://api.spicesoshop.com` |
| Database   | All store data                    | —                  | MongoDB Atlas (free)          |

There are two ways to host it on Hostinger:

- **Option A — Business or Cloud web hosting (Node.js apps).** No server to look
  after. This is the plan `spicesoshop.com` is on. **Use this one.**
- **Option B — a VPS with Docker.** Full control over a whole machine. Only needed
  if you outgrow Option A. Uses `docker-compose.prod.yml`.

Both need the database first.

---

## 1. Free database (MongoDB Atlas)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>
2. Create a **free M0 cluster**. Pick a region near your customers.
3. **Database Access** → _Add New Database User_. Choose a username and a long
   password (letters and digits only avoids trouble later). Save both.
4. **Network Access** → _Add IP Address_ → **Allow access from anywhere**
   (`0.0.0.0/0`). Web hosting does not promise a fixed outgoing IP, so this is the
   practical choice; the long password from step 3 is what protects the database.
5. **Database → Connect → Drivers** and copy the connection string:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smartdeal?retryWrites=true&w=majority
   ```

   Put your username and password in, and make sure `/smartdeal` sits right
   before the `?`. This is your **`MONGODB_URI`**.

---

## Option A — Business web hosting

### A1. The API website (`api.spicesoshop.com`)

The API gets its own subdomain. Because it is still on `spicesoshop.com`, the
browser treats it as the same site and login cookies work normally.

1. hPanel → **Websites → Add website → Node.js app**.
2. Domain: **`api.spicesoshop.com`**.
3. Source: connect **GitHub** and pick this repo, or upload a **zip of the
   `backend` folder** (leave out `node_modules`, `uploads`, `private-uploads`
   and `.env`).
4. Build settings:

   | Setting        | Value                                         |
   | -------------- | --------------------------------------------- |
   | Framework      | Express                                       |
   | Root directory | `backend` (GitHub) or `.` (zip of the folder) |
   | Entry file     | `server.js`                                   |
   | Node version   | 22                                            |
   | Build command  | _(leave empty)_                               |

5. **Environment variables** — add exactly these:

   | Name                 | Value                                                 |
   | -------------------- | ----------------------------------------------------- |
   | `NODE_ENV`           | `production`                                          |
   | `MONGODB_URI`        | your Atlas string from step 1                         |
   | `JWT_SECRET`         | a long random string                                  |
   | `JWT_REFRESH_SECRET` | a _different_ long random string                      |
   | `JWT_ACCESS_EXPIRE`  | `15m`                                                 |
   | `JWT_REFRESH_EXPIRE` | `7d`                                                  |
   | `CLIENT_URL`         | `https://spicesoshop.com,https://www.spicesoshop.com` |
   | `COOKIE_SAMESITE`    | `lax`                                                 |
   | `PUBLIC_API_URL`     | `https://api.spicesoshop.com/api`                     |
   | `STORAGE_DIR`        | `/home/u118048059/smartdeal-storage`                  |
   | `PAYMENT_MODE`       | `test`                                                |

   For the two secrets, any password generator set to 60+ characters works.

   `STORAGE_DIR` keeps uploaded images **outside** the app. Hostinger rebuilds the
   app into a fresh folder on every deploy, so without it every redeploy deletes
   all product images. (`u118048059` is this account's username — hPanel shows it
   under the website's details.)

6. Deploy, then open <https://api.spicesoshop.com/api/health>. You want to see
   `"database":"connected"`.

### A2. The storefront website (`spicesoshop.com`)

Build settings (Hostinger detects most of these):

| Setting          | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| Framework        | Nitro                                                  |
| Root directory   | `.` (GitHub) or the folder name inside your zip        |
| Build command    | `build`                                                |
| Output directory | `.output`                                              |
| Entry file       | `server/index.mjs`                                     |
| Node version     | **22** (TanStack Start needs 22.12 or newer; 20 fails) |

**Environment variables — only this one:**

| Name           | Value                             |
| -------------- | --------------------------------- |
| `VITE_API_URL` | `https://api.spicesoshop.com/api` |

> ⚠️ Do **not** copy the API's variables onto the storefront, and do not set
> `NODE_ENV` here at all — the build already runs in production mode.
> `NODE_ENV=development` makes every page fail with _"This page didn't load"_
> (log: `jsxDEV is not a function`). `NODE_ENV=production` makes the build skip
> its own tools and fail (log: `Cannot find package '@lovable.dev/vite-tanstack-config'`).

`VITE_API_URL` is baked in when the site is built, so **redeploy after changing
it** — saving the variable alone is not enough.

### A3. Create your admin account

Do **not** run `npm run seed` on your live database. This repository is public
and the demo accounts' passwords are written in it, so anyone could sign in as
your admin.

Create your own admin instead. On your PC, in PowerShell:

```
cd E:\Smart-deal-store\backend
npm install
$env:MONGODB_URI = "<your Atlas string>"
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_PASSWORD = "a long password you will remember"
npm run create-admin
```

It prints `Created super-admin you@example.com`. Sign in at
`https://spicesoshop.com/login`. Running it again with the same email just resets
that admin's password.

### A4. Check everything works

- [ ] <https://api.spicesoshop.com/api/health> shows `"database":"connected"`
- [ ] <https://spicesoshop.com> loads the shop
- [ ] You can sign in as your admin
- [ ] Upload a product image, **redeploy the API**, and the image is still there

### A5. When something goes wrong

hPanel → **Websites → the site → Node.js → Logs** shows what the app printed.

**The domain shows "Parked Domain name on Hostinger DNS system"**
The domain is not connected to the website yet. In hPanel check the website shows
the domain as connected and SSL as active. New connections can take up to an hour.

**"This page didn't load" on every page, or the storefront build fails**
The storefront has a `NODE_ENV` variable, or is building on Node 20. Leave only
`VITE_API_URL` (see A2), set Node 22, then redeploy.

**The shop loads but has no products**
Either the API is down (check `/api/health`) or `VITE_API_URL` is wrong or was
changed without a redeploy.

**`/api/health` fails or says `"database":"disconnected"`**
Atlas is refusing the connection. Re-check step 1.4 (Network Access) and the
password in `MONGODB_URI`. If the password has `@ : / ? #` in it, those must be
percent-encoded (`@` becomes `%40`) — or pick a password without them.

**Login works, then logs you straight out**
`CLIENT_URL` on the API must list both `https://spicesoshop.com` and
`https://www.spicesoshop.com`, exactly.

**Product images disappear after a redeploy**
`STORAGE_DIR` is missing from the API's variables.

---

## Option B — VPS with Docker

Only if you move to a Hostinger VPS. Everything runs on one machine, the API is
served from the same domain under `/api`, and HTTPS is automatic.

### B1. Get the VPS

hPanel → **VPS → Get started** → **KVM 2** (KVM 1 works but builds slowly) →
operating system **Ubuntu 24.04 with Docker**. Set a root password and note the
**IP address**.

### B2. Point the domain at it

hPanel → **Domains → your domain → DNS records**. Replace the `@` and `www`
records with:

| Type | Name  | Points to   | TTL |
| ---- | ----- | ----------- | --- |
| A    | `@`   | your VPS IP | 300 |
| A    | `www` | your VPS IP | 300 |

Do this before B5 — the HTTPS certificate needs the domain pointing at the VPS.

### B3. Open a terminal on the VPS

hPanel → **VPS → your server → Browser terminal** (no SSH needed). Paste with
`Ctrl+Shift+V`. Or from PowerShell: `ssh root@YOUR_VPS_IP`.

### B4. Get the code and configure it

```
git clone https://github.com/Abdur-Rahim-MyGit/Smart-deal-store.git
cd Smart-deal-store
cp .env.production.example .env
nano .env
```

Put your domain in both lines (`DOMAIN=...` and `VITE_API_URL=https://.../api`).
Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

```
cp backend/.env.example backend/.env
nano backend/.env
```

Set `NODE_ENV=production`, `PORT=5050`, `MONGODB_URI`, the two JWT secrets
(`openssl rand -hex 48`, twice), `CLIENT_URL=https://yourdomain.com,https://www.yourdomain.com`,
`PUBLIC_API_URL=https://yourdomain.com/api` and `PAYMENT_MODE=test`.

The API runs as the restricted `node` user but Docker creates mounted folders as
`root`, so make the upload folders writable once:

```
mkdir -p backend/uploads backend/private-uploads
chown -R 1000:1000 backend/uploads backend/private-uploads
```

### B5. Start it

```
docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes 5–15 minutes. Then create your admin (see A3 for why not
the seed):

```
docker compose -f docker-compose.prod.yml exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD="a long password" api npm run create-admin
```

### B6. Everyday commands

| Goal                | Command                                                               |
| ------------------- | --------------------------------------------------------------------- |
| Deploy new code     | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| See what is running | `docker compose -f docker-compose.prod.yml ps`                        |
| Read the logs       | `docker compose -f docker-compose.prod.yml logs -f api`               |
| Restart everything  | `docker compose -f docker-compose.prod.yml restart`                   |

**No HTTPS:** `docker compose -f docker-compose.prod.yml logs caddy` — almost
always DNS not pointing at the VPS yet. **Image uploads fail:** re-run the
`chown` line, then restart. **Build runs out of memory on KVM 1:** add swap with
`fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`.

---

## Before taking real orders

- [ ] Never seed the live database; if you did, delete the demo accounts
- [ ] Connect a real payment provider and remove `PAYMENT_MODE=test`
- [ ] Set the SMTP or `RESEND_API_KEY` variables so order emails actually send
- [ ] Turn on Atlas backups
- [ ] Back up the uploads folder (`STORAGE_DIR`, or `backend/uploads` on a VPS)
