'use client'

// ══════════════════════════════════════════════════════════════
// PHASE 34 — Complete Wallet System (player side)
//  • deposits: manual payment methods + proof upload + bonus ladder
//  • withdrawals: full banking details (title / number / bank) + fee
//  • wallet stats + saved payment profile
// ══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useGame, api } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GameCard, SectionTitle, ErrorState, LoadingSpinner } from './shared'
import { cn } from '@/lib/utils'

interface DepositRow {
  id: string
  amountCents: number
  method: string
  reference: string
  coins: number
  bonusCoins: number
  status: string
  note?: string | null
  createdAt: string
}
interface WdRow {
  id: string
  amount: number
  method: string
  address: string
  accountTitle: string
  bankName: string
  fee: number
  status: string
  createdAt: string
  note?: string | null
}
interface PayMethod {
  key: string
  name: string
  emoji: string
  instructions: string
  fields: { key: string; label: string; placeholder: string; copyable?: boolean }[]
  enabled: boolean
  account: Record<string, string>
}
interface WalletData {
  deposits: DepositRow[]
  withdrawals: WdRow[]
  payMethods: PayMethod[]
  walletCfg: {
    coinsPerUsd: number
    depositMinCents: number
    depositMaxCents: number
    wdFeePct: number
    wdMaxCoins: number
    withdrawalMin: number
    firstDepositBonusPct: number
    bonusTiers: { minCents: number; bonusPct: number; label: string }[]
  }
  savedProfile: { title: string | null; account: string | null; bank: string | null; hasSaved: boolean }
  stats: { totalDepositedCents: number; approvedDeposits: number; totalWithdrawnCoins: number; pendingDeposits: number }
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`

const WD_METHODS = [
  { key: 'bank', label: '🏦 Bank' },
  { key: 'jazzcash', label: '📱 JazzCash' },
  { key: 'easypaisa', label: '💚 Easypaisa' },
  { key: 'usdt', label: '💵 USDT' },
]

const PRESETS = [5, 10, 25, 50, 100]

/** Downscale an uploaded proof image in the browser before upload, so a
 *  phone screenshot does not become a multi-megabyte data URL in a JSON
 *  column. Keeps aspect ratio and never upscales. */
function fileToResizedDataUrl(file: File, maxSize = 720, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => { img.src = reader.result as string }
    reader.onerror = () => reject(new Error('read failed'))
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas unsupported'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('image failed'))
    reader.readAsDataURL(file)
  })
}

function statusChip(status: string) {
  return cn(
    'rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
    status === 'approved' ? 'bg-green-100 text-green-700'
      : status === 'rejected' ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700',
  )
}

export function WalletView() {
  const { act, loading, showFlash } = useGame()
  const [data, setData] = useState<WalletData | null>(null)
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [reloadKey, setReloadKey] = useState(0)

  // deposit form
  const [depMethod, setDepMethod] = useState('bank')
  const [depAmount, setDepAmount] = useState('10')
  const [senderName, setSenderName] = useState('')
  const [reference, setReference] = useState('')
  const [proof, setProof] = useState('')
  const [proofBusy, setProofBusy] = useState(false)

  // withdraw form
  const [wdMethod, setWdMethod] = useState('bank')
  const [wdAmount, setWdAmount] = useState('')
  const [wdTitle, setWdTitle] = useState('')
  const [wdNumber, setWdNumber] = useState('')
  const [wdBank, setWdBank] = useState('')
  const [saveProfile, setSaveProfile] = useState(true)

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  // A failed wallet load used to leave `data` null, which rendered the same
  // "Loading wallet..." forever with no error and no way to retry. Balances
  // and pending payouts are money, so silence here is the worst option.
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    ;(async () => {
      try {
        const d = await api<WalletData>('/api/wallet')
        if (cancelled) return
        setData(d)
        // default the deposit method to the first enabled option
        const firstEnabled = d.payMethods.find(m => m.enabled)
        if (firstEnabled) {
          setDepMethod(m => (d.payMethods.find(x => x.key === m)?.enabled ? m : firstEnabled.key))
        }
        if (d.savedProfile.hasSaved) {
          setWdTitle(t => t || d.savedProfile.title || '')
          setWdNumber(t => t || d.savedProfile.account || '')
          setWdBank(t => t || d.savedProfile.bank || '')
        }
      } catch (e) {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'Could not load your wallet')
      }
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  if (loadError) {
    return (
      <GameCard>
        <ErrorState title="Couldn't load your wallet" message={loadError} onRetry={reload} />
      </GameCard>
    )
  }

  if (!data) {
    return <GameCard><LoadingSpinner label="Loading wallet…" /></GameCard>
  }

  const { walletCfg: cfg, stats } = data
  const methods = data.payMethods
  const depCents = Math.round(Number(depAmount) * 100) || 0
  const firstDeposit = stats.approvedDeposits === 0
  const tierPct = [...cfg.bonusTiers]
    .sort((a, b) => b.minCents - a.minCents)
    .find(t => depCents >= t.minCents)?.bonusPct ?? 0
  const bonusPct = firstDeposit ? tierPct + cfg.firstDepositBonusPct : tierPct
  const previewCoins = Math.floor(depCents / 100) * cfg.coinsPerUsd
  const previewBonus = Math.floor((previewCoins * bonusPct) / 100)

  const wdAmountNum = Math.floor(Number(wdAmount)) || 0
  const wdFee = Math.min(Math.ceil((wdAmountNum * cfg.wdFeePct) / 10000), wdAmountNum || 1)
  const wdPayout = Math.max(0, wdAmountNum - wdFee)

  function copy(text: string) {
    try {
      void navigator.clipboard.writeText(text)
      showFlash('📋 Copied to clipboard!')
    } catch { /* clipboard blocked */ }
  }

  async function handleProof(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) {
      showFlash('Please choose an image file (screenshot)', 'error')
      return
    }
    if (f.size > 8 * 1024 * 1024) {
      showFlash('Image too large — max 8MB', 'error')
      return
    }
    setProofBusy(true)
    try {
      setProof(await fileToResizedDataUrl(f))
    } catch {
      showFlash('Could not read that image, try another', 'error')
    } finally {
      setProofBusy(false)
    }
  }

  async function submitDeposit() {
    const res = await act('deposit', {
      amountCents: depCents, method: depMethod, senderName, reference, proof,
    })
    if (res) {
      setSenderName(''); setReference(''); setProof('')
      reload()
    }
  }

  async function submitWithdraw() {
    const res = await act('withdraw', {
      amount: wdAmountNum, method: wdMethod,
      accountTitle: wdTitle, accountNumber: wdNumber,
      bankName: wdMethod === 'bank' ? wdBank : '',
      save: saveProfile,
    })
    if (res) {
      setWdAmount('')
      reload()
    }
  }

  const depositValid =
    depCents >= cfg.depositMinCents && depCents <= cfg.depositMaxCents &&
    senderName.trim().length >= 3 && reference.trim().length >= 4 && proof.length > 10 &&
    methods.find(m => m.key === depMethod)?.enabled

  const withdrawValid =
    wdAmountNum >= cfg.withdrawalMin && wdAmountNum <= cfg.wdMaxCoins &&
    wdTitle.trim().length >= 3 && wdNumber.trim().length >= 6 &&
    (wdMethod !== 'bank' || wdBank.trim().length >= 2)

  return (
    <div className="space-y-2">
      {/* ── wallet stats ── */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-xl border border-green-200 bg-green-50 p-2 text-center">
          <p className="text-[9px] font-black uppercase text-green-700">Deposited</p>
          <p className="text-sm font-black tabular-nums text-green-800">{usd(stats.totalDepositedCents)}</p>
          <p className="text-[8px] text-green-600">{stats.approvedDeposits} approved</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-center">
          <p className="text-[9px] font-black uppercase text-red-600">Withdrawn</p>
          <p className="text-sm font-black tabular-nums text-red-700">🪙 {stats.totalWithdrawnCoins.toLocaleString()}</p>
          <p className="text-[8px] text-red-500">lifetime</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center">
          <p className="text-[9px] font-black uppercase text-amber-700">Pending</p>
          <p className="text-sm font-black tabular-nums text-amber-700">
            {stats.pendingDeposits + data.withdrawals.filter(w => w.status === 'pending' || w.status === 'hold').length}
          </p>
          <p className="text-[8px] text-amber-600">requests in review</p>
        </div>
      </div>

      {/* ── mode switch ── */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Wallet mode">
        <button
          role="tab"
          aria-selected={mode === 'deposit'}
          onClick={() => setMode('deposit')}
          className={cn('rounded-xl py-2 text-xs font-extrabold transition-all', mode === 'deposit' ? 'bg-white text-green-700 shadow' : 'text-stone-600')}
        >
          📥 Deposit Cash
        </button>
        <button
          role="tab"
          aria-selected={mode === 'withdraw'}
          onClick={() => setMode('withdraw')}
          className={cn('rounded-xl py-2 text-xs font-extrabold transition-all', mode === 'withdraw' ? 'bg-white text-red-700 shadow' : 'text-stone-600')}
        >
          💸 Withdraw Coins
        </button>
      </div>

      {/* ══════════ DEPOSIT ══════════ */}
      {mode === 'deposit' && (
        <GameCard>
          <p className="text-sm font-black text-stone-800">📥 Deposit Cash</p>
          <p className="text-[11px] text-stone-500">
            Rate: {usd(100)} = 🪙 {cfg.coinsPerUsd.toLocaleString()} coins · manual payment, verified by admins
          </p>

          {/* amount presets */}
          <div className="mt-2 grid grid-cols-5 gap-1">
            {PRESETS.map(p => (
              <button key={p}
                onClick={() => setDepAmount(String(p))}
                aria-pressed={Number(depAmount) === p}
                className={cn(
                  'min-h-9 rounded-lg border py-1.5 text-[11px] font-black',
                  Number(depAmount) === p ? 'border-green-600 bg-green-50 text-green-700' : 'border-stone-200 text-stone-600',
                )}
              >
                ${p}
              </button>
            ))}
          </div>
          <div className="mt-1.5">
            <Label htmlFor="wd-dep-amount" className="text-[10px] font-bold text-stone-500">
              Custom amount (USD {usd(cfg.depositMinCents)} – {usd(cfg.depositMaxCents)})
            </Label>
            <Input id="wd-dep-amount" type="number" min={1} value={depAmount}
              onChange={e => setDepAmount(e.target.value)}
              className="mt-1 h-9 rounded-lg bg-stone-50"
              placeholder="10.00"
            />
          </div>

          {/* bonus preview */}
          {previewCoins > 0 && (
            <div className="mt-2 rounded-xl bg-gradient-to-r from-amber-100 to-yellow-50 px-3 py-2">
              <p className="text-[11px] font-black text-amber-800">
                You get 🪙 {previewCoins.toLocaleString()} coins
                {bonusPct > 0 && (
                  <>
                    <span className="text-green-700"> + {bonusPct}% bonus (🪙 +{previewBonus.toLocaleString()})</span>
                    {firstDeposit && (
                      <span className="ml-1 rounded-full bg-green-700 px-1.5 py-0.5 text-[8px] font-black text-white">
                        FIRST DEPOSIT
                      </span>
                    )}
                  </>
                )}
              </p>
              <p className="text-[10px] font-bold text-amber-700">
                Total after approval: 🪙 {(previewCoins + previewBonus).toLocaleString()}
              </p>
            </div>
          )}

          {/* payment method picker */}
          <Label className="mt-2 block text-[10px] font-bold text-stone-500">Payment method</Label>
          {methods.length === 0 ? (
            <p className="mt-1 rounded-lg bg-stone-50 px-2 py-1.5 text-[11px] font-bold text-stone-600">
              No payment methods available right now
            </p>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-1">
              {methods.map(m => (
                <button key={m.key}
                  onClick={() => setDepMethod(m.key)}
                  disabled={!m.enabled}
                  aria-pressed={depMethod === m.key}
                  className={cn(
                    'min-h-9 rounded-lg border py-1.5 text-[11px] font-black',
                    depMethod === m.key ? 'border-green-600 bg-green-50 text-green-700' : 'border-stone-200 text-stone-600',
                    !m.enabled && 'opacity-40',
                  )}
                >
                  <span aria-hidden="true">{m.emoji}</span> {m.name}{!m.enabled && ' (off)'}
                </button>
              ))}
            </div>
          )}

          {/* account details + instructions */}
          {methods.filter(m => m.key === depMethod).map(m => (
            <div key={m.key} className="mt-2 rounded-xl border border-green-200 bg-green-50/60 p-2.5">
              <p className="text-[10px] font-black uppercase text-green-700">Pay to — {m.name}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-stone-600">{m.instructions}</p>
              <div className="mt-1.5 space-y-1">
                {m.fields.map(f => (
                  <div key={f.key} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-[8px] font-black uppercase text-stone-600">{f.label}</p>
                      <p className="truncate text-[11px] font-bold text-stone-700">{m.account[f.key] || '—'}</p>
                    </div>
                    {m.account[f.key] && (
                      <button
                        onClick={() => copy(m.account[f.key])}
                        aria-label={`Copy ${f.label}`}
                        className="min-h-9 shrink-0 rounded-full bg-stone-100 px-2 py-1 text-[9px] font-black text-stone-700 active:scale-95"
                      >
                        📋 Copy
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* payment details form */}
          <div className="mt-2 space-y-2">
            <div>
              <Label htmlFor="wd-sender" className="text-[10px] font-bold text-stone-500">Sender account title (name on receipt) *</Label>
              <Input id="wd-sender" value={senderName} onChange={e => setSenderName(e.target.value)} className="mt-1 h-9 rounded-lg bg-stone-50" placeholder="e.g. Ahmed Raza" />
            </div>
            <div>
              <Label htmlFor="wd-ref" className="text-[10px] font-bold text-stone-500">Transaction reference / TxID *</Label>
              <Input id="wd-ref" value={reference} onChange={e => setReference(e.target.value)} className="mt-1 h-9 rounded-lg bg-stone-50" placeholder="e.g. 88372619283" />
            </div>
            <div>
              <Label htmlFor="wd-proof" className="text-[10px] font-bold text-stone-500">Payment proof (screenshot) *</Label>
              <input id="wd-proof" type="file" accept="image/*" onChange={handleProof}
                className="mt-1 w-full rounded-lg border border-dashed border-stone-300 bg-stone-50 px-2 py-2 text-[11px] text-stone-600 file:mr-2 file:rounded-full file:border-0 file:bg-green-700 file:px-3 file:py-1 file:text-[10px] file:font-black file:text-white"
              />
              {proofBusy && <p className="mt-1 text-[10px] font-bold text-stone-600">⏳ Processing image…</p>}
              {proof && (
                <div className="mt-1.5 flex items-center gap-2">
                  <img src={proof} alt="Payment proof preview" className="h-14 w-14 rounded-lg border border-stone-200 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-green-700">✅ Proof attached</p>
                    <p className="text-[9px] text-stone-600">{Math.round(proof.length / 1024)} KB · resized automatically</p>
                  </div>
                  <button onClick={() => setProof('')} aria-label="Remove proof" className="min-h-9 rounded-full bg-red-50 px-2 py-1 text-[9px] font-black text-red-600">Remove</button>
                </div>
              )}
            </div>
            <Button onClick={submitDeposit} disabled={loading || !depositValid || proofBusy}
              className="h-10 w-full rounded-xl bg-green-700 font-extrabold text-white disabled:opacity-40"
            >
              📤 Submit Deposit {previewCoins > 0 ? `— ${usd(depCents)} → 🪙 ${(previewCoins + previewBonus).toLocaleString()}` : 'Request'}
            </Button>
            <p className="text-center text-[9px] text-stone-600">
              Coins are credited after admin verification. Fake proof = permanent ban.
            </p>
          </div>
        </GameCard>
      )}

      {/* ══════════ WITHDRAW ══════════ */}
      {mode === 'withdraw' && (
        <GameCard>
          <p className="text-sm font-black text-stone-800">💸 Withdraw Coins</p>
          <p className="text-[11px] text-stone-500">
            Min 🪙 {cfg.withdrawalMin.toLocaleString()} · max 🪙 {cfg.wdMaxCoins.toLocaleString()} · {cfg.wdFeePct / 100}% processing fee
          </p>

          <div className="mt-2">
            <Label className="text-[10px] font-bold text-stone-500">Payout method</Label>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {WD_METHODS.map(m => (
                <button key={m.key}
                  onClick={() => setWdMethod(m.key)}
                  aria-pressed={wdMethod === m.key}
                  className={cn(
                    'min-h-9 rounded-lg border py-1.5 text-[10px] font-black',
                    wdMethod === m.key ? 'border-red-500 bg-red-50 text-red-700' : 'border-stone-200 text-stone-600',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 space-y-2">
            <div>
              <Label htmlFor="wd-title" className="text-[10px] font-bold text-stone-500">Account title (holder name) *</Label>
              <Input id="wd-title" value={wdTitle} onChange={e => setWdTitle(e.target.value)} className="mt-1 h-9 rounded-lg bg-stone-50" placeholder="e.g. Ahmed Raza" />
            </div>
            {wdMethod === 'bank' && (
              <div>
                <Label htmlFor="wd-bank" className="text-[10px] font-bold text-stone-500">Bank name *</Label>
                <Input id="wd-bank" value={wdBank} onChange={e => setWdBank(e.target.value)} className="mt-1 h-9 rounded-lg bg-stone-50" placeholder="e.g. HBL / Standard Chartered" />
              </div>
            )}
            <div>
              <Label htmlFor="wd-number" className="text-[10px] font-bold text-stone-500">
                {wdMethod === 'bank' ? 'Account number / IBAN *' : wdMethod === 'usdt' ? 'USDT wallet address (TRC20) *' : 'Mobile number *'}
              </Label>
              <Input id="wd-number" value={wdNumber} onChange={e => setWdNumber(e.target.value)} className="mt-1 h-9 rounded-lg bg-stone-50"
                placeholder={wdMethod === 'usdt' ? 'TRX7x…' : wdMethod === 'bank' ? 'PK36…' : '03001234567'} />
            </div>
            <div>
              <Label htmlFor="wd-amount" className="text-[10px] font-bold text-stone-500">Amount (coins)</Label>
              <Input id="wd-amount" type="number" value={wdAmount} onChange={e => setWdAmount(e.target.value)} className="mt-1 h-9 rounded-lg bg-stone-50" placeholder={`Min ${cfg.withdrawalMin}`} />
            </div>
            {wdAmountNum >= cfg.withdrawalMin && (
              <div className="rounded-lg bg-stone-50 px-2 py-1.5 text-[11px] font-bold text-stone-600">
                Fee: 🪙 {wdFee.toLocaleString()} → You receive: <b className="text-green-700">🪙 {wdPayout.toLocaleString()}</b>
              </div>
            )}
            <label className="flex min-h-9 items-center gap-2 text-[11px] font-bold text-stone-600">
              <input type="checkbox" checked={saveProfile} onChange={e => setSaveProfile(e.target.checked)} className="accent-green-600" />
              💾 Save these details for faster withdrawals
            </label>
            {data.savedProfile.hasSaved && (
              <p className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                ✓ Saved payment details auto-filled. Manage them below.
              </p>
            )}
            <Button onClick={submitWithdraw} disabled={loading || !withdrawValid}
              className="h-10 w-full rounded-xl bg-red-700 font-extrabold text-white disabled:opacity-40"
            >
              💸 Submit Withdrawal {wdAmountNum >= cfg.withdrawalMin ? `— 🪙 ${wdPayout.toLocaleString()} payout` : 'Request'}
            </Button>
            <p className="text-center text-[9px] text-stone-600">
              Coins are deducted immediately and refunded if the request is rejected.
            </p>
          </div>
        </GameCard>
      )}

      {/* ── deposit bonus ladder ── */}
      <SectionTitle>🎁 Deposit Bonuses</SectionTitle>
      <GameCard className="bg-gradient-to-r from-amber-50 to-white">
        <div className="flex flex-wrap gap-1.5">
          {cfg.bonusTiers.map(t => (
            <span key={t.minCents} className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-black',
              depCents >= t.minCents ? 'bg-green-700 text-white' : 'bg-stone-100 text-stone-600',
            )}>
              {t.label} → +{t.bonusPct}%
            </span>
          ))}
          <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-black text-purple-700">
            🌟 1st deposit +{cfg.firstDepositBonusPct}% extra
          </span>
        </div>
      </GameCard>

      {/* ── recent deposits ── */}
      {data.deposits.length > 0 && (
        <>
          <SectionTitle>📥 Recent Deposits</SectionTitle>
          <div className="space-y-1">
            {data.deposits.map(d => (
              <GameCard key={d.id} className="flex items-center gap-2 py-2">
                <span className="text-lg" aria-hidden="true">{WD_METHODS.find(m => m.key === d.method)?.label.split(' ')[0] ?? '💵'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-stone-700">
                    {usd(d.amountCents)} → 🪙 {(d.coins + d.bonusCoins).toLocaleString()}
                    {d.bonusCoins > 0 && <span className="text-green-600"> (+{d.bonusCoins.toLocaleString()} bonus)</span>}
                  </p>
                  <p className="text-[9px] text-stone-600">Ref {d.reference} · {new Date(d.createdAt).toLocaleDateString()}</p>
                  {d.note && <p className="text-[9px] text-red-600">Admin: {d.note}</p>}
                </div>
                <span className={statusChip(d.status)}>{d.status}</span>
              </GameCard>
            ))}
          </div>
        </>
      )}

      {/* ── recent withdrawals ── */}
      {data.withdrawals.length > 0 && (
        <>
          <SectionTitle>💸 Recent Withdrawals</SectionTitle>
          <div className="space-y-1">
            {data.withdrawals.map(w => (
              <GameCard key={w.id} className="flex items-center gap-2 py-2">
                <span className="text-lg" aria-hidden="true">{WD_METHODS.find(m => m.key === w.method)?.label.split(' ')[0] ?? '🏦'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-stone-700">
                    🪙 {w.amount.toLocaleString()} → payout 🪙 {(w.amount - w.fee).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-stone-600">
                    {w.accountTitle || '—'} · {w.bankName || w.method.toUpperCase()} · {new Date(w.createdAt).toLocaleDateString()}
                  </p>
                  {w.note && <p className="text-[9px] text-red-600">Admin: {w.note}</p>}
                </div>
                <span className={statusChip(w.status)}>{w.status}</span>
              </GameCard>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
