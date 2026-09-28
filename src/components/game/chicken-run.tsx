'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
// The physics lives in lib/mini-games so the server validator and this
// game cannot disagree. They used to: the client topped out at
// 24 m/s × the tier multiplier while the server capped at a hand-picked
// 30, so from the "city" tier upward a player running at full speed was
// rejected as a cheater and flagged for review.
import {
  RUN_START_SPEED_MPS, RUN_BASE_SPEED_MPS, RUN_RAMP_METRES, RUN_JUMP_HEIGHT,
  runMaxSpeedMps,
} from '@/lib/mini-games'

//══════════ MiniGame 1: Chicken Run (endless runner) ══════════
// 3 lanes · swipe/arrows to switch lanes · swipe up/space to jump
// Jump clears "low" obstacles (rocks, barriers, dogs) — cars & trees must be dodged.
// Collectibles: 🥚 eggs · 🪙 coins · 💎 gems · 🎁 mystery boxes
// The client only tracks raw telemetry; ALL rewards are computed server-side.

interface Props {
  sessionId: string
  tier: number
  tierName: string
  speedMult: number
  winTarget: number
  onEnd: (telemetry: { distance: number; coins: number; eggs: number; gems: number; boxes: number }) => void
  onQuit: () => void
}

interface Entity {
  x: number
  y: number
  kind: 'coin' | 'egg' | 'gem' | 'box' | 'obstacle'
  obstacle?: string
  low?: boolean
  hit?: boolean
  dead?: boolean
}

const LANES_X = [0.25, 0.5, 0.75]
const LOW_OBSTACLES: { e: string; name: string }[] = [{ e: '🪨', name: 'rock' }, { e: '🚧', name: 'barrier' }, { e: '🐕', name: 'dog' }]
const TALL_OBSTACLES: { e: string; name: string }[] = [{ e: '🚗', name: 'car' }, { e: '🌳', name: 'tree' }]
const MAX_LIVES = 3
const PX_PER_M = 6

const EMOJI_FOR: Record<string, string> = { coin: '🪙', egg: '🥚', gem: '💎', box: '🎁' }

