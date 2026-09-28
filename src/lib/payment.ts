import { db } from '@/lib/db'

// ═════════════════════════════════════════════════════════════
// PHASE 34 — Complete Wallet System
//  • manual deposit flow with payment-proof verification
//  • withdrawals with full banking details (title/number/bank)
//  • deposit bonus tiers + first-deposit promo
//  • admin-managed payment accounts (bank/jazzcash/easypaisa/usdt)
// All money math is server-side only (never trust the client).
// ═════════════════════════════════════════════════════════════

// ── numeric wallet config keys (stored in GameConfig) ────────

export const WALLET_CONFIG_DEFAULTS: Record<string, number> = {
  coinsPerUsd: 1000,        // conversion rate: $1 = 1000 coins
  depositMinCents: 500,     // $5.00
  depositMaxCents: 50000,   // $500.00
  wdFeePct: 200,            // withdrawal fee, basis points (200 = 2%)
  wdMaxCoins: 500000,       // per-request cap
  firstDepositBonusPct: 10, // extra bonus on the very first deposit
  depositsDisabled: 0,      // Phase 26 emergency switch
}

// ── deposit bonus ladder ─────────────────────────────────────
// bigger top-ups earn a bigger bonus percentage

export const DEPOSIT_BONUS_TIERS: { minCents: number; bonusPct: number; label: string }[] = [
  { minCents: 10000, bonusPct: 20, label: '$100+' },
  { minCents: 5000, bonusPct: 15, label: '$50+' },
  { minCents: 2000, bonusPct: 10, label: '$20+' },
  { minCents: 500, bonusPct: 5, label: '$5+' },
]

export function depositBonusPct(cents: number, isFirstDeposit: boolean): number {
  const tier = DEPOSIT_BONUS_TIERS.find(t => cents >= t.minCents)?.bonusPct ?? 0
  return isFirstDeposit ? tier + WALLET_CONFIG_DEFAULTS.firstDepositBonusPct : tier
}

// ── payment methods (admin-editable account details) ─────────

export interface PayMethodDef {
  key: string
  name: string
  emoji: string
  fields: { key: string; label: string; placeholder: string; copyable?: boolean }[]
  needsProof: boolean
  instructions: string
}

export const PAY_METHOD_DEFS: PayMethodDef[] = [
  {
    key: 'bank', name: 'Bank Transfer', emoji: '🏦', needsProof: true,
    fields: [
      { key: 'accountTitle', label: 'Account Title', placeholder: 'HenFarm Ltd', copyable: true },
      { key: 'accountNo', label: 'Account Number / IBAN', placeholder: 'PK36SCBL...', copyable: true },
      { key: 'bankName', label: 'Bank Name', placeholder: 'Standard Chartered', copyable: true },
    ],
    instructions: 'Transfer the exact amount to the account below, then submit the receipt reference + screenshot as payment proof.',
  },
  {
    key: 'jazzcash', name: 'JazzCash', emoji: '📱', needsProof: true,
    fields: [
      { key: 'accountTitle', label: 'Account Title', placeholder: 'HenFarm Payments', copyable: true },
      { key: 'number', label: 'JazzCash Number', placeholder: '0300-1234567', copyable: true },
    ],
    instructions: 'Send money via the JazzCash app using “Send to Mobile Account”, keep the Txn ID and take a screenshot.',
  },
  {
    key: 'easypaisa', name: 'Easypaisa', emoji: '💚', needsProof: true,
    fields: [
      { key: 'accountTitle', label: 'Account Title', placeholder: 'HenFarm Payments', copyable: true },
      { key: 'number', label: 'Easypaisa Number', placeholder: '0345-7654321', copyable: true },
    ],
    instructions: 'Send via Easypaisa app or shop agent, then submit the Txn ID + screenshot as proof.',
  },
  {
    key: 'usdt', name: 'USDT (TRC20)', emoji: '💵', needsProof: true,
    fields: [
      { key: 'address', label: 'USDT Wallet Address', placeholder: 'TRX7x...', copyable: true },
      { key: 'network', label: 'Network', placeholder: 'TRC20', copyable: true },
    ],
    instructions: 'Send USDT on the TRC20 network only. Submit the TxID hash as the reference and a screenshot as proof.',
  },
]

