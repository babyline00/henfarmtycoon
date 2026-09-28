'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { play } from '@/lib/sfx'
// Physics comes from the shared contract so the server's plausibility cap
// is exact. The first two games derive their geometry from the canvas's
// pixel width, which means the same session plays differently on a phone
// and a desktop; this one simulates in a fixed logical field and scales
// only at draw time, so behaviour is identical on every screen — and the
// item rate, which the server integrates, is the real one.
import {
  CATCH_FIELD_W, CATCH_FIELD_H, CATCH_MAX_DURATION_SEC,
  catchFallSpeed, catchSpawnRate,
} from '@/lib/mini-games'

//══════════ MiniGame 3: Egg Catch ══════════
// Move the basket, scoop good eggs, dodge the rocks. Three lives.
// The client reports raw telemetry; ALL rewards are computed server-side.

interface Props {
  sessionId: string
  tier: number
  tierName: string
  speedMult: number
  winTarget: number
  onEnd: (telemetry: { eggs: number; coins: number; gems: number; boxes: number; missed: number }) => void
  onQuit: () => void
}

type Kind = 'egg' | 'coin' | 'gem' | 'box' | 'rock'

interface Falling {
  kind: Kind
  x: number
  y: number
  spin: number
  dead: boolean
}

const BASKET_W = 150
const BASKET_H = 34
const BASKET_Y = CATCH_FIELD_H - 62
const ITEM_R = 24
/** How much of the fall the basket reaches, in logical units. */
const CATCH_BAND = 30

const EMOJI: Record<Kind, string> = { egg: '🥚', coin: '🪙', gem: '💎', box: '🎁', rock: '🪨' }

/** Spawn table. Rocks are a real fraction so dodging matters. */
const SPAWN_TABLE: Kind[] = [
  'egg', 'egg', 'egg', 'coin', 'egg', 'rock', 'egg', 'gem', 'coin', 'box', 'egg', 'rock',
]

const MAX_LIVES = 3

