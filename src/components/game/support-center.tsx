'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, useGame } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GameCard, EmptyState, ErrorState, LoadingSpinner } from './shared'
import { cn } from '@/lib/utils'

// ══════════ Phase 25 — Customer Support Center (player side) ══════════

interface TicketRow {
  id: string
  subject: string
  category: string
  status: string
  assignedTo: string | null
  createdAt: string
  updatedAt: string
  lastMessage: { sender: string; body: string } | null
}
interface TicketMsg { id: string; sender: string; senderName: string; body: string; createdAt: string }
interface TicketFull {
  id: string
  subject: string
  category: string
  status: string
  assignedTo: string | null
  messages: TicketMsg[]
}

const FAQ = [
  { q: 'How do I earn coins faster?', a: 'Collect eggs daily, keep health at 100%, use feed buffs (+20–100%), hatch rare breeds and play arcade games in the 🎮 Games tab.' },
  { q: 'Why did my eggs stop producing?', a: 'Check farm health (feed your hens), the weather (storms −15%), and whether your hens are retired. A Scarecrow item blocks storm penalties.' },
  { q: 'How do withdrawals work?', a: 'Request a payout in Profile → Wallet (min shown there). Admins review within 24–48h; approved payouts deduct coins immediately.' },
  { q: 'My purchase did not arrive', a: 'Open a ticket with category "payment" and include the purchase method — support will verify and re-deliver.' },
  { q: 'Someone scammed me on the market', a: 'Open a "market" ticket with the listing title. Trades are all logged; staff can investigate and refund where rules were broken.' },
]

const CATS = [
  { key: 'bug', label: '🐞 Bug' },
  { key: 'account', label: '👤 Account' },
  { key: 'payment', label: '💳 Payment' },
  { key: 'market', label: '🏪 Market' },
  { key: 'other', label: '📄 Other' },
]

