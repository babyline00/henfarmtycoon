'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Sign in / create account.
 *
 * The error handling here used to be a `showFlash()` call, and that was
 * broken: the flash toast is rendered *inside* the authenticated app shell,
 * and this screen is an early return that happens before it. So every
 * wrong password, every taken username, every offline failure produced
 * no visible feedback whatsoever — the button simply did nothing.
 *
 * Errors are therefore rendered here, inline and persistent:
 *  • next to the form, not in a toast that vanishes after a few seconds
 *  • role="alert", so a screen reader announces it immediately
 *  • cleared as soon as the player edits the field, so it never becomes
 *    stale advice sitting above a form they have already corrected
 *  • the fields keep their values, so a typo in the password does not
 *    cost them their username
 *
 * Validation runs client-side first purely to avoid a pointless round
 * trip; the server remains the authority and its message is what is shown.
 */
export function AuthScreen() {
  const { authScreen, setAuthScreen, login, register, loading } = useGame()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [farmName, setFarmName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  /** Bumped per failed submit so an identical message still re-announces. */
  const [attempt, setAttempt] = useState(0)
  const [showPw, setShowPw] = useState(false)

  const isLogin = authScreen === 'login'
  const mode = isLogin ? 'login' : 'register'

  /** Clear the error as soon as the player starts fixing it. */
  function edit(setter: (v: string) => void) {
    return (v: string) => { setter(v); if (error) setError(null) }
  }

  function localProblem(): string | null {
    if (!username.trim()) return 'Enter your username'
    if (!password) return 'Enter your password'
    if (!isLogin) {
      if (!farmName.trim()) return 'Give your farm a name'
      // Mirrors the server policy so the player learns it before the round
      // trip, not after it.
      if (password.length < 8) return 'Password must be at least 8 characters'
      const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length
      if (classes < 2) return 'Mix letters, numbers or symbols in your password'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    const problem = localProblem()
    if (problem) { setError(problem); return }
    setError(null)
    try {
      if (isLogin) await login(username.trim(), password)
      else await register(username.trim(), password, farmName.trim(), referralCode.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      // Re-keying the alert forces a screen reader to announce it again
      // when a player submits the same wrong password twice, which setting
      // an identical string would not.
      setAttempt(n => n + 1)
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-sky-50 via-lime-50 to-amber-50 px-5 py-10">
      {/* decorative field */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-green-200/70 to-transparent" />
      <div className="pointer-events-none absolute bottom-6 left-6 text-5xl opacity-70" aria-hidden="true">🌾</div>
      <div className="pointer-events-none absolute bottom-10 right-8 text-4xl opacity-60" aria-hidden="true">🌻</div>
      <div className="pointer-events-none absolute bottom-16 left-1/3 text-3xl opacity-50" aria-hidden="true">🌿</div>

      <motion.div initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center"
      >
        <motion.div animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
          className="text-7xl drop-shadow-lg"
        >
          <span aria-hidden="true">🐔</span>
        </motion.div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-800">
          HenFarm<span className="text-green-700">Tycoon</span>
        </h1>
        <p className="mt-1 text-center text-sm text-stone-600">
          Build your coop · Hatch rare hens · Get rich 🥚💰
        </p>

        <div className="mt-6 w-full rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-xl backdrop-blur">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="tablist" aria-label="Sign in or create an account">
            <button type="button"
              role="tab"
              aria-selected={isLogin}
              onClick={() => { setAuthScreen('login'); setError(null) }}
              className={cn(
                'min-h-9 rounded-lg py-2 text-sm font-bold transition-all',
                isLogin ? 'bg-white text-green-700 shadow' : 'text-stone-600',
              )}
            >
              Login
            </button>
            <button type="button"
              role="tab"
              aria-selected={!isLogin}
              onClick={() => { setAuthScreen('register'); setError(null) }}
              className={cn(
                'min-h-9 rounded-lg py-2 text-sm font-bold transition-all',
                !isLogin ? 'bg-white text-green-700 shadow' : 'text-stone-600',
              )}
            >
              Create farm
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            {/*
              aria-live rather than role=alert: this appears in response to
              an action, and role=alert would interrupt whatever the screen
              reader was mid-sentence on. assertive is still the right
              urgency for a failed sign-in.
            */}
            <p
              key={attempt}
              role="alert"
              aria-live="assertive"
              className={cn(
                'rounded-xl px-3 py-2 text-[11px] font-bold',
                error ? 'block border border-red-300 bg-red-50 text-red-800' : 'sr-only',
              )}
            >
              {error ?? ''}
            </p>

            <div>
              <Label htmlFor="username" className="text-xs font-bold text-stone-600">Farmer ID</Label>
              <Input id="username"
                value={username}
                onChange={e => edit(setUsername)(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                aria-invalid={!!error && !username.trim()}
                placeholder="letters, numbers and _"
                className="mt-1 h-11 rounded-xl border-stone-200 bg-stone-50"
              />
            </div>

            {!isLogin && (
              <div>
                <Label htmlFor="farmName" className="text-xs font-bold text-stone-600">Farm name</Label>
                <Input id="farmName"
                  value={farmName}
                  onChange={e => edit(setFarmName)(e.target.value)}
                  placeholder="e.g. Sunny Meadows"
                  required
                  className="mt-1 h-11 rounded-xl border-stone-200 bg-stone-50"
                />
              </div>
            )}

            <div>
              <Label htmlFor="password" className="text-xs font-bold text-stone-600">Password</Label>
              <div className="relative mt-1">
                <Input id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => edit(setPassword)(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  className="h-11 rounded-xl border-stone-200 bg-stone-50 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  aria-pressed={showPw}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black text-stone-500 hover:bg-stone-100"
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <Label htmlFor="ref" className="text-xs font-bold text-stone-600">
                  Referral code<span className="font-normal text-stone-600"> (optional — +200 coins each!)</span>
                </Label>
                <Input id="ref"
                  value={referralCode}
                  onChange={e => edit(setReferralCode)(e.target.value.toUpperCase())}
                  placeholder="e.g. FARM2026"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="mt-1 h-11 rounded-xl border-stone-200 bg-stone-50 uppercase"
                />
              </div>
            )}

            <Button type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-green-700 to-lime-600 text-base font-extrabold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {loading
                ? (isLogin ? 'Opening the gate…' : 'Planting your first seeds…')
                : (isLogin ? '🚜 Enter farm' : '🌱 Start my farm')}
            </Button>
          </form>

          {isLogin && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] font-bold text-amber-800">
              🔒 Staff access is for administrators. Players sign in with the
              account they created when they started their farm.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-stone-600">
          Join thousands of farmers · Daily rewards · Events · Leaderboard 🏆
        </p>
      </motion.div>
    </div>
  )
}
