'useclient'

import{ useCallback, useEffect, useRef, useState} from'react'
import{ AnimatePresence, motion} from'framer-motion'
import{ api} from'@/lib/store'
import{ cn} from'@/lib/utils'

//══════════ Phase 27— AI FarmAssistant(floatingwidget) ══════════

interfaceAdvice{
  icon:string; title:string; detail: string priority:number; tag:'urgent' | 'tip' | 'growth' | 'economy'
}
interfaceProjection{ activeHens:number; estEggsPerDay:number; health:number; energy: number}

constTAG_STYLES:Record<string, string> = {
  urgent:'bg-red-100 text-red-800border-red-200',
  tip:'bg-amber-50 text-amber-700border-amber-200',
  growth:'bg-green-50 text-green-700border-green-200',
  economy:'bg-purple-50 text-purple-700border-purple-200',
}

constSUGGESTIONS = ['How doI earn morecoins?', 'What shouldI do with myeggs?', 'Is my farmhealthy?', 'How doesVIP work?', 'Any upgradeadvice?'] export functionAiAssistant() {
  const[open, setOpen]= useState(false)
  const[recs, setRecs]= useState<Advice[]>([])
  const[projection, setProjection]= useState<Projection| null>(null)
  const[chat, setChat]= useState<{ role:'user' | 'ai'; text: string}[]>([])
  const[q, setQ]= useState('')
  const[thinking, setThinking]= useState(false)
  const[loaded, setLoaded]= useState(false)
  constchatEndRef= useRef<HTMLDivElement>(null)

  const load= useCallback(async() => {
    try{
      const res= awaitapi<{ recommendations:Advice[]; projection:Projection}>('/api/ai/advisor')
      setRecs(res.recommendations)
      setProjection(res.projection)
      setLoaded(true)
    } catch{ /* silent*/}
  }, [])

  useEffect(() => {
    if(open&& !loaded) load()
  }, [open, loaded, load])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [chat, thinking])

  async functionask(question:string) {
    if(!question.trim() || thinking) returnsetChat(c=> [...c, { role:'user', text: question}])
    setQ('')
    setThinking(true)
    try{
      const res= awaitapi<{ answer: string}>('/api/ai/advisor', { method:'POST', body:{ question} })
      setChat(c=> [...c, { role:'ai', text: res.answer}])
    } catch{
      setChat(c=> [...c, { role:'ai', text:'⚠️ Connection to the coop brain failed.Tryagain!' }])
    } finally{ setThinking(false) }
  }

  consturgentCount= recs.filter(r=> r.tag=== 'urgent').length return(
    <>
      {/* floating button*/}
      <motion.button onClick={() => setOpen(v=> !v)}
        whileTap={{ scale: 0.9}}
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-200 bg-white text-2xlshadow-xl"
        aria-label="AI FarmAssistant"
      >
        🤖
        {urgentCount> 0&& !open&& (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1 text-[10px] font-black text-white">
            {urgentCount}
          </span>
        )}
      </motion.button>

      {/* panel*/}
      <AnimatePresence>
        {open&& (
          <motion.divinitial={{ opacity:0, y:24, scale: 0.96}}
            animate={{ opacity:1, y:0, scale: 1}}
            exit={{ opacity:0, y:24, scale: 0.96}}
            className="fixed bottom-38 right-3 z-50 flex max-h-[65dvh]w-[calc(100%_-_24px)] max-w-sm flex-col overflow-hidden rounded-3xl border border-stone-200 bg-whiteshadow-2xl"
          >
            {/* header*/}
            <div className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
              <span className="text-2xl">🤖</span>
              <div className="flex-1">
                <p className="text-sm font-black text-white">AI FarmAssistant</p>
                <p className="text-[10px]text-green-100">
                  {projection? `🐔 ${projection.activeHens} hens· ~${projection.estEggsPerDay} eggs/day· ❤️ ${projection.health}% · ⚡ ${projection.energy}`
                    :'Analyzing yourfarm...'}
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close farmassistant" className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-white/80 transition-colorshover:bg-white/10">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {/* recommendations*/}
              {loaded&& recs.length> 0&& (
                <div className="space-y-2">
                  {recs.map((r, i) => (
                    <divkey={i} className={cn('rounded-2xl borderp-2.5', TAG_STYLES[r.tag])}>
                      <p className="text-[11px] font-black">{r.icon} {r.title}</p>
                      <p className="mt-0.5 text-[10px] leading-snugtext-stone-500">{r.detail}</p>
                    </div>
                  ))}
                </div>
              )}
              {loaded&& recs.length=== 0&& (
                <div className="rounded-2xl bg-green-50 p-3text-center">
                  <p className="text-2xl">✅</p>
                  <p className="mt-1 text-[11px] font-boldtext-green-700">Everything looksgreat! Your farm is runningoptimally.</p>
                </div>
              )}

              {/* chat thread*/}
              {chat.length> 0&& (
                <div className="mt-3 space-y-2 border-t border-stone-100pt-3">
                  {chat.map((m, i) => (
                    <divkey={i} className={cn('flex', m.role=== 'user' ? 'justify-end' :'justify-start')}>
                      <div className={cn(
                        'max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-snug',
                        m.role=== 'user' ? 'bg-green-700  text-white' :'bg-stone-100  text-stone-700'
                      )}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {thinking&& (
                    <div className="flex items-center gap-1 px-2text-stone-600">
                      <motion.spananimate={{ opacity:[0.3, 1, 0.3]}} transition={{ repeat:Infinity, duration: 1}} className="text-xs">🤖 thinking</motion.span>
                    </div>
                  )}
                  <divref={chatEndRef} />
                </div>
              )}
            </div>

            {/* suggestions+ input*/}
            <div className="border-t border-stone-100 bg-stone-50  p-2">
              {chat.length=== 0&& (
                <div className="mb-2 flex flex-wrapgap-1">
                  {SUGGESTIONS.map(s=> (
                    <buttonkey={s} onClick={() => ask(s)}
                      className="rounded-full border border-green-200 bg-white px-2 py-1 text-[10px] font-boldtext-green-700">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <inputvalue={q} onChange={e=> setQ(e.target.value)}
                  onKeyDown={e=> { if(e.key=== 'Enter') ask(q) }}
                  placeholder="Ask about yourfarm..."
                  className="h-10 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-xs"
                />
                <button onClick={() => ask(q)} disabled={thinking|| !q.trim()}
                  className="h-10 rounded-xl bg-green-700 px-4 text-xs font-extrabold text-white  disabled:opacity-40">
                  Ask</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
