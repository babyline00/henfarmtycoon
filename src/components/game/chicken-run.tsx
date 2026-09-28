'useclient'

import{ useEffect, useRef, useState, useCallback} from'react'
import{ motion} from'framer-motion'
import{ cn} from'@/lib/utils'

//══════════ Phase 33— MiniGame 1:ChickenRun(endlessrunner) ══════════
// 3 lanes· swipe/arrows to switch lanes· swipe up/space to jump //Jump clears"low" obstacles(rocks, barriers, dogs) — cars& trees must be dodged. //Collectibles:🥚 eggs· 🪙 coins· 💎 gems· 🎁 mystery boxes //The client only tracks rawtelemetry; ALL rewards are computed server-side. interfaceProps{
  sessionId: string tier: numbertierName: stringspeedMult: numberwinTarget: numberonEnd:(telemetry:{ distance:number; coins:number; eggs:number; gems:number; boxes: number}) => voidonQuit:() => void}

interfaceEntity{
  x:number; y: number kind:'coin' | 'egg' | 'gem' | 'box' | 'obstacle'
  obstacle?: string // emojilow?: booleanhit?: booleandead?: boolean}

constLANES_X = [0.25, 0.5, 0.75] constLOW_OBSTACLES:{ e:string; name: string}[]= [{ e:'🪨', name:'rock' }, { e:'🚧', name:'barrier' }, { e:'🐕', name:'dog' },
] constTALL_OBSTACLES:{ e:string; name: string}[]= [{ e:'🚗', name:'car' }, { e:'🌳', name:'tree' },
] export functionChickenRun({ sessionId, tier, tierName, speedMult, winTarget, onEnd, onQuit}:Props) {
  constcanvasRef= useRef<HTMLCanvasElement>(null)
  const[hud, setHud]= useState({ distance:0, lives:3, coins:0, eggs:0, gems:0, boxes:0, mps: 0})
  const[ended, setEnded]= useState<null| 'win' | 'loss'>(null)
  constendedRef= useRef(false)
  constonEndRef= useRef(onEnd)
  useEffect(() => { onEndRef.current= onEnd})

  conststateRef= useRef({
    lane:1, laneAnim:1, // 0..2(laneAnim is float whilelerping)
    jumpT:-1, // -1= grounded; 0..1= air progress lives:3, invuln:0,
    distance:0, speed:8,
    coins:0, eggs:0, gems:0, boxes:0,
    entities: [] asEntity[],
    nextSpawnAt:30, // meters time:0, running:true,
    shake:0,
  })

  const finish= useCallback((result:'win' | 'loss') => {
    if(endedRef.current) returnendedRef.current= truestateRef.current.running= falsesetEnded(result)
    const s= stateRef.currentsetTimeout(() => {
      onEndRef.current({
        distance:Math.floor(s.distance), coins:s.coins,
        eggs:s.eggs, gems:s.gems, boxes:s.boxes,
      })
    }, 900)
  }, [])

  useEffect(() => {
    const canvas= canvasRef.current if(!canvas) return const ctx= canvas.getContext('2d')
    if(!ctx) return const dpr= Math.min(2, typeof window!== 'undefined' ? window.devicePixelRatio|| 1 :1)
    //Measured size is mutable and re-measured on resize.Rotating the // device or opening the on-screen keyboard used to leave the backing // store at the oldsize, stretching the render and desynchronising // collision maths from what is actually on screen. letW = canvas.clientWidth letH = canvas.clientHeight const resize= () => {
      W = canvas.clientWidthH = canvas.clientHeight if(W === 0|| H === 0) return canvas.width= Math.round(W * dpr)
      canvas.height= Math.round(H * dpr)
      //setTransform, not scale:scale() accumulates across calls.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const ro= typeofResizeObserver!== 'undefined' ? newResizeObserver(resize) : nullro?.observe(canvas)

    constPX_PER_M = 6 const s= stateRef.current let raf= 0 let last= performance.now()

    //── input──
    constmoveLane= (dir: -1| 1) => {
      if(!s.running|| endedRef.current) return s.lane= Math.max(0, Math.min(2, s.lane+ dir))
    }
    const jump= () => {
      if(!s.running|| endedRef.current) return if(s.jumpT < 0) s.jumpT = 0}

    lettouchStart:{ x:number; y:number; t: number} | null= null constonTouchStart= (e:TouchEvent) => {
      const t= e.changedTouches[0]touchStart= { x:t.clientX, y:t.clientY, t:Date.now() }
    }
    constonTouchEnd= (e:TouchEvent) => {
      if(!touchStart) return const t= e.changedTouches[0] const dx= t.clientX -touchStart.x const dy= t.clientY -touchStart.y if(Math.abs(dx) < 24&& Math.abs(dy) < 24) { jump() }
      else if(Math.abs(dx) > Math.abs(dy)) { moveLane(dx> 0? 1 :-1) }
      else if(dy< 0) { jump() }
      touchStart= null}
    constonKey= (e:KeyboardEvent) => {
      if(e.key=== 'ArrowLeft' || e.key=== 'a') moveLane(-1)
      else if(e.key=== 'ArrowRight' || e.key=== 'd') moveLane(1)
      else if(e.key=== 'ArrowUp' || e.key=== ' ' || e.key=== 'w') { e.preventDefault(); jump() }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true})
    canvas.addEventListener('touchend', onTouchEnd, { passive: true})
    canvas.addEventListener('click', jump)
    window.addEventListener('keydown', onKey)

    // ending when tab hidden keeps server-side duration honest constonHidden= () => {
      if(document.hidden&& !endedRef.current) finish(s.distance>= winTarget? 'win' :'loss')
    }
    document.addEventListener('visibilitychange', onHidden)

    //── spawning──
    functionspawnWave() {
      const roll= Math.random()
      if(roll< 0.62) {
        // obstacle wave: block 1-2 lanes(tier raises double-blockchance)
        constdoubleBlock= Math.random() < 0.25+ tier* 0.08 const lanes= [0, 1, 2].sort(() => Math.random() -0.5)
        const blocked= doubleBlock? [lanes[0], lanes[1]] : [lanes[0]] for(const ln ofblocked) {
          const low= Math.random() < 0.55 const pool= low? LOW_OBSTACLES :TALL_OBSTACLES
          const ob= pool[Math.floor(Math.random() * pool.length)]s.entities.push({ kind:'obstacle', x:LANES_X[ln], y:-50, obstacle:ob.e, low})
        }
      } else{
        // collectible trail in one lane const ln= Math.floor(Math.random() * 3)
        const n= 3+ Math.floor(Math.random() * 3)
        const kinds:Entity['kind'][]= ['coin', 'coin', 'coin', 'egg', 'gem', 'box'] const kind= kinds[Math.floor(Math.random() * kinds.length)] for(let i= 0; i< n; i++) {
          s.entities.push({ kind, x:LANES_X[ln], y: -50 - i* 42})
        }
      }
      s.nextSpawnAt= s.distance+ 22+ Math.random() * 26}

    //── loop──
    functionloop(now:number) {
      raf= requestAnimationFrame(loop)
      const dt= Math.min(0.05, (now -last) /1000)
      last= now if(!s.running|| endedRef.current) { draw(); return}
      s.time+= dt // speed ramps with distance s.speed= Math.min(24, 8+ s.distance /140) * speedMult constdyPx= s.speed* PX_PER_M * dt s.distance+= s.speed* dt if(s.invuln> 0) s.invuln-= dt if(s.shake> 0) s.shake-= dt // jump physics(0.55sarc)
      if(s.jumpT >= 0) {
        s.jumpT += dt / 0.55 if(s.jumpT >= 1) s.jumpT = -1}

      // lane lerps.laneAnim+= (s.lane -s.laneAnim) * Math.min(1, dt* 12)

      // spawn if(s.distance>= s.nextSpawnAt) spawnWave()

      // move entities+ collisions constplayerY = H - 86 const px= LANES_X[0]* W + s.laneAnim* ((LANES_X[1] -LANES_X[0]) * W)
      constjumpH = s.jumpT >= 0? Math.sin(s.jumpT * Math.PI) * 72 : 0 constplayerRect= { x: px -19, y:playerY - 36 -jumpH, w:38, h: 38}

      for(const en ofs.entities) {
        en.y+= dyPx if(en.dead) continue const ex= en.x* W
        if(en.kind=== 'obstacle') {
          if(!en.hit&& rectsOverlap(playerRect, { x: ex -22, y: en.y -20, w:44, h: 44})) {
            // jumpable if airborne& low obstacle const cleared= jumpH > 26&& en.low if(!cleared&& s.invuln<= 0) {
              en.hit= true s.lives-= 1 s.invuln= 1.4 s.shake= 0.3 if(s.lives<= 0) finish('loss')
            }
          }
        } else{
          if(rectsOverlap(playerRect, { x: ex -17, y: en.y -17, w:34, h: 34})) {
            en.dead= true if(en.kind=== 'coin') s.coins++
            else if(en.kind=== 'egg') s.eggs++
            else if(en.kind=== 'gem') s.gems++
            else if(en.kind=== 'box') s.boxes++
          }
        }
      }
      s.entities= s.entities.filter(en=> en.y< H + 60&& !en.dead)

      // win check if(s.distance>= winTarget) finish('win')

      //HUD at~8Hz if(Math.floor(s.time* 8) !== Math.floor((s.time -dt) * 8)) {
        setHud({
          distance:Math.floor(s.distance), lives:s.lives,
          coins:s.coins, eggs:s.eggs, gems:s.gems, boxes:s.boxes,
          mps:Math.round(s.speed),
        })
      }

      draw()
    }

    functiondraw() {
      // sky/ground per tier const palettes= [['#fefce8', '#d9f99d', '#a3e635'], // farm['#f0fdf4', '#bbf7d0', '#86efac'], // village['#eff6ff', '#bfdbfe', '#93c5fd'], // city['#f5f5f4', '#d6d3d1', '#a8a29e'], // highway['#1c1917', '#44403c', '#fbbf24'], // legendary(night)
      ] const p= palettes[Math.min(tier, palettes.length -1)] const grad= ctx!.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, p[0])
      grad.addColorStop(1, p[1])
      ctx!.fillStyle= gradctx!.fillRect(0, 0, W, H)

      constshakeX = s.shake> 0? Math.sin(s.shake* 60) * 4 : 0ctx!.save()
      ctx!.translate(shakeX, 0)

      // scrolling road stripes const scroll= (s.distance* PX_PER_M) % 80ctx!.fillStyle= p[2]+ '55'
      for(let y= -80+ scroll; y< H; y+= 80) ctx!.fillRect(0, y, W, 30)
      // lane separatorsctx!.strokeStyle= '#ffffff88'
      ctx!.setLineDash([14, 12])
      ctx!.lineWidth= 2 for(const fx of [1 /3, 2 /3]) {
        ctx!.beginPath()
        ctx!.moveTo(W * fx, 0)
        ctx!.lineTo(W * fx, H)
        ctx!.stroke()
      }
      ctx!.setLineDash([])

      // entitiesctx!.textAlign= 'center'
      ctx!.textBaseline= 'middle'
      for(const en ofs.entities) {
        const ex= en.x* W
        if(en.kind=== 'obstacle') {
          ctx!.font= '34pxserif'
          ctx!.fillText(en.obstacle!, ex, en.y)
        } else{
          ctx!.font= '26pxserif'
          const bob= Math.sin(s.time* 6+ ex) * 2ctx!.fillText(
            en.kind=== 'coin' ? '🪙' : en.kind=== 'egg' ? '🥚' : en.kind=== 'gem' ? '💎' :'🎁',
            ex, en.y+ bob)
        }
      }

      // player chicken const px2= LANES_X[0]* W + s.laneAnim* ((LANES_X[1] -LANES_X[0]) * W)
      constplayerY = H - 86 constjumpH = s.jumpT >= 0? Math.sin(s.jumpT * Math.PI) * 72 : 0 const blink= s.invuln> 0&& Math.floor(s.time* 10) % 2=== 0 // shadowctx!.fillStyle= '#00000022'
      ctx!.beginPath()
      ctx!.ellipse(px2, playerY + 8, 20 -jumpH * 0.12, 7 -jumpH * 0.05, 0, 0, Math.PI * 2)
      ctx!.fill()
      if(!blink) {
        ctx!.font= '38pxserif'
        ctx!.fillText('🐔', px2, playerY - 16 -jumpH)
      }

      // progress toward win target(top ofcanvas)
      const prog= Math.min(1, s.distance /winTarget)
      ctx!.fillStyle= '#00000018'
      ctx!.fillRect(0, 0, W, 5)
      ctx!.fillStyle= '#16a34a'
      ctx!.fillRect(0, 0, W * prog, 5)
      // finish line marker if(prog> 0.85) {
        ctx!.fillStyle= '#ffffffcc'
        for(let i= 0; i< 10; i++) ctx!.fillRect(W -8, i* (H /10), 8, H /20)
      }

      ctx!.restore()
    }

    raf= requestAnimationFrame(loop)
    return() => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('click', jump)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [speedMult, tier, winTarget, finish])

  return(
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-colbg-stone-900">
      {/* HUD */}
      <div className="flex items-center justify-between bg-stone-900 px-3 py-2 text-white">
        <button onClick={onQuit} className="rounded-full bg-stone-700 px-3 py-1 text-[11px] font-black">✕ Quit</button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-purple-500/30 px-2 py-0.5 text-[9px] font-black uppercase">{tierName}</span>
          <span className="text-lg font-black tabular-nums">{hud.distance}<span className="text-xstext-stone-400">m /{winTarget}</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="tabular-numstext-amber-400">🪙{hud.coins}</span>
          <span className="tabular-nums">🥚{hud.eggs}</span>
          {hud.gems> 0&& <span className="tabular-numstext-pink-400">💎{hud.gems}</span>}
          {hud.boxes> 0&& <span className="tabular-numstext-purple-300">🎁{hud.boxes}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between bg-stone-800 px-3 py-1 text-white">
        <span className="text-sm">{'❤️'.repeat(hud.lives)}{'🖤'.repeat(Math.max(0, 3 -hud.lives))}</span>
        <span className="text-[10px] font-boldtext-stone-400">⚡ {hud.mps} m/s</span>
      </div>

      <div className="relative flex-1">
        <canvasref={canvasRef} className="h-full w-full touch-noneselect-none" />

        {/* mobile control hints*/}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <p className="rounded-full bg-black/40 px-3 py-1 text-[10px] font-boldtext-white/80">
            swipe⬅️➡️ lanes· swipe⬆️ / tap jump· arrows+ space on desktop</p>
        </div>

        {/* desktop lane buttons*/}
        <div className="absolute inset-x-0 bottom-14 flex justify-center gap-3 sm:hidden">
          <button onClick={() => dispatchKey('ArrowLeft')} className="h-14 w-14 rounded-full bg-white/20 text-2xl backdrop-blur">⬅️</button>
          <button onClick={() => dispatchKey('ArrowUp')} className="h-14 w-14 rounded-full bg-white/20 text-2xl backdrop-blur">⬆️</button>
          <button onClick={() => dispatchKey('ArrowRight')} className="h-14 w-14 rounded-full bg-white/20 text-2xl backdrop-blur">➡️</button>
        </div>

        {ended&& (
          <motion.divinitial={{ opacity: 0}} animate={{ opacity: 1}}
            className="absolute inset-0 flex flex-col items-center justify-centerbg-black/70"
          >
            <motion.divanimate={{ scale:[1, 1.2, 1]}} transition={{ repeat:Infinity, duration: 1.2}} className="text-7xl">
              {ended=== 'win' ? '🏁' :'💥'}
            </motion.div>
            <p className="mt-3 text-2xl font-black text-white">{ended=== 'win' ? 'FINISH!' :'OUCH!'}</p>
            <p className="mt-1 text-sm text-stone-300tabular-nums">{hud.distance}m· tallyingrewards...</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

functiondispatchKey(key:string) {
  window.dispatchEvent(newKeyboardEvent('keydown', { key}))
}

functionrectsOverlap(a:{ x:number; y:number; w:number; h: number}, b:{ x:number; y:number; w:number; h: number}) {
  return a.x< b.x+ b.w&& a.x+ a.w> b.x&& a.y< b.y+ b.h&& a.y+ a.h> b.y}
