# 🐔 HenFarmTycoon — Production Package

Complete, deployable source of the **farm + arcade + wallet** platform:
mobile-first player game, Super Admin panel, full wallet system
(manual-payment deposits with proof upload, withdrawals with account
title / account number / bank name), 2 arcade mini-games, social
(friends/clans), support center, AI assistant, anti-cheat, analytics
and deployment artifacts.

## 1. What's inside

| Path | Contents |
|---|---|
| `src/app/api/**` | 20+ API routes: auth, game engine, wallet, market, social, mini-games, support, AI advisor, notifications, leaderboard, 12 admin routes |
| `src/app/page.tsx` + `src/components/game/**` | Mobile-first UI (17 views): farm, shop, market, quests, social, games (Chicken Run / Road Crossing), wallet, profile, support, AI assistant, full admin panel |
| `src/lib/**` | Game economy, security (rate-limit/anti-cheat/roles), auth, mini-games engine, AI advisor, payment config |
| `prisma/schema.prisma` | 30+ models (users, farm, hens, genetics, wallet, deposits, withdrawals, transactions, mini-games, support tickets, clans, security events…) |
| `db/custom.db` | Pre-seeded SQLite database (works out of the box) |
| `scripts/` | `seed.ts`, smoke tests (47 + 43 checks), browser-verification screenshots, reset utilities |
| `deploy/` + `Dockerfile` + `docker-compose.yml` | 3-stage standalone Docker build, app+redis+nginx stack, reverse-proxy config |
| `tests/` | Runtime container verification scripts |
| `download/e2e/` | End-to-end QA screenshots of every major flow |
| `README-DEPLOY.md` | Full deployment guide (architecture, TLS, Capacitor mobile packaging) |

## 2. Quick start — Docker (recommended)

```bash
unzip HenFarmTycoon-Production.zip && cd henfarmtycoon
docker compose up -d --build
# seed demo data (skip if you keep the shipped db/custom.db)
docker compose exec app npx tsx scripts/seed.ts
# open http://SERVER_IP/
```

## 3. Quick start — Bare metal (Node 20+ or Bun)

```bash
unzip HenFarmTycoon-Production.zip && cd henfarmtycoon
bun install            # or: npm install
npx prisma generate
bun run build          # next standalone build
bun run start          # serves on :3000
```

## 4. Default accounts (CHANGE IMMEDIATELY)

- Super Admin: `admin` + the `ADMIN_PASSWORD` you supplied → Admin Panel → set your own password & roles

## 5. Production checklist

- [ ] Change the admin password (there is no demo player to rotate)
- [ ] Serve behind TLS (nginx conf in `deploy/` — add certbot/Let's Encrypt)
- [ ] Swap the **mock payment gateway** in `src/lib/payment.ts` /
      `purchase_gems` / `purchase_vip` actions for Stripe/Paddle before
      charging real money
- [ ] Review wallet limits & fees in Admin → Wallet Management
- [ ] For multi-instance scale: switch `DATABASE_URL` to PostgreSQL
      (see `.env.example`) and enable the Redis rate-limit store
- [ ] Enable automated DB backups (`db/` volume + `sqlite3 .backup` cron)
