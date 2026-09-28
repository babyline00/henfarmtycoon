# ═══════════════════════════════════════════════════════
# HenFarmTycoon — Production Dockerfile (Phase 20)
# Multi-stage build → small standalone Next.js runtime
# ═══════════════════════════════════════════════════════

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json ./
COPY prisma ./prisma
# Use npm install for broad compatibility; switch to bun if your CI has it
RUN npm install --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL is only needed at build time for prisma generate
ENV DATABASE_URL="file:/app/db/custom.db"
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone output + static assets + public + prisma schema
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/db ./db

EXPOSE 3000

# Push schema (idempotent) then boot
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
