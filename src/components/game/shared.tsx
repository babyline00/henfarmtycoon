'useclient'

import{ cn} from'@/lib/utils'

export functionCoinPill({ value, size= 'md' }:{ value:number; size?:'sm' | 'md' }) {
  return(
    <div className={cn(
      'flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 font-boldtext-amber-800',
      size=== 'sm' ? 'px-2 py-0.5 text-xs' :'px-2.5 py-1 text-sm'
    )}>
      <span>🪙</span>
      <span className="tabular-nums">{value.toLocaleString()}</span>
    </div>
  )
}

export functionGemPill({ value, size= 'md' }:{ value:number; size?:'sm' | 'md' }) {
  return(
    <div className={cn(
      'flex items-center gap-1 rounded-full bg-pink-100 border border-pink-300 font-boldtext-pink-700',
      size=== 'sm' ? 'px-2 py-0.5 text-xs' :'px-2.5 py-1 text-sm'
    )}>
      <span>💎</span>
      <span className="tabular-nums">{value.toLocaleString()}</span>
    </div>
  )
}

export functionSectionTitle({ children, right}:{ children:React.ReactNode; right?:React.ReactNode}) {
  return(
    <div className="flex items-center justify-between mb-2 mt-4">
      <h2className="text-sm font-extrabold uppercase tracking-widetext-stone-500">{children}</h2>
      {right}
    </div>
  )
}

export functionProgressBar({ pct, label, className}:{ pct:number; label?:string; className?: string}) {
  const clamped= Math.min(100, Math.max(0, pct))
  return(
    <div className={cn('h-2 w-full rounded-full bg-stone-200  overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label?? 'Progress'}
      aria-valuetext={`${Math.round(clamped)}%`}
    >
      {/* scaleX on a full-width child instead of animating`width`: width is a layoutproperty, so every tick forced a reflow.This bar re-renders once a second on the farm and~8x/second in-game.*/}
      <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-lime-500 to-green-600 transition-transform duration-500 ease-outmotion-reduce:transition-none"
        style={{ transform:`scaleX(${clamped /100})` }}
      />
    </div>
  )
}

constrarityStyles:Record<string, string> = {
  Common:'bg-stone-100 text-stone-600border-stone-300',
  Rare:'bg-sky-50 text-sky-700border-sky-300',
  Epic:'bg-purple-50 text-purple-700border-purple-300',
  Legendary:'bg-amber-50 text-amber-700border-amber-400',
}

export functionRarityBadge({ rarity}:{ rarity: string}) {
  return(
    <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold', rarityStyles[rarity]?? rarityStyles.Common)}>
      {rarity}
    </span>
  )
}

export functionGameCard({
  children, className, onClick, expanded, label,
}:{
  children:React.ReactNodeclassName?: stringonClick?:() => voidexpanded?: booleanlabel?: string}) {
  //Was a<divonClick>, so the ticket list and any other expandable card // were completely unreachable by keyboard.Only opt into button // semantics when it is actually interactive. if(!onClick) {
    return(
      <div className={cn('rounded-2xl border border-stone-200/80 bg-white/95 p-3 shadow-smbackdrop-blur', className)}>
        {children}
      </div>
    )
  }
  return(
    <divrole="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={label}
      onClick={onClick}
      onKeyDown={e=> {
        if(e.key=== 'Enter' || e.key=== ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'cursor-pointer rounded-2xl border border-stone-200/80 bg-white/95 p-3 shadow-sm backdrop-blur transition-shadow hover:shadow-mdactive:scale-[0.99]',
        className)}
    >
      {children}
    </div>
  )
}

export functionEmptyState({ emoji, title, sub}:{ emoji:string; title:string; sub?: string}) {
  return(
    <div className="flex flex-col items-center justify-center py-10text-center">
      <div className="text-5xlopacity-60" aria-hidden="true">{emoji}</div>
      <p className="mt-3 font-boldtext-stone-600">{title}</p>
      {sub&& <p className="mt-1 text-xstext-stone-600">{sub}</p>}
    </div>
  )
}

export functionLoadingSpinner({ label= 'Loading...' }:{ label?: string}) {
  return(
    <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-200 border-t-green-600motion-reduce:animate-none" aria-hidden="true" />
      <p className="mt-3 text-smtext-stone-600">{label}</p>
    </div>
  )
}

export functionErrorState({
  title= 'Something wentwrong',
  message,
  onRetry,
}:{
  title?: stringmessage?: stringonRetry?:() => void}) {
  //An important failure must never be reduced to a silent toastor, worse,
  // an endless"Loading..." row.This is the terminal state for a failed // fetch and it always offers a way forward. return(
    <divrole="alert" className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-8text-center">
      <div className="text-4xl" aria-hidden="true">⚠️</div>
      <p className="mt-3 text-sm font-boldtext-red-900">{title}</p>
      {message&& <p className="mt-1 max-w-xs text-xstext-red-800">{message}</p>}
      {onRetry&& (
        <button onClick={onRetry}
          className="mt-4 min-h-11 rounded-xl border border-red-300 bg-white px-5 py-2 text-sm font-bold text-red-800 transition-colorshover:bg-red-100"
        >
          Try again</button>
      )}
    </div>
  )
}
