'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

//══════════ MiniGame 2: Chicken Road Crossing (frogger) ══════════
// Hop cell-by-cell across endless roads · dodge cars, trucks, motorcycles & tractors
// Power-ups: 🛡️ shield (10s) · 🧲 magnet · ⚡ speed · ❄️ freeze traffic (5s)
// 3 lives · score = farthest road reached · reach the farm side to win.
// The client reports raw telemetry; ALL rewards are computed server-side.

interface Props {
  sessionId: string
  tier: number
  tierName: string
  speedMult: number
  winTarget: number
  onEnd: (telemetry: { score: number; coins: number; powerUps: number }) => void
  onQuit: () => void
}

interface Vehicle { x: number; speed: number; emoji: string; w: number }
interface Row {
  type: 'grass' | 'road' | 'goal'
  dir: 1 | -1
  speed: number
  vehicles: Vehicle[]
  coin: boolean
  // coin on this row (col stored in coinCol)
  coinCol: number
  powerUp: string | null // shield | magnet | speed | freeze
  powerCol: number
  taken: boolean // reward on row consumed
}

const COLS = 5
const VEHICLES = ['🚗', '🚚', '🏍️', '🚜']
const POWERS: { key: string; emoji: string }[] = [
  { key: 'shield', emoji: '🛡️' },
  { key: 'magnet', emoji: '🧲' },
  { key: 'speed', emoji: '⚡' },
  { key: 'freeze', emoji: '❄️' },
]
const MAX_LIVES = 3
const POWER_KEYS = ['shield', 'magnet', 'speed', 'freeze'] as const