export function SupportCenter() {
  const { showFlash } = useGame()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [open, setOpen] = useState<TicketFull | null>(null)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('bug')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)

  const load = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await api<{ tickets: TicketRow[] }>('/api/support')
      setTickets(res.tickets)
      setLoadError(null)
    } catch (e) {
      // Swallowing this left the ticket list permanently empty, reading as
      // "you have no tickets" when the truth was "the request failed".
      setLoadError(e instanceof Error ? e.message : 'Could not load your tickets')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function openTicket(id: string) {
    try {
      const res = await api<{ ticket: TicketFull }>(`/api/support?ticketId=${id}`)
      setOpen(res.ticket)
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Failed to open ticket', 'error')
    }
  }

  async function createTicket() {
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/support', {
        method: 'POST', body: { action: 'create', subject, category, message },
      })
      showFlash(res.message)
      setCreating(false); setSubject(''); setMessage('')
      load()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Failed to create ticket', 'error')
    } finally { setBusy(false) }
  }

  async function sendReply() {
    if (!open || !reply.trim()) return
    setBusy(true)
    try {
      await api('/api/support', { method: 'POST', body: { action: 'reply', ticketId: open.id, message: reply } })
      setReply('')
      await openTicket(open.id)
      load()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Failed to send', 'error')
    } finally { setBusy(false) }
  }

  async function closeTicket() {
    if (!open) return
    try {
      const res = await api<{ message: string }>('/api/support', { method: 'POST', body: { action: 'close', ticketId: open.id } })
      showFlash(res.message)
      setOpen(null); load()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Failed', 'error')
    }
  }

  return (
    <div className="space-y-2">
      {/* new ticket */}
      <GameCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-stone-800">🎫 Support Center</p>
            <p className="text-[11px] text-stone-500">Stuck? Lost items? Our farm staff replies within 24h.</p>
          </div>
          <Button size="sm" onClick={() => setCreating(v => !v)} className="h-8 rounded-full bg-green-700 px-3 text-xs font-extrabold text-white">
            {creating ? 'Close' : '+ Ticket'}
          </Button>
        </div>

        {creating && (
          <div className="mt-3 space-y-2">
            <div>
              <Label htmlFor="sc-cat" className="text-[10px] font-bold text-stone-500">Category</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {CATS.map(c => (
                  <button key={c.key} onClick={() => setCategory(c.key)} aria-pressed={category === c.key}
                    className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold',
                      category === c.key ? 'border-green-500 bg-green-50 text-green-700' : 'border-stone-200 text-stone-600')}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="sc-subject" className="text-[10px] font-bold text-stone-500">Subject</Label>
              <Input id="sc-subject" value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 h-9 rounded-lg bg-stone-50" placeholder="Short summary e.g. Missing golden egg" />
            </div>
            <div>
              <Label htmlFor="sc-message" className="text-[10px] font-bold text-stone-500">Describe the issue</Label>
              <textarea id="sc-message" value={message} onChange={e => setMessage(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-lg border border-stone-200 bg-stone-50 p-2 text-xs"
                placeholder="What happened? When did it start? Include any error messages…"
              />
            </div>
            <Button onClick={createTicket} disabled={busy || subject.length < 5 || message.length < 10}
              className="h-10 w-full rounded-xl bg-green-700 font-extrabold text-white">
              Submit Ticket 🎫
            </Button>
          </div>
        )}
      </GameCard>

      {/* my tickets */}
      {loadError ? (
        <GameCard>
          <ErrorState title="Couldn't load your tickets" message={loadError} onRetry={() => { load() }} />
        </GameCard>
      ) : loadingList && tickets.length === 0 ? (
        <GameCard><LoadingSpinner label="Loading tickets…" /></GameCard>
      ) : tickets.length === 0 ? (
        <GameCard><EmptyState emoji="📭" title="No tickets yet" sub="Anything broken or confusing — open a ticket above" /></GameCard>
      ) : (
        tickets.map(t => (
          <GameCard key={t.id} className="cursor-pointer py-2.5" onClick={() => openTicket(t.id)} label={`Open ticket: ${t.subject}`}>
            <div className="flex items-center gap-2">
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                t.status === 'open' ? 'bg-amber-100 text-amber-700'
                  : t.status === 'answered' ? 'bg-green-100 text-green-700'
                  : 'bg-stone-200 text-stone-500'
              )}>
                {t.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-stone-700">{t.subject}</p>
                <p className="truncate text-[10px] text-stone-600">
                  {t.lastMessage ? `${t.lastMessage.sender === 'staff' ? '💬 Staff' : 'You'}: ${t.lastMessage.body}` : '—'}
                </p>
              </div>
              <span className="text-[9px] text-stone-600">{new Date(t.updatedAt).toLocaleDateString()}</span>
            </div>
          </GameCard>
        ))
      )}

      {/* FAQ */}
      <GameCard>
        <p className="text-sm font-black text-stone-800">❓ FAQ</p>
        <div className="mt-1 divide-y divide-stone-100">
          {FAQ.map((f, i) => (
            <div key={i} className="py-1">
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                aria-expanded={faqOpen === i}
                className="flex w-full items-center justify-between py-1 text-left"
              >
                <span className="text-[11px] font-bold text-stone-600">{f.q}</span>
                <span className="text-[10px] text-stone-600" aria-hidden="true">{faqOpen === i ? '▲' : '▼'}</span>
              </button>
              {faqOpen === i && <p className="pb-1 text-[11px] leading-snug text-stone-500">{f.a}</p>}
            </div>
          ))}
        </div>
      </GameCard>

      {/* ticket thread modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Ticket: ${open.subject}`}
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 sm:rounded-3xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-black text-stone-800">{open.subject}</p>
                <p className="text-[10px] text-stone-600">
                  {CATS.find(c => c.key === open.category)?.label} · {open.status}
                  {open.assignedTo ? ` · handled by ${open.assignedTo}` : ''}
                </p>
              </div>
              <button onClick={() => setOpen(null)} aria-label="Close ticket" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-600">✕</button>
            </div>

            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-2" data-scrollable role="log" tabIndex={0} aria-label="Ticket messages">
              {open.messages.map(m => (
                <div key={m.id} className={cn('flex', m.sender === 'staff' ? 'justify-start' : 'justify-end')}>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-[11px]',
                    m.sender === 'staff' ? 'bg-green-100 text-stone-700' : 'bg-stone-200 text-stone-700'
                  )}>
                    <p className="mb-0.5 text-[9px] font-black uppercase text-stone-600">
                      {m.sender === 'staff' ? `🛡️ ${m.senderName}` : m.senderName}
                    </p>
                    {m.body}
                    <p className="mt-1 text-[8px] text-stone-600">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            {open.status !== 'closed' ? (
              <>
                <div className="mt-2 flex gap-2">
                  <Input value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply…"
                    aria-label="Write a reply"
                    className="h-10 flex-1 rounded-xl bg-stone-50 text-xs"
                    onKeyDown={e => { if (e.key === 'Enter') sendReply() }} />
                  <Button onClick={sendReply} disabled={busy || !reply.trim()} className="h-10 rounded-xl bg-green-700 px-4 text-xs font-extrabold text-white">Send</Button>
                </div>
                <Button variant="outline" onClick={closeTicket} className="mt-2 h-9 w-full rounded-xl text-[11px] font-bold text-stone-500">
                  Close ticket (issue resolved)
                </Button>
              </>
            ) : (
              <p className="mt-2 rounded-xl bg-stone-100 p-2 text-center text-[11px] font-bold text-stone-600">This ticket is closed</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
