# Deploying Smart Deal on Hostinger

Written for someone who has never deployed a Node app. Follow it top to bottom.
Every command starting with `$` is typed into the VPS terminal.

---

## 0. The one thing to understand first

Smart Deal is **not** a WordPress or PHP site. It is two Node.js programs that
have to stay running:

| Part | What it does | Where it lives |
| --- | --- | --- |
| Storefront | Renders the shop pages on the server | `src/` |
| API | Logins, products, orders, file uploads | `backend/` |

Hostinger's **shared plans** (Premium, Business, "Cloud Hosting") only run PHP.
They cannot run this app — there is no setting to switch on. You need a
**Hostinger VPS**, which is a real Ubuntu machine you control.

Your **domain stays where it is**. You do not lose it and you do not re-buy it.

---

## 1. Check what you already bought

1. Log in at <https://hpanel.hostinger.com>
2. Look at the top menu.
   - **Websites** / **Hosting** → shared hosting. Cannot run this app.
   - **VPS** → you already have what you need. Skip to step 2.
3. Click **Domains**. Your domain should be listed. Good — keep it.

If you only have shared hosting, it is not wasted: you can park a landing page
on it, or ask Hostinger support to move the unused credit onto a VPS plan.
It is worth asking; they often do it.

---

## 2. Get the VPS

In hPanel: **VPS → Get started**, then:

- **Plan**: KVM 1 works (1 vCPU / 4 GB RAM). **KVM 2** (2 vCPU / 8 GB) is
  noticeably more comfortable because building the storefront is CPU-heavy.
- **Location**: closest to your customers.
- **Operating system**: choose **Ubuntu 24.04 with Docker**. If that exact
  template is missing, pick plain **Ubuntu 24.04** — step 5 installs Docker.
- Set a **root password** and save it somewhere safe.

When it finishes, hPanel shows the VPS **IP address** (like `82.112.x.x`).
Write it down — you need it twice below.

---

## 3. Free database (MongoDB Atlas)

Your data lives here, managed and backed up, at no cost.

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>
2. Create a **free M0 cluster** (pick a region near your VPS).
3. **Database Access** → *Add New Database User*. Username + a long password.
   Save both.
4. **Network Access** → *Add IP Address* → enter your **VPS IP address**.
   (`0.0.0.0/0` also works but lets anyone try to connect — prefer the VPS IP.)
5. **Database → Connect → Drivers** and copy the connection string. It looks like:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smartdeal?retryWrites=true&w=majority
   ```

   Replace `USER` and `PASSWORD` with the ones from step 3, and make sure
   `/smartdeal` is in there before the `?`. Keep this string for step 6.

---

## 4. Point the domain at the VPS

hPanel → **Domains → your domain → DNS / Nameservers → DNS records**.

Delete any existing `A` records for `@` and `www`, then add:

| Type | Name | Points to | TTL |
| --- | --- | --- | --- |
| A | `@` | your VPS IP | 300 |
| A | `www` | your VPS IP | 300 |

DNS usually updates in 5–30 minutes. **Do this before step 7**, because the
HTTPS certificate can only be issued once the domain points at the VPS.

---

## 5. Log into the VPS

**Easiest way (no SSH needed):** in hPanel open **VPS -> your server -> Browser terminal**.
That gives you the same black screen in your web browser, already logged in.
Skip to the Docker line below.

**Or from your PC:** open **PowerShell** and run (use your real IP):

```
ssh root@82.112.x.x
```

Type `yes`, then the root password. You are now on the server.

> In this black screen, `Ctrl+V` does not paste. Use **right-click** (PowerShell)
> or `Ctrl+Shift+V` (browser terminal) instead.

Install Docker only if you did **not** pick the Docker template:

```
$ curl -fsSL https://get.docker.com | sh
```

---

## 6. Put the code on the server

First, on **your PC**, push your latest work to GitHub:

```
git add -A
git commit -m "Prepare for deployment"
git push
```

Then, on the **VPS**:

```
$ git clone https://github.com/Abdur-Rahim-MyGit/Smart-deal-store.git
$ cd Smart-deal-store
```

If the repo is private, GitHub will ask for a username and password — use a
**Personal Access Token** as the password
(<https://github.com/settings/tokens> → *Generate new token (classic)* → tick `repo`).

### 6a. Storefront settings

```
$ cp .env.production.example .env
$ nano .env
```

Replace `example.com` with your real domain in both lines:

```
DOMAIN=yourdomain.com
VITE_API_URL=https://yourdomain.com/api
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