export function ChickenRun({ tier, tierName, speedMult, winTarget, onEnd, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hud, setHud] = useState({ distance: 0, lives: MAX_LIVES, coins: 0, eggs: 0, gems: 0, boxes: 0, mps: 0 })
  const [ended, setEnded] = useState<null | 'win' | 'loss'>(null)
  const endedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  useEffect(() => { onEndRef.current = onEnd })

  const stateRef = useRef({
    lane: 1,
    laneAnim: 1,        // 0..2 (float while lerping)
    jumpT: -1,           // -1 = grounded; 0..1 = air progress
    lives: MAX_LIVES,
    invuln: 0,
    distance: 0,
    speed: 8,
    time: 0,
    running: true,
    coins: 0,
    eggs: 0,
    gems: 0,
    boxes: 0,
    entities: [] as Entity[],
    nextSpawnAt: 30,     // meters
    shake: 0,
  })

  const finish = useCallback((result: 'win' | 'loss') => {
    if (endedRef.current) return
    endedRef.current = true
    stateRef.current.running = false
    setEnded(result)
    const s = stateRef.current
    setTimeout(() => {
      onEndRef.current({
        distance: Math.floor(s.distance), coins: s.coins,
        eggs: s.eggs, gems: s.gems, boxes: s.boxes,
      })
    }, 900)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const maybeCtx = canvas.getContext('2d')
    if (!maybeCtx) return
    // non-null alias: TypeScript does not carry a `const` narrowing into
    // hoisted function declarations, and every draw helper needs it.
    const ctx: CanvasRenderingContext2D = maybeCtx
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

    // Measured size is mutable and re-measured on resize. Rotating the
    // device or opening the on-screen keyboard used to leave the backing
    // store at the old size, stretching the render and desynchronising
    // collision maths from what is actually on screen.
    let W = canvas.clientWidth
    let H = canvas.clientHeight
    const resize = () => {
      W = canvas.clientWidth
      H = canvas.clientHeight
      if (W === 0 || H === 0) return
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

    // ── input ──
    const moveLane = (dir: -1 | 1) => {
      if (!s.running || endedRef.current) return
      s.lane = Math.max(0, Math.min(2, s.lane + dir))
    }
    const jump = () => {
      if (!s.running || endedRef.current) return
      if (s.jumpT < 0) s.jumpT = 0
    }

    let touchStart: { x: number; y: number; t: number } | null = null
    const onTouchStart = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now() }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart) return
      const t = e.changedTouches[0]
      const dx = t.clientX - touchStart.x
      const dy = t.clientY - touchStart.y
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { jump() }
      else if (Math.abs(dx) > Math.abs(dy)) { moveLane(dx > 0 ? 1 : -1) }
      else if (dy < 0) { jump() }
      touchStart = null
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') moveLane(-1)
      else if (e.key === 'ArrowRight' || e.key === 'd') moveLane(1)
      else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') { e.preventDefault(); jump() }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    canvas.addEventListener('click', jump)
    window.addEventListener('keydown', onKey)

    // ending when the tab is hidden keeps the server-side duration honest
    const onHidden = () => {
      if (document.hidden && !endedRef.current) finish(s.distance >= winTarget ? 'win' : 'loss')
    }
    document.addEventListener('visibilitychange', onHidden)

    // ── spawning ──
    function spawnWave() {
      const roll = Math.random()
      if (roll < 0.62) {
        // obstacle wave: block 1-2 lanes (tier raises double-block chance)
        const doubleBlock = Math.random() < 0.25 + tier * 0.08
        const lanes = [0, 1, 2].sort(() => Math.random() - 0.5)
        const blocked = doubleBlock ? [lanes[0], lanes[1]] : [lanes[0]]
        for (const ln of blocked) {
          const low = Math.random() < 0.55
          const pool = low ? LOW_OBSTACLES : TALL_OBSTACLES
          const ob = pool[Math.floor(Math.random() * pool.length)]
          s.entities.push({ kind: 'obstacle', x: LANES_X[ln], y: -50, obstacle: ob.e, low })
        }
      } else {
        // collectible trail in one lane
        const ln = Math.floor(Math.random() * 3)
        const n = 3 + Math.floor(Math.random() * 3)
        const kinds: Entity['kind'][] = ['coin', 'coin', 'coin', 'egg', 'gem', 'box']
        const kind = kinds[Math.floor(Math.random() * kinds.length)]
        for (let i = 0; i < n; i++) {
          s.entities.push({ kind, x: LANES_X[ln], y: -50 - i * 42 })
        }
      }
      s.nextSpawnAt = s.distance + 22 + Math.random() * 26
    }

    // ── loop ──
    function loop(now: number) {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!s.running || endedRef.current) { draw(); return }
      s.time += dt

      // speed ramps with distance
      s.speed = Math.min(RUN_BASE_SPEED_MPS, RUN_START_SPEED_MPS + s.distance / RUN_RAMP_METRES) * speedMult
      const dyPx = s.speed * PX_PER_M * dt
      s.distance += s.speed * dt
      if (s.invuln > 0) s.invuln -= dt
      if (s.shake > 0) s.shake -= dt

      // jump physics (0.55s arc)
      if (s.jumpT >= 0) {
        s.jumpT += dt / 0.55
        if (s.jumpT >= 1) s.jumpT = -1
      }

      // lane lerp
      s.laneAnim += (s.lane - s.laneAnim) * Math.min(1, dt * 12)

      // spawn
      if (s.distance >= s.nextSpawnAt) spawnWave()

      // move entities + collisions
      const playerY = H - 86
      const px = LANES_X[0] * W + s.laneAnim * ((LANES_X[1] - LANES_X[0]) * W)
      const jumpH = s.jumpT >= 0 ? Math.sin(s.jumpT * Math.PI) * RUN_JUMP_HEIGHT : 0
      const playerRect = { x: px - 19, y: playerY - 36 - jumpH, w: 38, h: 38 }

      for (const en of s.entities) {
        en.y += dyPx
        if (en.dead) continue
        const ex = en.x * W
        if (en.kind === 'obstacle') {
          if (!en.hit && rectsOverlap(playerRect, { x: ex - 22, y: en.y - 20, w: 44, h: 44 })) {
            // jumpable if airborne & low obstacle
            const cleared = jumpH > RUN_JUMP_HEIGHT * 0.36 && en.low
            if (!cleared && s.invuln <= 0) {
              en.hit = true
              s.lives -= 1
              s.invuln = 1.4
              s.shake = 0.3
              if (s.lives <= 0) finish('loss')
            }
          }
        } else {
          if (rectsOverlap(playerRect, { x: ex - 17, y: en.y - 17, w: 34, h: 34 })) {
            en.dead = true
            if (en.kind === 'coin') s.coins++
            else if (en.kind === 'egg') s.eggs++
            else if (en.kind === 'gem') s.gems++
            else if (en.kind === 'box') s.boxes++
          }
        }
      }
      s.entities = s.entities.filter(en => en.y < H + 60 && !en.dead)

      // win check
      if (s.distance >= winTarget) finish('win')

      // HUD at ~8Hz
      if (Math.floor(s.time * 8) !== Math.floor((s.time - dt) * 8)) {
        setHud({
          distance: Math.floor(s.distance), lives: s.lives,
          coins: s.coins, eggs: s.eggs, gems: s.gems, boxes: s.boxes,
          mps: Math.round(s.speed),
        })
      }

      draw()
    }

    function draw() {
      // sky/ground per tier
      const palettes = [
        ['#fefce8', '#d9f99d', '#a3e635'], // farm
        ['#f0fdf4', '#bbf7d0', '#86efac'], // village
        ['#eff6ff', '#bfdbfe', '#93c5fd'], // city
        ['#f5f5f4', '#d6d3d1', '#a8a29e'], // highway
        ['#1c1917', '#44403c', '#fbbf24'], // legendary (night)
      ]
      const p = palettes[Math.min(tier, palettes.length - 1)]
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, p[0])
      grad.addColorStop(1, p[1])
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      const shakeX = s.shake > 0 ? Math.sin(s.shake * 60) * 4 : 0
      ctx.save()
      ctx.translate(shakeX, 0)

      // scrolling road stripes
      const scroll = (s.distance * PX_PER_M) % 80
      ctx.fillStyle = p[2] + '55'
      for (let y = -80 + scroll; y < H; y += 80) ctx.fillRect(0, y, W, 30)

      // lane separators
      ctx.strokeStyle = '#ffffff88'
      ctx.setLineDash([14, 12])
      ctx.lineWidth = 2
      for (const fx of [1 / 3, 2 / 3]) {
        ctx.beginPath()
        ctx.moveTo(W * fx, 0)
        ctx.lineTo(W * fx, H)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // entities
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const en of s.entities) {
        const ex = en.x * W
        if (en.kind === 'obstacle') {
          ctx.font = '34px serif'
          ctx.fillText(en.obstacle!, ex, en.y)
        } else {
          ctx.font = '26px serif'
          const bob = Math.sin(s.time * 6 + ex) * 2
          ctx.fillText(EMOJI_FOR[en.kind] ?? '🎁', ex, en.y + bob)
        }
      }

      // player chicken
      const px2 = LANES_X[0] * W + s.laneAnim * ((LANES_X[1] - LANES_X[0]) * W)
      const playerY = H - 86
      const jumpH = s.jumpT >= 0 ? Math.sin(s.jumpT * Math.PI) * RUN_JUMP_HEIGHT : 0
      const blink = s.invuln > 0 && Math.floor(s.time * 10) % 2 === 0

      // shadow
      ctx.fillStyle = '#00000022'
      ctx.beginPath()
      ctx.ellipse(px2, playerY + 8, 20 - jumpH * 0.12, 7 - jumpH * 0.05, 0, 0, Math.PI * 2)
      ctx.fill()
      if (!blink) {
        ctx.font = '38px serif'
        ctx.fillText('🐔', px2, playerY - 16 - jumpH)
      }

      // progress toward the win target (top of the canvas)
      const prog = Math.min(1, s.distance / winTarget)
      ctx.fillStyle = '#00000018'
      ctx.fillRect(0, 0, W, 5)
      ctx.fillStyle = '#16a34a'
      ctx.fillRect(0, 0, W * prog, 5)

      // finish line marker
      if (prog > 0.85) {
        ctx.fillStyle = '#ffffffcc'
        for (let i = 0; i < 10; i++) ctx.fillRect(W - 8, i * (H / 10), 8, H / 20)
      }

      ctx.restore()
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('click', jump)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [speedMult, tier, winTarget, finish])

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
          <span className="rounded-full bg-purple-500/30 px-2 py-0.5 text-[9px] font-black uppercase">{tierName}</span>
          <span className="text-lg font-black tabular-nums">
            {hud.distance}
            <span className="text-xs text-stone-300">m /{winTarget}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="tabular-nums text-amber-300">🪙{hud.coins}</span>
          <span className="tabular-nums">🥚{hud.eggs}</span>
          {hud.gems > 0 && <span className="tabular-nums text-pink-300">💎{hud.gems}</span>}
          {hud.boxes > 0 && <span className="tabular-nums text-purple-200">🎁{hud.boxes}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between bg-stone-800 px-3 py-1 text-white">
        <span className="text-sm" role="img" aria-label={`${hud.lives} of ${MAX_LIVES} lives remaining`}>
          {'❤️'.repeat(hud.lives)}{'🖤'.repeat(Math.max(0, MAX_LIVES - hud.lives))}
        </span>
        <span className="text-[10px] font-bold text-stone-300">⚡ {hud.mps} m/s</span>
      </div>

      <div className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none select-none"
          aria-label={`Chicken Run: ${hud.distance} of ${winTarget} metres run, ${hud.coins} coins, ${hud.eggs} eggs`}
        />
        <p className="sr-only">
          Endless runner. Use the left and right arrow keys to change lane, and the up arrow or
          space bar to jump over low obstacles. Dodge cars and trees — only rocks, barriers and
          dogs can be jumped.
        </p>

        {/* mobile control hints */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
          <p className="rounded-full bg-black/60 px-3 py-1 text-center text-[10px] font-bold text-white/90">
            Swipe ⬅️➡️ to change lanes · swipe ⬆️ or tap to jump · arrow keys + space on desktop
          </p>
        </div>

        {/* desktop lane buttons */}
        <div className="absolute inset-x-0 bottom-14 flex justify-center gap-3 sm:hidden">
          <button onClick={() => dispatchKey('ArrowLeft')}
            aria-label="Move left"
            className="h-14 w-14 rounded-full bg-white/20 text-2xl backdrop-blur"
          >
            ⬅️
          </button>
          <button onClick={() => dispatchKey('ArrowUp')}
            aria-label="Jump"
            className="h-14 w-14 rounded-full bg-white/20 text-2xl backdrop-blur"
          >
            ⬆️
          </button>
          <button onClick={() => dispatchKey('ArrowRight')}
            aria-label="Move right"
            className="h-14 w-14 rounded-full bg-white/20 text-2xl backdrop-blur"
          >
            ➡️
          </button>
        </div>

        {ended && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/75"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-7xl">
              {ended === 'win' ? '🏁' : '💥'}
            </motion.div>
            <p className="mt-3 text-2xl font-black text-white">{ended === 'win' ? 'FINISH!' : 'OUCH!'}</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-stone-200">{hud.distance}m · tallying rewards…</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
