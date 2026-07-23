# Hostinger VPS (KVM) deployment — Rideaux Bambou

## Requirements

- Hostinger **VPS KVM 2** (recommended): Ubuntu 22.04/24.04
- Domain DNS A record → VPS IP
- Node.js 20+, PostgreSQL, Nginx, PM2, Certbot

## First-time server setup

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

Create DB user/database, then set `DATABASE_URL` in `.env`.

## Deploy app

```bash
cd /var/www/rideaux-bamboux   # or your app path
git pull
cp .env.example .env          # first time only — fill secrets
npm ci
npx prisma migrate deploy
npm run build                 # builds + prepares standalone bundle
pm2 start ecosystem.config.cjs
# or after updates:
pm2 reload rideaux-bamboux
pm2 save
pm2 startup
```

Ensure the production `.env` is also available to the standalone process
(copy or symlink into `.next/standalone/.env`, or export vars in the PM2 env / systemd unit).

## Nginx (reverse proxy)

Point your domain to `http://127.0.0.1:3000`, then:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Health check

`GET /api/health`

## Notes

- Shared Hostinger hosting is **not** supported (needs Node + Postgres).
- Images use Cloudinary; keep Cloudinary env vars set.
- Orders are kept in PostgreSQL indefinitely — back up the DB regularly.
