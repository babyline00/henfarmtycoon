import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isProd = process.env.NODE_ENV === 'production'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Per-query SQL logging is a development diagnostic. Leaving it on in
    // production writes every statement to stdout, which costs throughput
    // and floods any log aggregator with parameter values.
    log: isProd ? ['warn', 'error'] : ['query', 'warn', 'error'],
  })

if (!isProd) globalForPrisma.prisma = db
