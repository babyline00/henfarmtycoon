'use client'

import { useState } from 'react'
import { useGame } from '@/lib/store'
import {
  HEN_TYPES, ANIMAL_TYPES, EGG_TYPES, UPGRADES, FARMER_LEVELS,
  ITEM_TYPES, GEM_PACKS, VIP_PLANS,
} from '@/lib/game'
import { Button } from '@/components/ui/button'
import { GameCard, RarityBadge } from './shared'
import { cn } from '@/lib/utils'

type Tab = 'hens' | 'eggs' | 'animals' | 'items' | 'upgrades' | 'premium'

const HEN_REQ_LEVEL: Record<string, number> = { normal: 0, golden: 1, royal: 2, magic: 3 }

// building defs (server holds authoritative prices)
const BUILDINGS = [{
  key: 'incubator', name: 'Incubator Room', emoji: '🏹',
  levelField: 'incubatorLevel' as const, maxLevel: 2,
  prices: [0, 3000, 12000],
  effectFor: (lvl: number) => `${[4, 6, 8][lvl]} incubator slots`,
},
{
  key: 'feedFactory', name: 'Feed Factory', emoji: '🏭',
  levelField: 'feedFactoryLevel' as const, maxLevel: 3,
  prices: [0, 1500, 5000, 15000],
  effectFor: (lvl: number) => lvl === 0 ? 'Unlock feed discounts' : `-${[0, 10, 20, 30][lvl]}% feed price`,
},
{
  key: 'shelter', name: 'Animal Shelter', emoji: '🏚️',
  levelField: 'shelterLevel' as const, maxLevel: 3,
  prices: [0, 2500, 8000, 20000],
  effectFor: (lvl: number) => lvl === 0 ? 'Bigger animal cap + production' : `${[6, 10, 16, 24][lvl]} animal cap · +${[0, 5, 10, 15][lvl]}% animal output`,
},
]

const PAY_METHODS = [
  { key: 'card', label: '💳 Card' },
  { key: 'bank', label: '🏦 Bank' },
  { key: 'usdt', label: '💵 USDT' },
]

const TAB_LABELS: Record<Tab, string> = {
  hens: '🐔 Hens',
  eggs: '🥚 Eggs',
  animals: '🐄 Animals',
  items: '🎒 Items',
  upgrades: '🏗️ Build',
  premium: '👑 Premium',
}

