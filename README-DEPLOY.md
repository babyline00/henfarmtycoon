# 🚀 HenFarmTycoon — Production Deployment Guide (Phase 20)

This guide ships the complete farming game platform (player app + Super Admin panel + game/economy/analytics engines) to a production server.

## Architecture

```
                        ┌─────────────┐
   Mobile App (PWA) ───▶│    Nginx    │ :80 (add TLS in prod)
                        └──────┬──────┘
                               │ reverse proxy
                        ┌──────▼──────┐
                        │  Next.js    │  game engine · economy engine
                        │  App Server │  API routes · admin panel
                        └──────┬──────┘
                     ┌─────────┼─────────┐
              ┌──────▼─────┐ ┌─▼──────┐
              │  SQLite /  │ │ Redis  │  cache · future rate-limit store
              │  Postgres  │ └────────┘
              └────────────┘
```

- **App**: Next.js 16 standalone build (game + admin + all APIs in one deployable)
- **Database**: SQLite volume by default. For horizontal scale, swap `DATABASE_URL` to a managed PostgreSQL and change `provider` in `prisma/schema.prisma`
- **Redis**: included in the compose stack for caching and shared rate-limit storage as you scale beyond one app instance

## Quick start (Docker)

```bash
# 1. Build & launch the whole stack
docker compose up -d --build

# 2. Seed demo data (admin/demo accounts, NPC market, clans)
docker compose exec app npx tsx scripts/seed.ts   # or bake into image

# 3. Open
#    http://SERVER_IP/            → mobile game (PWA-style layout)
#    Admin login → admin / admin123 (change immediately!)
#    Demo login  → demo / demo123
```

## Without Docker

```bash
npm install
npx prisma db push        # create/migrate SQLite
npm run build
npm run start             # serves on :3000
```

## Mobile release (Phase 20)

The app is a mobile-first web app (max-w-md phone layout, PWA-ready). To ship to stores:

- **Android**: wrap with Capacitor (`npx cap add android`), point `server.url` to your deployment, build AAB in Android Studio → Google Play Console
- **iOS**: Capacitor `npx cap add ios`, Apple Developer account, Xcode archive → App Store
- **Web**: deploy as-is; add a manifest.json for installable PWA

## Production checklist

- [ ] Change the default admin password (`admin/admin123`) immediately
- [ ] Point `DATABASE_URL` at a persistent volume (compose does this) or managed Postgres
- [ ] Enable TLS on nginx (certbot) and add HSTS
- [ ] Set up DB backups: `sqlite3 /app/db/custom.db ".backup /backups/$(date +%F).db"` via cron
- [ ] Wire Redis into `lib/security.ts` rate limiter when running >1 app replicas
- [ ] Monitor `/api/admin/analytics` weekly for economy inflation signal
- [ ] Review `/api/admin/security` flagged accounts and admin activity logs
- [ ] Swap mock payment gateway (`purchase_gems` / `purchase_vip`) for Stripe/Paddle webhooks before real money

## Rollback

```bash
git checkout <previous-tag>
docker compose up -d --build
```

Database migrations are additive (Prisma `db push`); to roll back data schema, restore the latest backup volume.
