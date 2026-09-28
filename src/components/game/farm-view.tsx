'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '@/lib/store'
import { EGG_TYPES, HEN_TYPES, FEED_TYPES, ANIMAL_TYPES, TRAITS, FEED_FACTORY_DISCOUNT } from '@/lib/game'
import { Button } from '@/components/ui/button'
import { GameCard, ProgressBar, RarityBadge, SectionTitle, EmptyState } from './shared'
import { cn } from '@/lib/utils'

function useTick(intervalMs = 1000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
}

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Ready!'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function FarmView() {
  const { state, act, loading, setHatchResult } = useGame()
  const [sellType, setSellType] = useState<string | null>(null)
  const [breedPick, setBreedPick] = useState<string[]>([])
  useTick(1000)

  if (!state) return null

  const { user, farm, hens, animals, eggInventory, incubators, items } = state
  const activeHens = hens.filter(h => h.status === 'active')
  const totalPendingEggs = hens.reduce((s, h) => s + h.pendingEggs, 0)
  const totalPendingCoins = animals.reduce((s, a) => s + a.pendingCoins, 0)
  const totalInvEggs = Object.values(eggInventory).reduce((s, n) => s + n, 0)
  const eggCoins = activeHens.reduce((s, h) => s + h.ratePerHour * 24 * (EGG_TYPES[h.type]?.sellValue ?? 0), 0)
  const animalCoins = animals.reduce((s, a) => {
    const perHour = (ANIMAL_TYPES[a.type]?.coinsPerHour ?? 0) * farm.productionMult
    return s + perHour * 24
  }, 0)
  const dailyIncomeEstimate = Math.round(eggCoins + animalCoins)

  // breeding candidates: prime/mature adults off cooldown
  const breedable = hens.filter(h => h.status === 'active' && (h.stage === 'prime' || h.stage === 'mature') && !h.breedCooldownUntil)

  function toggleBreedPick(id: string) {
    setBreedPick(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= 2 ? [prev[1], id] : [...prev, id])
  }

  async function handleBreed() {
    if (breedPick.length !== 2) return
    const res = await act('breed', { henAId: breedPick[0], henBId: breedPick[1] })
    if (res?.hatch) setHatchResult(res.hatch as never)
    setBreedPick([])
  }

  async function handleUseItem(key: string, henId?: string) {
    await act('use_item', { itemKey: key, henId })
  }

  async function handleCollectHens() {
    await act('collect_hens')
  }
  async function handleCollectAnimals() {
    await act('collect_animals')
  }
  async function handleOpen(eggId: string) {
    // the store already raises the hatch celebration from res.hatch
    await act('open_egg', { eggId })
  }
  async function handleSpeedUp(eggId: string) {
    await act('speedup', { eggId })
  }
  async function handleIncubate(type: string) {
    await act('incubate', { eggType: type })
  }
  async function handleSell(type: string, count: number) {
    await act('sell_eggs', { eggType: type, count })
    setSellType(null)
  }
  async function handleFeed(feedType: string) {
    await act('feed', { feedType })
  }

  return (
    <div className="space-y-3 px-3 pb-4">
      {/* ── farm scene banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-green-200 bg-gradient-to-b from-sky-50 via-lime-50 to-green-100 p-4 shadow-sm">
        <div className="pointer-events-none absolute right-30 top-2 flex flex-col items-end">
          <motion.div animate={{ rotate: [0, 8, -1, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-4xl"
          >
            <span aria-hidden="true">{farm.weather.emoji}</span>
          </motion.div>
          <span className={cn(
            'mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black',
            farm.weather.pct > 0 ? 'bg-green-200 text-green-800' : farm.weather.pct < 0 ? 'bg-red-200 text-red-700' : 'bg-stone-200 text-stone-600',
          )}>
            {farm.weather.name} {farm.weather.pct > 0 ? `+${farm.weather.pct}%` : farm.weather.pct !== 0 ? `${farm.weather.pct}%` : ''}
          </span>
        </div>
        <div className="pointer-events-none absolute bottom-1 right-10 text-3xl" aria-hidden="true">🌳</div>
        <div className="pointer-events-none absolute bottom-0 left-2 text-3xl" aria-hidden="true">🏠</div>
        <div className="pointer-events-none absolute bottom-0 left-12 text-2xl" aria-hidden="true">🐔</div>
        <div className="pointer-events-none absolute bottom-1 right-20 text-2xl" aria-hidden="true">🐮</div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-amber-300 bg-white text-2xl shadow">
              <span aria-hidden="true">{user.avatar}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-stone-800">{user.farmName}</p>
              <p className="text-xs font-bold text-green-700">⭐ {user.levelName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-stone-600">Farm value</p>
              <p className="text-lg font-black tabular-nums text-amber-700">🪙 {state.farmValue.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] font-bold text-stone-600">
              <span>XP {user.xp.toLocaleString()}{user.nextXp ? ` / ${user.nextXp.toLocaleString()}` : ' · MAX'}</span>
              <span>{user.levelProgress}%</span>
            </div>
            <ProgressBar pct={user.levelProgress} label="Farmer level progress" />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <MiniStat icon="🐔" label="Hens" value={`${activeHens.length}/${farm.coopCap}`} />
            <MiniStat icon="🥚" label="Hatched" value={farm.totalEggsHatch.toLocaleString()} />
            <MiniStat icon="🧺" label="In store" value={totalInvEggs.toLocaleString()} />
            <MiniStat icon="⚡" label="Boost" value={`×${farm.productionMult}`} />
          </div>
          <p className="mt-1.5 text-center text-[10px] font-bold text-stone-600">{farm.weather.desc}</p>
          <p className="mt-2 text-center text-[11px] font-bold text-amber-700">
            ≈ 🪙 {dailyIncomeEstimate.toLocaleString()} estimated daily income
          </p>
        </div>
      </div>

      {/* ── event banner ── */}
      {state.event && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-100 to-yellow-50 px-3 py-2">
          <span className="text-xl" aria-hidden="true">🎉</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-amber-800">
              {state.event.name} — ×{(state.event.multiplier / 100).toFixed(1)} PRODUCTION!
            </p>
            <p className="truncate text-[10px] text-amber-700">Ends {new Date(state.event.endsAt).toLocaleDateString()}</p>
          </div>
        </div>
      )}

      {/* ── buff / health bar ── */}
      <GameCard className="flex items-center gap-2">
        <div className="text-2xl" aria-hidden="true">{farm.health >= 90 ? '💚' : farm.health >= 60 ? '💛' : '🧡'}</div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-stone-600">Farm health</span>
            <span className="font-black tabular-nums text-stone-700">{farm.health}%</span>
          </div>
          <ProgressBar pct={farm.health} label="Farm health" className="mt-1 h-1.5" />
          <p className="mt-1 text-[10px] text-stone-600">Feed daily to keep 100% production · lower health cuts output</p>
        </div>
        {farm.buffType && (
          <div className="rounded-xl bg-green-100 px-2 py-1 text-center">
            {farm.buffType === 'champion' ? (
              <>
                <p className="text-[10px] font-black text-green-700">🏅 +10%</p>
                <p className="text-[9px] text-green-600">{countdown(farm.buffExpiresAt!)}</p>
              </>
            ) : FEED_TYPES[farm.buffType] ? (
              <>
                <p className="text-[10px] font-black text-green-700">
                  {FEED_TYPES[farm.buffType].emoji} +{FEED_TYPES[farm.buffType].boostPct}%
                </p>
                <p className="text-[9px] text-green-600">{countdown(farm.buffExpiresAt!)}</p>
              </>
            ) : null}
          </div>
        )}
      </GameCard>

      {/* ── coop ── */}
      <SectionTitle right={
        <Button size="sm"
          onClick={handleCollectHens}
          disabled={loading || totalPendingEggs === 0}
          className="min-h-9 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white shadow active:scale-95 disabled:opacity-40"
        >
          🧺 Collect All ({totalPendingEggs})
        </Button>
      }>
        🏠 Chicken House · Lv{farm.coopLevel} ({activeHens.length}/{farm.coopCap})
      </SectionTitle>

      {hens.length === 0 ? (
        <GameCard>
          <EmptyState emoji="🐔" title="Your coop is empty!" sub="Visit the Shop and buy your first hen" />
        </GameCard>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {hens.map(hen => (
            <GameCard key={hen.id} className={cn('relative overflow-hidden', hen.status === 'retired' && 'opacity-60')}>
              <div className="flex items-start justify-between">
                <span className="text-3xl" aria-hidden="true">{hen.emoji}</span>
                <div className="flex items-center gap-1">
                  {hen.generation > 1 && (
                    <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-black text-purple-700">G{hen.generation}</span>
                  )}
                  <RarityBadge rarity={hen.rarity} />
                </div>
              </div>
              <p className="mt-1 truncate text-sm font-black text-stone-700">{hen.name}</p>
              <p className="text-[10px] text-stone-600">
                {hen.stageEmoji} {hen.stageName} · Lv{hen.level} · {hen.ageDays}d/{hen.lifespan}d
              </p>
              {hen.traits.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {hen.traits.map(t => (
                    <span key={t} title={TRAITS[t]?.desc ?? t} className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                      {TRAITS[t]?.emoji ?? '✨'} {TRAITS[t]?.name ?? t}
                    </span>
                  ))}
                </div>
              )}
              {hen.status === 'active' && hen.pendingEggs > 0 && (
                <div className="absolute right-2 top-9 animate-bounce rounded-full bg-amber-900 px-1.5 py-0.5 text-[10px] font-black text-white shadow motion-reduce:animate-none">
                  🥚 {hen.pendingEggs}
                  <span className="sr-only"> eggs ready to collect</span>
                </div>
              )}
              {hen.status === 'retired' && (
                <p className="mt-1 text-[10px] font-bold text-stone-600">Sell at Marketplace</p>
              )}
            </GameCard>
          ))}
        </div>
      )}

      {/* ── 🧬 breeding nest ── */}
      <SectionTitle right={<span className="text-[10px] font-bold text-stone-600">🪙 500 · 6h cooldown</span>}>
        🧬 Breeding Nest
      </SectionTitle>
      <GameCard className="bg-gradient-to-r from-pink-50 via-purple-50 to-white">
        <p className="text-[11px] text-stone-600">
          Pick <b>two grown hens</b> to breed. Chicks inherit traits and can jump a breed tier — with a 10% chance of a 🌟 <b>legendary mutation</b>!
        </p>
        {breedable.length < 2 ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
            🐣 You need at least 2 grown hens (Prime/Mature, not on cooldown) to breed.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {breedable.map(h => (
                <button key={h.id}
                  onClick={() => toggleBreedPick(h.id)}
                  aria-pressed={breedPick.includes(h.id)}
                  className={cn(
                    'min-h-9 rounded-xl border px-2 py-1 text-[11px] font-bold transition-all',
                    breedPick.includes(h.id) ? 'border-pink-600 bg-pink-100 text-pink-800' : 'border-stone-200 bg-white text-stone-600',
                  )}
                >
                  {h.emoji} {h.name} {h.traits.length > 0 && h.traits.map(t => TRAITS[t]?.emoji).join('')}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] font-bold text-stone-600">
                {breedPick.length === 2
                  ? `${hens.find(h => h.id === breedPick[0])?.emoji} ${hens.find(h => h.id === breedPick[0])?.name} × ${hens.find(h => h.id === breedPick[1])?.emoji} ${hens.find(h => h.id === breedPick[1])?.name}`
                  : 'Select 2 parents'}
              </p>
              <Button size="sm"
                onClick={handleBreed}
                disabled={loading || breedPick.length !== 2 || user.coins < 500}
                className="min-h-9 rounded-full bg-pink-600 px-4 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
              >
                🧬 Breed (🪙 500)
              </Button>
            </div>
          </>
        )}
      </GameCard>

      {/* ── incubator ── */}
      <SectionTitle right={<span className="text-[10px] font-bold text-stone-600">🏹 Room Lv{farm.incubatorLevel}</span>}>
        🍼 Incubator ({incubators.length}/{farm.incubatorCap})
      </SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: farm.incubatorCap }).map((_, i) => {
          const slot = incubators[i]
          if (!slot) {
            return (
              <div key={i} className="flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-white/50 p-1 text-center">
                <span className="text-2xl opacity-30" aria-hidden="true">🥚</span>
                <span className="mt-1 px-1 text-[9px] text-stone-600">Empty slot</span>
              </div>
            )
          }
          const def = EGG_TYPES[slot.type]
          return (
            <div key={slot.id} className={cn(
              'flex min-h-28 flex-col items-center justify-center rounded-2xl border p-1 text-center shadow-sm',
              slot.ready ? 'animate-pulse border-green-400 bg-green-50 motion-reduce:animate-none' : 'border-stone-200 bg-white',
            )}>
              <motion.span animate={slot.ready ? { scale: [1, 1.15, 1] } : { rotate: [0, -5, 5, 0] }}
                transition={{ repeat: Infinity, duration: slot.ready ? 1 : 2.5 }}
                className="text-3xl"
              >
                <span aria-hidden="true">{def.emoji}</span>
              </motion.span>
              {slot.ready ? (
                <Button size="sm"
                  onClick={() => handleOpen(slot.id)}
                  disabled={loading}
                  aria-label={`Open ${def.name} — ready to hatch`}
                  className="mt-1 min-h-9 rounded-full bg-green-700 px-2 text-[10px] font-black text-white active:scale-95"
                >
                  🐣 OPEN!
                </Button>
              ) : (
                <>
                  <p className="mt-1 text-[10px] font-black tabular-nums text-stone-600">{countdown(slot.hatchAt)}</p>
                  <button onClick={() => handleSpeedUp(slot.id)}
                    disabled={loading}
                    aria-label={`Speed up ${def.name} with gems`}
                    className="mt-0.5 min-h-9 rounded-full bg-pink-100 px-1.5 py-0.5 text-[9px] font-bold text-pink-800 disabled:opacity-50"
                  >
                    ⚡ Speed up 💎
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ── egg inventory ── */}
      <SectionTitle>🧺 Egg Storage</SectionTitle>
      {totalInvEggs === 0 ? (
        <GameCard><EmptyState emoji="🥚" title="No eggs yet" sub="Collect from your hens first" /></GameCard>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(eggInventory).filter(([, n]) => n > 0).map(([type, n]) => {
            const def = EGG_TYPES[type]
            return (
              <GameCard key={type} className="flex items-center gap-2">
                <span className="text-3xl" aria-hidden="true">{def.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-stone-700">{def.name} ×{n}</p>
                  <p className="text-[10px] text-stone-600">🪙 {def.sellValue}/ea · {def.hatchHours}h hatch</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => handleIncubate(type)}
                    disabled={loading}
                    aria-label={`Put ${def.name} in the incubator`}
                    className="min-h-9 rounded-full bg-green-700 px-2 py-1 text-[10px] font-black text-white disabled:opacity-50"
                  >
                    Hatch
                  </button>
                  <button onClick={() => setSellType(type)}
                    disabled={loading}
                    aria-label={`Sell ${def.name}`}
                    className="min-h-9 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900 disabled:opacity-50"
                  >
                    Sell
                  </button>
                </div>
              </GameCard>
            )
          })}
        </div>
      )}

      {/* ── animal pens ── */}
      <SectionTitle right={
        animals.some(a => a.pendingCoins > 0) ? (
          <Button size="sm"
            onClick={handleCollectAnimals}
            disabled={loading}
            aria-label="Harvest coins from all animals"
            className="min-h-9 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white shadow active:scale-95"
          >
            🧺 Harvest ({totalPendingCoins})
          </Button>
        ) : undefined
      }>
        🌾 Animal Pens · Lv{farm.landLevel} ({animals.length}/{Math.max(farm.landCap, farm.shelterCap)})
      </SectionTitle>
      {farm.shelterLevel > 0 && (
        <p className="rounded-xl bg-orange-50 px-3 py-1.5 text-[10px] font-bold text-orange-700">
          🏚️ Animal Shelter Lv{farm.shelterLevel}: cap {farm.shelterCap} · +{farm.shelterBonus}% animal production
        </p>
      )}

      {animals.length === 0 ? (
        <GameCard><EmptyState emoji="🐄" title="No animals yet" sub="Dogs boost production, cows make milk" /></GameCard>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {animals.map(a => (
            <GameCard key={a.id} className="flex items-center gap-2">
              <span className="text-3xl" aria-hidden="true">{a.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-stone-700">{a.name}</p>
                <p className="truncate text-[10px] text-stone-600">
                  {a.passive
                    ? (a.pendingCoins > 0 ? `🪙 ${a.pendingCoins} ready` : 'producing…')
                    : `✨ ${a.effect} +${a.effectValue}%`}
                </p>
              </div>
            </GameCard>
          ))}
        </div>
      )}

      {/* ── 🎒 barn inventory ── */}
      <SectionTitle right={<span className="text-[10px] font-bold text-stone-600">buy more in Shop → Items</span>}>
        🎒 Barn Inventory
      </SectionTitle>
      {items.length === 0 ? (
        <GameCard><EmptyState emoji="🎒" title="Your barn is empty" sub="Buy medicine, boosters &amp; tools from the Shop" /></GameCard>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map(it => (
            <GameCard key={it.key} className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">{it.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-stone-700">{it.name} ×{it.qty}</p>
                  <p className="text-[9px] font-bold uppercase text-stone-600">{it.kind}</p>
                </div>
              </div>
              <p className="mt-1 flex-1 text-[10px] leading-tight text-stone-600">{it.desc}</p>
              {it.usable ? (
                <button onClick={() => handleUseItem(it.key)}
                  disabled={loading}
                  aria-label={`Use one ${it.name}`}
                  className="mt-1.5 min-h-9 rounded-full bg-green-700 py-1.5 text-[10px] font-black text-white disabled:opacity-50"
                >
                  ✨ Use one
                </button>
              ) : (
                <p className="mt-1.5 rounded-full bg-stone-100 py-1.5 text-center text-[10px] font-bold text-stone-600">🛡️ Passive effect</p>
              )}
            </GameCard>
          ))}
        </div>
      )}

      {/* ── feed station ── */}
      <SectionTitle right={farm.feedFactoryLevel > 0
        ? <span className="text-[10px] font-bold text-orange-700">🏭 Factory −{FEED_FACTORY_DISCOUNT[Math.min(farm.feedFactoryLevel, FEED_FACTORY_DISCOUNT.length - 1)]}%</span>
        : undefined}>
        🌽 Feed Station
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(FEED_TYPES).map(f => {
          const discountPct = FEED_FACTORY_DISCOUNT[Math.min(farm.feedFactoryLevel, FEED_FACTORY_DISCOUNT.length - 1)] ?? 0
          const effPrice = Math.max(1, Math.round(f.price * (1 - discountPct / 100)))
          return (
            <GameCard key={f.key} className="flex flex-col items-center p-3 text-center">
              <span className="text-3xl" aria-hidden="true">{f.emoji}</span>
              <p className="mt-1 text-xs font-black text-stone-700">{f.name}</p>
              <p className="text-[10px] text-stone-600">{f.desc}</p>
              <Button size="sm"
                onClick={() => handleFeed(f.key)}
                disabled={loading || user.coins < effPrice}
                aria-label={`Feed with ${f.name} for ${effPrice} coins`}
                className="mt-2 min-h-9 w-full rounded-full bg-amber-800 text-xs font-extrabold text-white active:scale-95 disabled:opacity-40"
              >
                🪙 {effPrice}{discountPct > 0 && <span className="line-through opacity-60"> {f.price}</span>} · Feed
              </Button>
            </GameCard>
          )
        })}
      </div>

      {/* ── sell dialog ── */}
      <AnimatePresence>
        {sellType && (
          <SellSheet
            type={sellType}
            count={eggInventory[sellType] ?? 0}
            onClose={() => setSellType(null)}
            onSell={handleSell}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white bg-white/70 py-1.5">
      <p className="text-sm" aria-hidden="true">{icon}</p>
      <p className="text-xs font-black tabular-nums text-stone-700">{value}</p>
      <p className="text-[9px] font-bold uppercase text-stone-600">{label}</p>
    </div>
  )
}

function SellSheet({
  type, count, onClose, onSell,
}: { type: string; count: number; onClose: () => void; onSell: (t: string, n: number) => void }) {
  const def = EGG_TYPES[type]
  const [qty, setQty] = useState(count)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <motion.div initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Sell ${def.name}`}
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden="true">{def.emoji}</span>
          <div>
            <p className="font-black text-stone-800">Sell {def.name}</p>
            <p className="text-xs text-stone-600">You own {count} · 🪙 {def.sellValue} each</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={count}
            value={qty}
            onChange={e => setQty(Number(e.target.value))}
            aria-label={`How many ${def.name} to sell`}
            aria-valuetext={`${qty} of ${count}`}
            className="h-2 min-h-9 flex-1 accent-green-600"
          />
          <span className="w-10 text-center text-lg font-black tabular-nums text-stone-800">{qty}</span>
        </div>
        <p className="mt-2 text-center text-sm font-bold text-amber-700">Total: 🪙 {(def.sellValue * qty).toLocaleString()}</p>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 flex-1 rounded-xl">Cancel</Button>
          <Button onClick={() => onSell(type, qty)}
            className="h-11 flex-1 rounded-xl bg-green-700 font-extrabold text-white"
          >
            💰 Sell {qty}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