export function ShopView() {
  const { state, act, loading } = useGame()
  const [tab, setTab] = useState<Tab>('hens')
  const [payMethod, setPayMethod] = useState('card')

  if (!state) return null

  const { user, farm, hens, animals } = state
  const levelIdx = user.levelIdx

  async function buy(itemType: string, subType: string) {
    await act('buy', { itemType, subType })
  }

  return (
    <div className="space-y-3 px-3 pb-4">
      <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm">
        <p className="text-lg font-black text-stone-800">🛒 Farm Shop</p>
        <p className="text-xs text-stone-600">Spend coins to grow your empire. Higher farmer levels unlock rarer breeds.</p>
      </div>

      {/* tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Shop sections">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'min-h-9 rounded-xl py-2 text-xs font-extrabold transition-all',
              tab === t ? 'bg-white text-green-700 shadow' : 'text-stone-600',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── hens ── */}
      {tab === 'hens' && (
        <div className="space-y-2">
          {Object.values(HEN_TYPES).map(def => {
            const locked = levelIdx < (HEN_REQ_LEVEL[def.key] ?? 0)
            const affordable = user.coins >= def.price
            const full = hens.length >= farm.coopCap
            const reqName = FARMER_LEVELS[HEN_REQ_LEVEL[def.key]]?.name
            return (
              <GameCard key={def.key} className={cn(locked && 'opacity-75')}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-3xl">
                    <span aria-hidden="true">{def.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-black text-stone-800">{def.name}</p>
                      <RarityBadge rarity={def.rarity} />
                    </div>
                    <p className="text-[11px] leading-tight text-stone-600">{def.desc}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-bold text-stone-600">
                      <span>🥚 {(def.eggsPerHour * 24).toFixed(0)} eggs/day</span>
                      <span>⏳ {def.lifespanDays}d life</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-amber-700">🪙 {def.price.toLocaleString()}</p>
                    {locked ? (
                      <div className="mt-1 rounded-full bg-stone-200 px-2 py-1 text-[10px] font-bold text-stone-700">
                        🔒 {reqName}
                      </div>
                    ) : (
                      <Button size="sm"
                        onClick={() => buy('hen', def.key)}
                        disabled={loading || !affordable || full}
                        aria-label={`Buy ${def.name} for ${def.price} coins`}
                        className="mt-1 min-h-9 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
                      >
                        {full ? 'Coop full' : !affordable ? 'Need coins' : 'Buy'}
                      </Button>
                    )}
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── eggs ── */}
      {tab === 'eggs' && (
        <div className="space-y-2">
          <p className="rounded-xl bg-lime-50 px-3 py-2 text-[11px] font-bold text-lime-800">
            💡 Hen-laid eggs are free from collecting! These premium eggs have faster hatch times &amp; better rewards.
          </p>
          {Object.values(EGG_TYPES).filter(e => e.purchasable).map(def => {
            const affordable = user.coins >= (def.buyPrice ?? 0)
            return (
              <GameCard key={def.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-3xl">
                    <span aria-hidden="true">{def.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-stone-800">{def.name}</p>
                    <p className="text-[11px] leading-tight text-stone-600">{def.desc}</p>
                    <p className="mt-1 text-[10px] font-bold text-stone-600">⏱ Hatches in {def.hatchHours}h</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-amber-700">🪙 {def.buyPrice?.toLocaleString()}</p>
                    <Button size="sm"
                      onClick={() => buy('egg', def.key)}
                      disabled={loading || !affordable}
                      aria-label={`Buy ${def.name} for ${def.buyPrice} coins`}
                      className="mt-1 min-h-9 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
                    >
                      {!affordable ? 'Need coins' : 'Buy'}
                    </Button>
                  </div>
                </div>
                <div className="mt-2 rounded-xl bg-stone-50 p-2">
                  <p className="text-[10px] font-black uppercase text-stone-600">Possible rewards</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {def.hatchTable.map(r => (
                      <span key={r.reward} className="rounded-full border border-stone-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-stone-600">
                        {rewardLabel(r.reward)} · {r.chance}%
                      </span>
                    ))}
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── animals ── */}
      {tab === 'animals' && (
        <div className="space-y-2">
          {Object.values(ANIMAL_TYPES).map(def => {
            const affordable = user.coins >= def.price
            const full = animals.length >= Math.max(farm.landCap, farm.shelterCap)
            return (
              <GameCard key={def.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-3xl">
                    <span aria-hidden="true">{def.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-stone-800">{def.name}</p>
                    <p className="text-[11px] leading-tight text-stone-600">{def.desc}</p>
                    {def.coinsPerHour > 0 && (
                      <p className="mt-1 text-[10px] font-bold text-green-700">🪙 +{Math.round(def.coinsPerHour * 24)}/day passive</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-amber-700">🪙 {def.price.toLocaleString()}</p>
                    <Button size="sm"
                      onClick={() => buy('animal', def.key)}
                      disabled={loading || !affordable || full}
                      aria-label={`Buy ${def.name} for ${def.price} coins`}
                      className="mt-1 min-h-9 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
                    >
                      {full ? 'Pens full' : !affordable ? 'Need coins' : 'Buy'}
                    </Button>
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── items ── */}
      {tab === 'items' && (
        <div className="space-y-2">
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-800">
            🎒 Items are stored in your Barn (Farm tab). Use them anytime for boosts, healing &amp; instant growth.
          </p>
          {Object.values(ITEM_TYPES).map(def => {
            const gem = !!def.gemPrice
            const affordable = gem ? user.gems >= def.gemPrice! : user.coins >= def.price
            return (
              <GameCard key={def.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-2xl">
                    <span aria-hidden="true">{def.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-stone-800">{def.name}</p>
                    <p className="text-[11px] leading-tight text-stone-600">{def.desc}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('text-sm font-black', gem ? 'text-pink-700' : 'text-amber-700')}>
                      {gem ? `💎 ${def.gemPrice}` : `🪙 ${def.price.toLocaleString()}`}
                    </p>
                    <Button size="sm"
                      onClick={() => buy('item', def.key)}
                      disabled={loading || !affordable}
                      aria-label={`Buy ${def.name}`}
                      className="mt-1 min-h-9 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
                    >
                      {!affordable ? 'Need funds' : 'Buy'}
                    </Button>
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── buildings & upgrades ── */}
      {tab === 'upgrades' && (
        <div className="space-y-2">
          {Object.values(UPGRADES).map(def => {
            const curLevel = def.key === 'coop' ? farm.coopLevel : def.key === 'land' ? farm.landLevel : farm.storageLevel
            const maxed = curLevel >= def.levels.length
            const next = def.levels[curLevel]
            const affordable = user.coins >= (next?.price ?? 0)
            return (
              <GameCard key={def.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-3xl">
                    <span aria-hidden="true">{def.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-black text-stone-800">{def.name}</p>
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-black text-green-800">Lv{curLevel}</span>
                    </div>
                    <p className="text-[11px] leading-tight text-stone-600">{def.desc}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-bold text-stone-600">
                      <span>Now: {def.levels[curLevel - 1]?.cap}{def.key === 'storage' ? 'h' : ''}</span>
                      {!maxed && <span>Next: {next.cap}{def.key === 'storage' ? 'h' : ''}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {maxed ? (
                      <span className="mt-1 inline-block rounded-full bg-stone-200 px-3 py-1.5 text-[10px] font-black text-stone-700">MAX</span>
                    ) : (
                      <>
                        <p className="text-sm font-black text-amber-700">🪙 {next.price.toLocaleString()}</p>
                        <Button size="sm"
                          onClick={() => buy('upgrade', def.key)}
                          disabled={loading || !affordable}
                          aria-label={`Upgrade ${def.name} for ${next.price} coins`}
                          className="mt-1 min-h-9 rounded-full bg-amber-800 px-3 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
                        >
                          {!affordable ? 'Need coins' : 'Upgrade'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </GameCard>
            )
          })}

          <p className="pt-2 text-center text-[10px] font-black uppercase tracking-wide text-stone-600">🏗️ Farm Buildings</p>
          {BUILDINGS.map(b => {
            const curLevel = farm[b.levelField]
            const maxed = curLevel >= b.maxLevel
            const price = b.prices[Math.min(curLevel + 1, b.prices.length - 1)]
            const affordable = user.coins >= price
            return (
              <GameCard key={b.key}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-3xl">
                    <span aria-hidden="true">{b.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-black text-stone-800">{b.name}</p>
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                        curLevel > 0 ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700',
                      )}>
                        {curLevel === 0 ? 'Not built' : `Lv${curLevel}`}
                      </span>
                    </div>
                    <p className="text-[11px] leading-tight text-stone-600">Now: {b.effectFor(curLevel)}</p>
                    {!maxed && <p className="text-[10px] font-bold text-stone-600">Next: {b.effectFor(curLevel + 1)}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    {maxed ? (
                      <span className="mt-1 inline-block rounded-full bg-stone-200 px-3 py-1.5 text-[10px] font-black text-stone-700">MAX</span>
                    ) : (
                      <>
                        <p className="text-sm font-black text-amber-700">🪙 {price.toLocaleString()}</p>
                        <Button size="sm"
                          onClick={() => buy('building', b.key)}
                          disabled={loading || !affordable}
                          aria-label={`${curLevel === 0 ? 'Build' : 'Upgrade'} ${b.name} for ${price} coins`}
                          className="mt-1 min-h-9 rounded-full bg-amber-800 px-3 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
                        >
                          {!affordable ? 'Need coins' : curLevel === 0 ? 'Build' : 'Upgrade'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </GameCard>
            )
          })}

          <GameCard className="bg-gradient-to-r from-purple-50 to-white">
            <p className="text-xs font-black text-stone-800">⭐ Level Roadmap</p>
            <div className="mt-2 space-y-1.5">
              {FARMER_LEVELS.map((l, i) => {
                const unlocked = levelIdx >= i
                return (
                  <div key={l.name} className="flex items-center gap-2">
                    <span className={cn('text-sm', !unlocked && 'grayscale opacity-50')}>{unlocked ? '✅' : '🔒'}</span>
                    <span className={cn('flex-1 text-[11px] font-bold', unlocked ? 'text-stone-700' : 'text-stone-600')}>
                      {l.name} <span className="font-normal">· {l.xp.toLocaleString()} XP · {l.unlock}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </GameCard>
        </div>
      )}

      {/* ── premium ── */}
      {tab === 'premium' && (
        <div className="space-y-3">
          <p className="rounded-xl bg-pink-50 px-3 py-2 text-[11px] font-bold text-pink-800">
            👑 Real-money purchases are processed by a mock payment gateway for this demo — no card is charged.
          </p>

          {/* payment method */}
          <GameCard>
            <p className="text-xs font-black text-stone-800">💳 Payment method</p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {PAY_METHODS.map(m => (
                <button key={m.key}
                  onClick={() => setPayMethod(m.key)}
                  aria-pressed={payMethod === m.key}
                  className={cn(
                    'min-h-9 rounded-xl border py-2 text-[11px] font-black',
                    payMethod === m.key ? 'border-pink-500 bg-pink-50 text-pink-800' : 'border-stone-200 text-stone-600',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </GameCard>

          {/* gem packs */}
          <p className="text-center text-[10px] font-black uppercase tracking-wide text-stone-600">💎 Gem Packs</p>
          <div className="grid grid-cols-2 gap-2">
            {GEM_PACKS.map(p => (
              <GameCard key={p.key} className={cn('relative text-center', p.tag === 'BEST VALUE' && 'border-pink-400 bg-pink-50/50')}>
                {p.tag && (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-pink-600 px-2 py-0.5 text-[8px] font-black text-white">
                    {p.tag}
                  </span>
                )}
                <p className="mt-1 text-2xl" aria-hidden="true">💎</p>
                <p className="text-lg font-black tabular-nums text-pink-700">{p.gems}</p>
                <p className="text-[10px] font-bold text-stone-600">{p.name}</p>
                {p.bonusPct > 0 && <p className="text-[9px] font-black text-green-700">+{p.bonusPct}% bonus</p>}
                <Button size="sm"
                  onClick={async () => { await act('purchase_gems', { sku: p.key, method: payMethod }) }}
                  disabled={loading}
                  aria-label={`Buy ${p.name} — ${p.gems} gems for $${(p.priceCents / 100).toFixed(2)}`}
                  className="mt-2 min-h-9 w-full rounded-full bg-pink-600 text-xs font-extrabold text-white active:scale-95"
                >
                  ${(p.priceCents / 100).toFixed(2)}
                </Button>
              </GameCard>
            ))}
          </div>

          {/* VIP plans */}
          <p className="pt-2 text-center text-[10px] font-black uppercase tracking-wide text-stone-600">👑 VIP Subscriptions</p>
          {Object.values(VIP_PLANS).map(v => {
            const isCurrent = state.user.vip?.plan === v.key
            return (
              <GameCard key={v.key} className="bg-gradient-to-r from-amber-50 via-yellow-50 to-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-stone-800">{v.name} <span className="text-[10px] font-bold text-amber-700">· {v.days} days</span></p>
                    <ul className="mt-1 space-y-0.5">
                      {v.perks.map(p => (
                        <li key={p} className="text-[11px] font-bold text-stone-600">✓ {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-black text-amber-700">${(v.priceCents / 100).toFixed(2)}</p>
                    {isCurrent ? (
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-3 py-1.5 text-[10px] font-black text-green-800">
                        ✓ Active
                      </span>
                    ) : (
                      <Button size="sm"
                        onClick={async () => { await act('purchase_vip', { planKey: v.key, method: payMethod }) }}
                        disabled={loading}
                        aria-label={`Subscribe to ${v.name} for $${(v.priceCents / 100).toFixed(2)}`}
                        className="mt-1 min-h-9 rounded-full bg-gradient-to-r from-amber-600 to-yellow-500 px-4 text-xs font-extrabold text-white shadow active:scale-95"
                      >
                        Subscribe
                      </Button>
                    )}
                  </div>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

function rewardLabel(reward: string): string {
  const [kind, arg] = reward.split(':')
  if (kind === 'chick' || kind === 'mutation') return `${HEN_TYPES[arg]?.emoji ?? '🐣'} ${HEN_TYPES[arg]?.name ?? 'Chick'}`
  if (kind === 'coins') return `🪙 ${arg}`
  if (kind === 'gems') return `💎 ${arg}`
  if (kind === 'animal') return `${ANIMAL_TYPES[arg]?.emoji ?? '🐾'} ${ANIMAL_TYPES[arg]?.name ?? 'Pet'}`
  return reward
}
