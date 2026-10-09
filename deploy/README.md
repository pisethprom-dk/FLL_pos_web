<!-- v1.0.0 -->
# Deploying the app on the EC2

The app at **https://pos.bgs-badminton.store**, on the EC2 that already runs
the backend (13.228.216.165). Its own nginx site, beside the backend's:

```
internet ─443─▶ nginx on the EC2
                 ├─ pos.bgs-badminton.store  the app: /var/www/pos-frontend  (this guide)
                 └─ bgs-badminton.store      the backend's site               (untouched)
```

**The app alone for now** (owner's choice, 2026-10-09). On
`pos.bgs-badminton.store`, nginx answers every `/api/` call with 503 until the
API is connected, so the sign-in page loads and says "POS back office", but
signing in fails. Connecting the API is the next step,
with its own plan — see the end of this guide.

## First deploy

**Before the server**

**1. DNS.** Wherever `bgs-badminton.store`'s DNS is managed, add an **A
record**: name `pos`, value `13.228.216.165`. On the Mac,
`dig +short pos.bgs-badminton.store` should print `13.228.216.165` (it can
take a few minutes). Certbot (step 8) fails until it does.

**2. GitHub.** Merge `operations-and-printing` into `main`: Pull requests →
New pull request → base `main` ← compare `operations-and-printing` → Create
→ Merge. The EC2 always pulls `main`.

**On the EC2** — connect as you usually do; the user is `ubuntu` below.

**3. Node 22 and rsync.**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs rsync
node -v        # v22.22.3 or later
```

**4. Memory for the build.** `free -h`. If Mem and Swap together come to
less than about 3 GB (a t3.small has 2 GB, and the backend uses some), add
2 GB of swap, once:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**5. The code and the web folder.**

```bash
cd ~
git clone https://github.com/pisethprom-dk/FLL_pos_web.git pos_frontend
sudo mkdir -p /var/www/pos-frontend
sudo chown ubuntu:ubuntu /var/www/pos-frontend
```

**6. Build and publish.**

```bash
~/pos_frontend/deploy/deploy.sh
```

A few minutes the first time. It ends with
`Published <commit> to /var/www/pos-frontend`.

**7. The nginx site.**

```bash
sudo cp ~/pos_frontend/deploy/nginx/pos-frontend.conf /etc/nginx/sites-available/pos-frontend
sudo ln -s /etc/nginx/sites-available/pos-frontend /etc/nginx/sites-enabled/pos-frontend
sudo nginx -t
```

`nginx -t` must end with `test is successful`. If it does not, stop and
remove the link (`sudo rm /etc/nginx/sites-enabled/pos-frontend`) — nothing
has changed yet. If it does:

```bash
sudo systemctl reload nginx
```

`http://pos.bgs-badminton.store` now shows the sign-in page.

**8. HTTPS.**

```bash
sudo certbot --nginx --redirect -d pos.bgs-badminton.store
```

It changes only this site's file: the certificate, HTTPS, and http → https.
The backend's site and certificate are not touched. It renews by itself
(`sudo certbot renew --dry-run` shows that renewal works).

**9. Check.**

- `https://pos.bgs-badminton.store` — the sign-in page, "POS back office".
- `https://pos.bgs-badminton.store/reports/daily-sales` — the same page (a
  screen's address opens the app; it sends you to sign in).
- `http://pos.bgs-badminton.store` — moves to https.
- `https://bgs-badminton.store/api/company/brand/` — answers as before.

## Updating

Merge the change into `main` on GitHub, then on the EC2:

```bash
~/pos_frontend/deploy/deploy.sh
```

No nginx reload is needed. Only if `deploy/nginx/pos-frontend.conf` itself
changed: copy it again (step 7) — which drops certbot's HTTPS lines — then
`sudo certbot --nginx --reinstall --redirect -d pos.bgs-badminton.store`.

## Taking it down

`sudo rm /etc/nginx/sites-enabled/pos-frontend && sudo systemctl reload nginx`
removes the site; the backend's site carries on as before.

## Next: connecting the API

Its own plan, agreed first. Roughly: this site's `/api/` (the 503 today) and
`/media/` go to Django on `127.0.0.1:8000` (one origin, so the sign-in cookie works with
no CORS); the backend's `.env` adds `pos.bgs-badminton.store` to
`ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`; `bgs-badminton.store/` redirects
here.