export function EggCatch({ tier, tierName, speedMult, winTarget, onEnd, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hud, setHud] = useState({ eggs: 0, lives: MAX_LIVES, rate: 0, fall: 0 })
  const [ended, setEnded] = useState<null | 'win' | 'loss'>(null)
  const endedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  useEffect(() => { onEndRef.current = onEnd })

  const stateRef = useRef({
    // basket
    x: CATCH_FIELD_W / 2,
    targetX: CATCH_FIELD_W / 2,
    // falling
    items: [] as Falling[],
    spawnAcc: 0,
    // scoring
    eggs: 0, coins: 0, gems: 0, boxes: 0, missed: 0,
    lives: MAX_LIVES,
    invuln: 0,
    // clock
    time: 0, running: true,
    shake: 0,
  })

  const finish = useCallback((result: 'win' | 'loss') => {
    if (endedRef.current) return
    endedRef.current = true
    stateRef.current.running = false
    setEnded(result)
    const s = stateRef.current
    // A beat so the player sees the last catch land before the modal.
    setTimeout(() => {
      onEndRef.current({
        eggs: s.eggs, coins: s.coins, gems: s.gems, boxes: s.boxes, missed: s.missed,
      })
    }, 700)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const maybeCtx = canvas.getContext('2d')
    if (!maybeCtx) return
    // Non-null alias: TypeScript does not carry a `const` narrowing into
    // hoisted function declarations, and draw() needs the context.
    const ctx: CanvasRenderingContext2D = maybeCtx
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

    // Re-measured on every resize. The play field itself never changes —
    // it is logical — so a rotation only changes how it is letterboxed.
    let scale = 1
    let offX = 0
    let offY = 0
    let viewW = 0
    let viewH = 0
    const resize = () => {
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      if (cw === 0 || ch === 0) return
      viewW = cw
      viewH = ch
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
      scale = Math.min(cw / CATCH_FIELD_W, ch / CATCH_FIELD_H)
      offX = (cw - CATCH_FIELD_W * scale) / 2
      offY = (ch - CATCH_FIELD_H * scale) / 2
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)

    const s = stateRef.current
    let raf = 0
    let last = performance.now()

    // ── input ──
    // Pointer sets a target and the basket eases toward it, which is what
    // makes it feel like weight rather than a cursor glued to a sprite.
    // Pointer sets a target and the basket eases toward it, which is what
    // makes it feel like weight rather than a cursor glued to a sprite.
    // Horizontal position only: a catcher moves along one axis, and taking
    // the vertical component would make a tap in the top of the field
    // yank the basket to a random column.
    const setTargetFromEvent = (clientX: number) => {
      const rect = canvas.getBoundingClientRect()
      const lx = (clientX - rect.left - offX) / scale
      s.targetX = Math.max(BASKET_W / 2, Math.min(CATCH_FIELD_W - BASKET_W / 2, lx))
    }
    const onPointerDown = (e: PointerEvent) => { setTargetFromEvent(e.clientX) }
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.buttons !== 0) setTargetFromEvent(e.clientX)
    }
    const onKey = (e: KeyboardEvent) => {
      const step = 34
      if (e.key === 'ArrowLeft' || e.key === 'a') { s.targetX -= step; e.preventDefault() }
      else if (e.key === 'ArrowRight' || e.key === 'd') { s.targetX += step; e.preventDefault() }
      s.targetX = Math.max(BASKET_W / 2, Math.min(CATCH_FIELD_W - BASKET_W / 2, s.targetX))
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKey)

    const onHidden = () => {
      // Settle as a loss rather than leaving a session dangling.
      if (document.hidden && !endedRef.current) finish(s.eggs >= winTarget ? 'win' : 'loss')
    }
    document.addEventListener('visibilitychange', onHidden)

    // ── spawning ──
    function spawn() {
      const kind = SPAWN_TABLE[Math.floor(Math.random() * SPAWN_TABLE.length)]
      s.items.push({
        kind,
        x: ITEM_R + Math.random() * (CATCH_FIELD_W - ITEM_R * 2),
        y: -ITEM_R,
        spin: (Math.random() * 2 - 1) * 2.4,
        dead: false,
      })
    }

    // ── loop ──
    function loop(now: number) {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) /1000)
      last = now
      if (!s.running || endedRef.current) { draw(); return }
      s.time += dt
      if (s.invuln > 0) s.invuln -= dt
      if (s.shake > 0) s.shake -= dt

      // A session longer than the server will accept would be voided, so
      // end it here instead and keep the telemetry honest.
      if (s.time >= CATCH_MAX_DURATION_SEC - 1) {
        finish(s.eggs >= winTarget ? 'win' : 'loss')
        return
      }

      // basket easing
      s.x += (s.targetX - s.x) * Math.min(1, dt * 16)

      // spawn on the shared rate ramp, so the count the server allows is
      // the count that actually happened
      s.spawnAcc += catchSpawnRate(s.time) * dt
      while (s.spawnAcc >= 1) { s.spawnAcc -= 1; spawn() }

      const fall = catchFallSpeed(s.time) * speedMult
      for (const it of s.items) {
        it.y += fall * dt
        if (it.dead) continue
        if (it.y < BASKET_Y - CATCH_BAND || it.y > BASKET_Y + CATCH_BAND) continue
        if (Math.abs(it.x - s.x) > BASKET_W / 2) continue
        if (Math.abs(it.y - BASKET_Y) > CATCH_BAND) continue

        it.dead = true
        if (it.kind === 'rock') {
          if (s.invuln <= 0) {
            s.lives -= 1
            s.invuln = 1.2
            s.shake = 0.3
            play('error')
            if (s.lives <= 0) { finish(s.eggs >= winTarget ? 'win' : 'loss'); return }
          }
          continue
        }
        if (it.kind === 'egg') { s.eggs++; play('egg_crack') }
        else if (it.kind === 'coin') { s.coins++; play('coin') }
        else if (it.kind === 'gem') { s.gems++; play('reward') }
        else if (it.kind === 'box') { s.boxes++; play('powerup') }
      }
      s.items = s.items.filter(it => !it.dead && it.y < CATCH_FIELD_H + ITEM_R)

      if (s.eggs >= winTarget) { finish('win'); return }

      setHud({
        eggs: s.eggs, lives: s.lives,
        rate: catchSpawnRate(s.time), fall: Math.round(fall),
      })

      draw()
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, viewW, viewH)

      // sky → grass, matching the farm palette
      const grad = ctx.createLinearGradient(0, offY, 0, offY + CATCH_FIELD_H * scale)
      grad.addColorStop(0, '#f0fdf4')
      grad.addColorStop(1, '#bbf7d0')
      ctx.fillStyle = grad
      ctx.fillRect(offX, offY, CATCH_FIELD_W * scale, CATCH_FIELD_H * scale)

      // move into logical space
      ctx.translate(offX, offY)
      ctx.scale(scale, scale)

      const shakeX = s.shake > 0 ? Math.sin(s.shake * 60) * 5 : 0

      // falling items
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const it of s.items) {
        ctx.font = `${ITEM_R * 2}px serif`
        ctx.fillText(EMOJI[it.kind], it.x + shakeX, it.y)
      }

      // basket
      ctx.font = `${BASKET_H * 1.6}px serif`
      ctx.fillText('🧺', s.x + shakeX, BASKET_Y)

      // progress bar
      const pct = Math.min(1, s.eggs / winTarget)
      ctx.fillStyle = '#00000018'
      ctx.fillRect(0, 0, CATCH_FIELD_W, 10)
      ctx.fillStyle = '#16a34a'
      ctx.fillRect(0, 0, CATCH_FIELD_W * pct, 10)
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [speedMult, winTarget, finish])

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-stone-900">
      <div className="flex items-center justify-between bg-stone-900 px-3 py-2 text-white">
        <button onClick={onQuit} className="min-h-9 rounded-full bg-stone-700 px-3 py-1 text-[11px] font-black">
          ✕ Quit
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-500/30 px-2 py-0.5 text-[9px] font-black uppercase">{tierName}</span>
          <span className="text-lg font-black tabular-nums">
            {hud.eggs}
            <span className="text-xs text-stone-300">/{winTarget} 🥚</span>
          </span>
        </div>
        <span className="text-[10px] font-bold tabular-nums text-stone-300">⚡ {hud.fall}</span>
      </div>
      <div className="flex items-center justify-between bg-stone-800 px-3 py-1 text-white">
        <span className="text-sm" role="img" aria-label={`${hud.lives} of ${MAX_LIVES} lives remaining`}>
          {'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(Math.max(0, MAX_LIVES - hud.lives))}
        </span>
        <span className="text-[10px] font-bold text-stone-300">{hud.rate.toFixed(1)}/s</span>
      </div>

      <div className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none select-none"
          aria-label={`Egg Catch: ${hud.eggs} of ${winTarget} eggs scooped, ${hud.lives} lives left`}
        />
        <p className="sr-only">
          Move the basket with the left and right arrow keys, or drag and tap on the
          play field. Scoop the eggs, coins, gems and boxes. Avoid the rocks: each
          one that lands in the basket costs a life.
        </p>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
          <p className="rounded-full bg-black/60 px-3 py-1 text-center text-[10px] font-bold text-white/90">
            Drag or tap to move the basket · arrow keys · avoid 🪨
          </p>
        </div>

        {ended && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/75"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-7xl">
              {ended === 'win' ? '🧺' : '🪨'}
            </motion.div>
            <p className="mt-3 text-2xl font-black text-white">
              {ended === 'win' ? 'BASKET FULL!' : 'SPILLED!'}
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums text-stone-200">
              {hud.eggs} eggs · tallying rewards…
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