### 6b. API settings

```
$ cp backend/.env.example backend/.env
$ nano backend/.env
```

Set these (leave the rest as-is for now):

```
NODE_ENV=production
PORT=5050
MONGODB_URI=<the Atlas string from step 3>
CLIENT_URL=https://yourdomain.com,https://www.yourdomain.com
PUBLIC_API_URL=https://yourdomain.com/api
COOKIE_SAMESITE=lax
JWT_SECRET=<long random string>
JWT_REFRESH_SECRET=<a DIFFERENT long random string>
PAYMENT_MODE=test
```

To generate the two secrets, run this twice and paste a different result into each:

```
$ openssl rand -hex 48
```

> Leave `PAYMENT_MODE=test` until a real Stripe account is connected. Real card
> charges need `STRIPE_SECRET_KEY` and `PAYMENT_MODE` removed.

### 6c. Make the upload folders writable

The API deliberately runs as the restricted `node` user, but Docker creates
mounted folders owned by `root`. Without this step, uploading a product image
fails with a permission error. Run it once:

```
$ mkdir -p backend/uploads backend/private-uploads
$ chown -R 1000:1000 backend/uploads backend/private-uploads
```

---

## 7. Start the site

```
$ docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes **5–15 minutes** (it compiles the whole storefront).
Watch it with:

```
$ docker compose -f docker-compose.prod.yml logs -f
```

Press `Ctrl+C` to stop watching — that does not stop the site.

Now open **https://yourdomain.com**. HTTPS is issued automatically; no
certificate to buy or install.

### Load the demo data (optional)

```
$ docker compose -f docker-compose.prod.yml exec api npm run seed
```

---

## 8. Everyday commands

Run all of these from `~/Smart-deal-store` on the VPS.

| Goal | Command |
| --- | --- |
| Deploy new code | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| See what is running | `docker compose -f docker-compose.prod.yml ps` |
| Read the logs | `docker compose -f docker-compose.prod.yml logs -f api` |
| Restart everything | `docker compose -f docker-compose.prod.yml restart` |
| Stop the site | `docker compose -f docker-compose.prod.yml down` |
| Free up disk space | `docker system prune -af` |

---

## 9. When something goes wrong

**The page does not load at all**
Check DNS has actually moved: `ping yourdomain.com` should answer with your VPS
IP. If it shows a different IP, wait longer or re-check step 4.

**"Your connection is not private" / no HTTPS**
Caddy could not get a certificate, almost always because DNS is not pointing at
the VPS yet, or ports 80/443 are blocked. Check with:

```
$ docker compose -f docker-compose.prod.yml logs caddy
$ ufw allow 80 && ufw allow 443
```

**Site loads but products are empty and login fails**
The API cannot reach the database. Check:

```
$ docker compose -f docker-compose.prod.yml logs api
```

Usually the Atlas IP allowlist (step 3.4) is missing the VPS IP, or the password
in `MONGODB_URI` is wrong. If the password contains `@ : / ?` or `#`, they must
be percent-encoded (`@` becomes `%40`).

**Uploading a product image fails**
The upload folders are owned by `root` instead of the container user. Re-run
step 6c, then `docker compose -f docker-compose.prod.yml restart api`.

**Login works then immediately logs out**
`CLIENT_URL` in `backend/.env` does not exactly match the address in the browser
(`https://` and `www.` must match). Fix it, then `restart`.

**The build runs out of memory on KVM 1**
Add swap once, then build again:

```
$ fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
$ echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 10. Before taking real orders

- [ ] Change every default password from the seed data
- [ ] Connect a real payment provider and remove `PAYMENT_MODE=test`
- [ ] Set the SMTP or `RESEND_API_KEY` values so order emails actually send
- [ ] Turn on Atlas backups
- [ ] Back up `backend/uploads/` — those files live only on the VPS disk
