'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function CoinPill({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  return (
    <div className={cn(
      'flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 font-bold text-amber-800',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
    )}>
      <span aria-hidden="true">🪙</span>
      <span className="tabular-nums">{value.toLocaleString()}</span>
    </div>
  )
}

export function GemPill({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  return (
    <div className={cn(
      'flex items-center gap-1 rounded-full border border-pink-300 bg-pink-100 font-bold text-pink-700',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
    )}>
      <span aria-hidden="true">💎</span>
      <span className="tabular-nums">{value.toLocaleString()}</span>
    </div>
  )
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center justify-between">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-stone-500">{children}</h2>
      {right}
    </div>
  )
}

export function ProgressBar({ pct, label, className }: { pct: number; label?: string; className?: string }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-stone-200', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      aria-valuetext={`${Math.round(clamped)}%`}
    >
      {/* scaleX on a full-width child instead of animating `width`: width is a
          layout property, so every tick forced a reflow. This bar re-renders
          once a second on the farm and ~8x/second in-game. */}
      <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-lime-500 to-green-600 transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  )
}

const rarityStyles: Record<string, string> = {
  Common: 'bg-stone-100 text-stone-600 border-stone-300',
  Rare: 'bg-sky-50 text-sky-700 border-sky-300',
  Epic: 'bg-purple-50 text-purple-700 border-purple-300',
  Legendary: 'bg-amber-50 text-amber-700 border-amber-400',
}

export function RarityBadge({ rarity }: { rarity: string }) {
  return (
    <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold', rarityStyles[rarity] ?? rarityStyles.Common)}>
      {rarity}
    </span>
  )
}

export function GameCard({
  children, className, onClick, expanded, label,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  expanded?: boolean
  label?: string
}) {
  // Was a <div onClick>, so the ticket list and any other expandable card
  // were completely unreachable by keyboard. Only opt into button
  // semantics when it is actually interactive.
  if (!onClick) {
    return (
      <div className={cn('rounded-2xl border border-stone-200/80 bg-white/95 p-3 shadow-sm backdrop-blur', className)}>
        {children}
      </div>
    )
  }
  return (
    <div role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={label}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'cursor-pointer rounded-2xl border border-stone-200/80 bg-white/95 p-3 shadow-sm backdrop-blur transition-shadow hover:shadow-md active:scale-[0.99]',
        className)}
    >
      {children}
    </div>
  )
}

export function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-5xl opacity-60" aria-hidden="true">{emoji}</div>
      <p className="mt-3 font-bold text-stone-600">{title}</p>
      {sub && <p className="mt-1 text-xs text-stone-600">{sub}</p>}
    </div>
  )
}

export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-200 border-t-green-600 motion-reduce:animate-none" aria-hidden="true" />
      <p className="mt-3 text-sm text-stone-600">{label}</p>
    </div>
  )
}

/**
 * A long list, capped to `visible` rows with the rest behind a scrollbar.
 *
 * Leaderboards, history and alerts all had the same defect: they rendered
 * every row, so the page grew without bound. A leaderboard with 400 scores
 * pushed every other control off the screen, and transaction history could
 * run to thousands of rows. The fix is not "show 5 and hide the rest" —
 * that throws away data the player earned. It is a viewport: five rows
 * visible, everything else one scroll away.
 *
 * Two details that are easy to get wrong and that this handles once:
 *
 * 1. A scroll container is not reachable by keyboard unless it is
 *    focusable, so it gets `tabIndex={0}` and a label. But making *every*
 *    list focusable is just as bad — a list of three rows becomes a tab
 *    stop that scrolls nowhere. So focusability is decided by measuring
 *    whether the content actually overflows, and it is re-measured when
 *    the list or the window changes size.
 * 2. Scroll chaining. When the list reaches its end, the page behind it
 *    must keep scrolling — that is what `overscroll-contain` stops. On
 *    touch it is the difference between the list feeling like a viewport
 *    and feeling like a trap.
 */
export function ScrollList({
  children,
  count,
  label,
  visible = 5,
  rowHeight = 46,
  className,
}: {
  children: React.ReactNode
  /** Total number of rows. Drives the overflow check and the "showing N" hint. */
  count: number
  /** Accessible name for the scrolling region. */
  label: string
  /** Rows visible before scrolling. */
  visible?: number
  /** Approximate row height in px, used to size the viewport. */
  rowHeight?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setOverflows(el.scrollHeight - el.clientHeight > 1)
    measure()
    // A list that only scrolls after a late-loading child arrives (an
    // avatar, a badge) would otherwise keep the wrong focusability.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [count, children])

  useEffect(() => {
    const onWinResize = () => {
      const el = ref.current
      if (el) setOverflows(el.scrollHeight - el.clientHeight > 1)
    }
    window.addEventListener('resize', onWinResize)
    return () => window.removeEventListener('resize', onWinResize)
  }, [])

  return (
    <div className={className}>
      <div
        ref={ref}
        data-scrollable
        tabIndex={overflows ? 0 : -1}
        role={overflows ? 'group' : undefined}
        aria-label={overflows ? label : undefined}
        className={cn(
          'scroll-slim space-y-1.5 pr-0.5',
          // overflow-y-auto is load-bearing, not decoration: max-height on
          // its own silently *clips* the overflow, which is the one
          // outcome this component exists to avoid — rows 6+ would be
          // unreachable rather than scrollable.
          'overflow-y-auto',
          overflows && 'overscroll-contain',
        )}
        style={{ maxHeight: visible * rowHeight }}
      >
        {children}
      </div>
      {overflows && (
        <p className="mt-1.5 text-center text-[9px] font-bold text-stone-500">
          Showing {visible} of {count} — scroll for more
        </p>
      )}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  // An important failure must never be reduced to a silent toast or, worse,
  // an endless "Loading..." row. This is the terminal state for a failed
  // fetch and it always offers a way forward.
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center">
      <div className="text-4xl" aria-hidden="true">⚠️</div>
      <p className="mt-3 text-sm font-bold text-red-900">{title}</p>
      {message && <p className="mt-1 max-w-xs text-xs text-red-800">{message}</p>}
      {onRetry && (
        <button onClick={onRetry}
          className="mt-4 min-h-11 rounded-xl border border-red-300 bg-white px-5 py-2 text-sm font-bold text-red-800 transition-colors hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  )
}