export function RoadCrossing({ tier, tierName, speedMult, winTarget, onEnd, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hud, setHud] = useState({
    row: 0, target: winTarget + tier * 4, lives: MAX_LIVES, coins: 0,
    powers: [] as { key: string; left: number }[], night: tier >= 2, frozen: 0,
  })
  const [ended, setEnded] = useState<null | 'win' | 'loss'>(null)
  const endedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  useEffect(() => { onEndRef.current = onEnd })

  const target = winTarget + tier * 4
  const stateRef = useRef({
    col: 2, row: 0, renderRow: 0,
    hopT: -1, hopFromRow: 0, hopFromCol: 2,
    lives: MAX_LIVES, invuln: 0,
    coins: 0, powerUpsCollected: 0,
    shield: 0, magnet: 0, speed: 0, freeze: 0,
    rows: [] as Row[],
    hopCooldown: 0,
    trimmedTo: 0,
    time: 0, running: true,
  })

  const finish = useCallback((result: 'win' | 'loss') => {
    if (endedRef.current) return
    endedRef.current = true
    stateRef.current.running = false
    setEnded(result)
    const s = stateRef.current
    setTimeout(() => {
      onEndRef.current({ score: s.row, coins: s.coins, powerUps: s.powerUpsCollected })
    }, 900)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

    // Re-measured on resize. CELL drives every collision test, so a stale
    // value after rotation made the player collide in the wrong places.
    let W = canvas.clientWidth
    let H = canvas.clientHeight
    let CELL = W / COLS

    const resize = () => {
      W = canvas.clientWidth
      H = canvas.clientHeight
      if (W === 0 || H === 0) return
      CELL = W / COLS
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      // setTransform, not scale: scale() accumulates across calls.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)

    const s = stateRef.current
    let raf = 0
    let last = performance.now()

    // ── procedural rows ──
    function ensureRows(upto: number) {
      while (s.rows.length <= upto) {
        const i = s.rows.length
        if (i <= 1) {
          s.rows.push({ type: 'grass', dir: 1, speed: 0, vehicles: [], coin: false, coinCol: 0, powerUp: null, powerCol: 0, taken: false })
          continue
        }
        if (i === target + 2) {
          // farm side (goal row)
          s.rows.push({ type: 'goal', dir: 1, speed: 0, vehicles: [], coin: false, coinCol: 0, powerUp: null, powerCol: 0, taken: false })
          continue
        }
        // difficulty: road probability rises with row index & tier
        const roadProb = Math.min(0.8, 0.45 + i * 0.008 + tier * 0.05)
        const isRoad = Math.random() < roadProb
        if (isRoad) {
          const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
          const baseSpeed = (60 + Math.random() * 70 + i * 1.2) * speedMult
          const nVeh = Math.random() < Math.min(0.55, 0.18 + i * 0.01 + tier * 0.04) ? 2 : 1
          const vehicles: Vehicle[] = []
          for (let v = 0; v < nVeh; v++) {
            const vi = Math.floor(Math.random() * VEHICLES.length)
            vehicles.push({
              x: (W / (nVeh + 1)) * (v + 1) + Math.random() * 60,
              speed: baseSpeed * (0.85 + Math.random() * 0.3),
              emoji: VEHICLES[vi],
              w: VEHICLES[vi] === '🚚' ? CELL * 1.1 : CELL * 0.85,
            })
          }
          s.rows.push({
            type: 'road', dir, speed: baseSpeed, vehicles,
            coin: Math.random() < 0.22, coinCol: Math.floor(Math.random() * COLS),
            powerUp: null, powerCol: 0, taken: false,
          })
        } else {
          const powerRoll = Math.random() < 0.14
          s.rows.push({
            type: 'grass', dir: 1, speed: 0, vehicles: [],
            coin: !powerRoll && Math.random() < 0.4, coinCol: Math.floor(Math.random() * COLS),
            powerUp: powerRoll ? POWERS[Math.floor(Math.random() * POWERS.length)].key : null,
            powerCol: Math.floor(Math.random() * COLS),
            taken: false,
          })
        }
      }
    }
    ensureRows(30)

    // ── input ──
    function hop(dc: number, dr: number) {
      if (!s.running || endedRef.current) return
      if (s.hopCooldown > 0) return
      const nc = Math.max(0, Math.min(COLS - 1, s.col + dc))
      const nr = Math.max(0, s.row + dr)
      if (nc === s.col && nr === s.row) return
      s.hopFromCol = s.col
      s.hopFromRow = s.row
      s.col = nc
      s.row = nr
      s.hopT = 0
      s.hopCooldown = s.speed > 0 ? 0.1 : 0.17
    }

    let touchStart: { x: number; y: number } | null = null
    const onTouchStart = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      touchStart = { x: t.clientX, y: t.clientY }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart) return
      const t = e.changedTouches[0]
      const dx = t.clientX - touchStart.x
      const dy = t.clientY - touchStart.y
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) hop(0, 1)
      else if (Math.abs(dx) > Math.abs(dy)) hop(dx > 0 ? 1 : -1, 0)
      else hop(0, dy < 0 ? 1 : -1)
      touchStart = null
    }
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0],
      }
      const m = map[e.key]
      if (m) { e.preventDefault(); hop(m[0], m[1]) }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)

    const onHidden = () => {
      if (document.hidden && !endedRef.current) finish(s.row >= target ? 'win' : 'loss')
    }
    document.addEventListener('visibilitychange', onHidden)

    // ── loop ──
    function loop(now: number) {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!s.running || endedRef.current) { draw(); return }
      s.time += dt

      // timers
      for (const k of ['invuln', 'shield', 'magnet', 'speed', 'freeze', 'hopCooldown'] as const) {
        if (s[k] > 0) (s[k] as number) = Math.max(0, (s[k] as number) - dt)
      }
      if (s.hopT >= 0) {
        s.hopT += dt / 0.12
        if (s.hopT >= 1) {
          s.hopT = -1
          onArrive()
        }
      }
      s.renderRow += (s.row - s.renderRow) * Math.min(1, dt * 14)

      // vehicles move
      const frozen = s.freeze > 0
      ensureRows(s.row + 40)

      // The map is endless: release the vehicle objects on rows the player
      // has long since left, so a long run doesn't grow without bound.
      while (s.trimmedTo < s.row - 20) {
        const r = s.rows[s.trimmedTo]
        if (r) { r.vehicles = []; r.coin = false; r.powerUp = null }
        s.trimmedTo++
      }

      for (let i = 0; i < s.rows.length; i++) {
        const r = s.rows[i]
        if (r.type !== 'road' || frozen) continue
        for (const v of r.vehicles) {
          v.x += v.speed * r.dir * dt
          if (r.dir === 1 && v.x > W + 50) v.x = -50
          if (r.dir === -1 && v.x < -50) v.x = W + 50
        }
      }

      // continuous collision on the row the chicken occupies
      const curRow = s.rows[s.row]
      if (curRow?.type === 'road' && s.invuln <= 0 && s.shield <= 0 && s.hopT < 0) {
        const cx = (s.col + 0.5) * CELL
        for (const v of curRow.vehicles) {
          const vw = v.w
          if (cx + CELL * 0.28 > v.x - vw / 2 && cx - CELL * 0.28 < v.x + vw / 2) {
            hitVehicle()
            break
          }
        }
      }

      // win / hud
      if (s.row >= target) finish('win')
      if (Math.floor(s.time * 8) !== Math.floor((s.time - dt) * 8)) {
        setHud({
          row: s.row, target, lives: s.lives, coins: s.coins, night: tier >= 2,
          frozen: s.freeze > 0 ? Math.ceil(s.freeze) : 0,
          powers: POWER_KEYS
            .filter(k => (s as unknown as Record<string, number>)[k] > 0)
            .map(k => ({ key: k, left: Math.ceil((s as unknown as Record<string, number>)[k]) })),
        })
      }

      draw()
    }

    function onArrive() {
      const r = s.rows[s.row]
      if (!r || r.taken) return

      // magnet: collect nearby coins automatically
      const collectRadius = s.magnet > 0 ? 1 : 0
      for (let i = Math.max(0, s.row - collectRadius); i <= s.row + collectRadius; i++) {
        const rr = s.rows[i]
        if (rr && !rr.taken && rr.coin && (i !== s.row || rr.coinCol === s.col || s.magnet > 0)) {
          rr.taken = true
          s.coins++
        }
      }
      if (!r.taken && r.coin && r.coinCol === s.col) { r.taken = true; s.coins++ }
      if (!r.taken && r.powerUp && r.powerCol === s.col) {
        r.taken = true
        s.powerUpsCollected++
        if (r.powerUp === 'shield') s.shield = 10
        else if (r.powerUp === 'magnet') s.magnet = 8
        else if (r.powerUp === 'speed') s.speed = 6
        else if (r.powerUp === 'freeze') s.freeze = 5
      }
      if (r.type === 'goal') finish('win')
    }

    function hitVehicle() {
      s.lives -= 1
      s.invuln = 1.6
      if (s.lives <= 0) { finish('loss'); return }
      // knock back one row for realism
      if (s.row > 0) {
        s.hopFromCol = s.col
        s.hopFromRow = s.row
        s.row -= 1
        s.hopT = 0
      }
    }

    function draw() {
      const camY = H * 0.72 // chicken anchored near bottom
      const night = tier >= 2

      // base background
      ctx.fillStyle = night ? '#0f172a' : '#7dd87d'
      ctx.fillRect(0, 0, W, H)

      const rowIndexToY = (i: number) => camY - (i - s.renderRow) * CELL

      // visible rows
      const firstRow = Math.max(0, Math.floor(s.renderRow) - Math.ceil(camY / CELL) - 1)
      const lastRow = Math.min(s.rows.length - 1, Math.ceil(s.renderRow + (H - camY) / CELL) + 2)
      for (let i = firstRow; i <= lastRow; i++) {
        const r = s.rows[i]
        if (!r) continue
        const y = rowIndexToY(i)

        // row background
        if (r.type === 'road') {
          ctx.fillStyle = night ? '#1e293b' : '#57534e'
          ctx.fillRect(0, y - CELL / 2, W, CELL)
          // center dashes
          ctx.fillStyle = night ? '#475569' : '#d6d3d1'
          for (let x = 8; x < W; x += 44) ctx.fillRect(x, y - 2, 22, 4)
        } else if (r.type === 'goal') {
          ctx.fillStyle = '#86efac'
          ctx.fillRect(0, y - CELL / 2, W, CELL)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = `${CELL * 0.5}px serif`
          ctx.fillText('🏡🌻🏡🌻🏡', W / 2, y)
        } else {
          ctx.fillStyle = night ? '#14532d' : '#4ade80'
          ctx.fillRect(0, y - CELL / 2, W, CELL)
        }

        // coin
        if (r.coin && !r.taken) {
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = `${CELL * 0.5}px serif`
          ctx.fillText('🪙', (r.coinCol + 0.5) * CELL, y + Math.sin(s.time * 5 + i) * 2)
        }
        // power-up
        if (r.powerUp && !r.taken) {
          const emoji = POWERS.find(p => p.key === r.powerUp)?.emoji ?? '✨'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = `${CELL * 0.55}px serif`
          ctx.fillText(emoji, (r.powerCol + 0.5) * CELL, y + Math.sin(s.time * 4 + i) * 2)
        }
        // vehicles
        if (r.type === 'road') {
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          for (const v of r.vehicles) {
            ctx.save()
            ctx.font = `${CELL * 0.8}px serif`
            ctx.fillText(v.emoji, v.x, y)
            // headlight glow at night
            if (night && s.freeze <= 0) {
              ctx.fillStyle = '#fbbf2422'
              const glowDir = r.dir
              ctx.beginPath()
              ctx.ellipse(v.x + glowDir * vw(v) * 0.9, y, CELL * 0.9, CELL * 0.35, 0, 0, Math.PI * 2)
              ctx.fill()
            }
            ctx.restore()
          }
        }
      }

      // chicken
      const hopProgress = s.hopT >= 0 ? Math.sin(s.hopT * Math.PI) : 0
      const cx = ((s.hopT >= 0 ? s.hopFromCol + (s.col - s.hopFromCol) * s.hopT : s.col) + 0.5) * CELL
      const cy = rowIndexToY(s.hopT >= 0 ? s.hopFromRow + (s.row - s.hopFromRow) * s.hopT : s.row)
      const blink = s.invuln > 0 && Math.floor(s.time * 10) % 2 === 0
      if (!blink) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `${CELL * 0.72}px serif`
        ctx.fillText('🐔', cx, cy - hopProgress * CELL * 0.4)
        if (s.shield > 0) {
          ctx.font = `${CELL * 0.5}px serif`
          ctx.fillText('🛡️', cx + CELL * 0.3, cy - CELL * 0.3)
        }
      }

      // night overlay
      if (night) {
        ctx.fillStyle = '#0f172a55'
        ctx.fillRect(0, 0, W, H)
      }
      // freeze sparkle
      if (s.freeze > 0) {
        ctx.fillStyle = '#67e8f933'
        ctx.fillRect(0, 0, W, H)
      }
    }

    function vw(v: Vehicle) { return v.w }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [speedMult, tier, target, finish])

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-stone-900">
      {/* HUD */}
      <div className="flex items-center justify-between bg-stone-900 px-3 py-2 text-white">
        <button onClick={onQuit}
          className="min-h-9 rounded-full bg-stone-700 px-3 py-1 text-[11px] font-black"
        >
          ✕ Quit
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-teal-500/30 px-2 py-0.5 text-[9px] font-black uppercase">{tierName}</span>
          <span className="text-lg font-black tabular-nums">
            🛣️ {hud.row}
            <span className="text-xs text-stone-300">/{hud.target}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="tabular-nums text-amber-300">🪙{hud.coins}</span>
        </div>
      </div>
      <div className="flex items-center justify-between bg-stone-800 px-3 py-1 text-white">
        <span className="text-sm" role="img" aria-label={`${hud.lives} of ${MAX_LIVES} lives remaining`}>
          {'❤️'.repeat(hud.lives)}{'🖤'.repeat(Math.max(0, MAX_LIVES - hud.lives))}
        </span>
        <div className="flex items-center gap-2 text-[11px] font-bold">
          {hud.powers.map(p => (
            <span key={p.key} className="rounded-full bg-white/10 px-2 py-0.5 tabular-nums">
              {POWERS.find(x => x.key === p.key)?.emoji} {p.left}s
            </span>
          ))}
          {hud.frozen > 0 && <span className="text-cyan-200">❄️ {hud.frozen}s</span>}
          {hud.night && <span className="text-slate-300">🌙 Night</span>}
        </div>
      </div>

      <div className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none select-none"
          aria-label={`Road crossing: ${hud.row} of ${hud.target} roads, ${hud.coins} coins`}
        />
        <p className="sr-only">
          Frogger-style crossing. Use the arrow keys or WASD to hop between cells. Hop forward
          across the road to the farm to win, and collect coins and power-ups on grass rows.
        </p>

        {/* on-screen d-pad (mobile) */}
        <div className="absolute inset-x-0 bottom-2 flex items-end justify-center gap-2">
          <div className="grid grid-cols-3 gap-1">
            <span />
            <button onClick={() => dispatchKey('ArrowUp')}
              aria-label="Hop forward"
              className="h-12 w-12 rounded-xl bg-white/20 text-xl backdrop-blur active:bg-white/40"
            >
              ⬆️
            </button>
            <span />
            <button onClick={() => dispatchKey('ArrowLeft')}
              aria-label="Hop left"
              className="h-12 w-12 rounded-xl bg-white/20 text-xl backdrop-blur active:bg-white/40"
            >
              ⬅️
            </button>
            <button onClick={() => dispatchKey('ArrowDown')}
              aria-label="Hop back"
              className="h-12 w-12 rounded-xl bg-white/20 text-xl backdrop-blur active:bg-white/40"
            >
              ⬇️
            </button>
            <button onClick={() => dispatchKey('ArrowRight')}
              aria-label="Hop right"
              className="h-12 w-12 rounded-xl bg-white/20 text-xl backdrop-blur active:bg-white/40"
            >
              ➡️
            </button>
          </div>
        </div>

        {ended && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/75"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-7xl">
              {ended === 'win' ? '🏡' : '💥'}
            </motion.div>
            <p className="mt-3 text-2xl font-black text-white">{ended === 'win' ? 'REACHED THE FARM!' : 'SPLAT!'}</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-stone-200">{hud.row} roads crossed · tallying rewards…</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}