export interface PayMethodAccount {
  enabled: boolean
  [k: string]: unknown
}

export type PayMethodsConfig = Record<string, PayMethodAccount>

export const PAY_METHODS_DEFAULT: PayMethodsConfig = {
  bank: { enabled: true, accountTitle: 'HenFarm Ltd', accountNo: 'PK36SCBL0000001123456702', bankName: 'Standard Chartered' },
  jazzcash: { enabled: true, accountTitle: 'HenFarm Payments', number: '0300-1234567' },
  easypaisa: { enabled: true, accountTitle: 'HenFarm Payments', number: '0345-7654321' },
  usdt: { enabled: true, address: 'TRX7xfarmTreasury9xK2mQpLd4vN8cW3eR', network: 'TRC20' },
}

const PAY_METHODS_KEY = 'payMethods'

export async function getPayMethods(): Promise<PayMethodsConfig> {
  try {
    const row = await db.gameConfig.findUnique({ where: { key: PAY_METHODS_KEY } })
    if (!row) return { ...PAY_METHODS_DEFAULT }
    const parsed = JSON.parse(row.value) as PayMethodsConfig
    // merge over defaults so new fields always exist
    const merged: PayMethodsConfig = {}
    for (const def of PAY_METHOD_DEFS) {
      const incoming = parsed[def.key] ?? {}
      const defaultEnabled = PAY_METHODS_DEFAULT[def.key]?.enabled ?? true
      merged[def.key] = { ...incoming, enabled: incoming.enabled ?? defaultEnabled }
    }
    return merged
  } catch {
    return { ...PAY_METHODS_DEFAULT }
  }
}

export async function savePayMethods(methods: PayMethodsConfig): Promise<void> {
  await db.gameConfig.upsert({
    where: { key: PAY_METHODS_KEY },
    update: { value: JSON.stringify(methods) },
    create: { key: PAY_METHODS_KEY, value: JSON.stringify(methods) },
  })
}

// ── validation helpers ───────────────────────────────────────

export function validMobile(v: string): boolean {
  return /^(\+92|0)?3\d{2}[- ]?\d{7}$/.test(v.replace(/[\s-]/g, '').replace(/^(\+92|0)(3\d{2})(\d{7})$/, '$1$2$3')) ||
    /^(\+92|0)?3\d{9}$/.test(v.replace(/[\s-]/g, ''))
}

export function validateWithdrawFields(
  method: string,
  accountTitle: string,
  accountNumber: string,
  bankName: string
): string | null {
  if (!accountTitle || accountTitle.trim().length < 3) return 'Account title is required (min 3 characters)'
  if (!accountNumber || accountNumber.trim().length < 6) return 'Account number / wallet address is required (min 6 characters)'
  if (method === 'bank' && (!bankName || bankName.trim().length < 2)) return 'Bank name is required for bank transfers'
  if ((method === 'jazzcash' || method === 'easypaisa') && !validMobile(accountNumber)) {
    return 'Enter a valid mobile number (e.g. 03001234567)'
  }
  if (method === 'usdt' && accountNumber.trim().length < 20) return 'Enter a valid USDT wallet address'
  if (method !== 'bank' && method !== 'jazzcash' && method !== 'easypaisa' && method !== 'usdt') {
    return 'Unsupported withdrawal method'
  }
  return null
}

export function withdrawFee(amount: number, feePctBp: number): number {
  return Math.min(Math.ceil((amount * feePctBp) / 10000), amount)
}

// proof image cap: ~600KB base64 (client resizes to ≤720px JPEG)
export const MAX_PROOF_LEN = 600_000

export function validProof(proof: string): boolean {
  return typeof proof === 'string' &&
    proof.startsWith('data:image/') &&
    proof.length < MAX_PROOF_LEN
}

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
