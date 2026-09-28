'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function AuthScreen() {
  const { authScreen, setAuthScreen, login, register, loading, showFlash } = useGame()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [farmName, setFarmName] = useState('')
  const [referralCode, setReferralCode] = useState('')

  const isLogin = authScreen === 'login'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (isLogin) await login(username, password)
      else await register(username, password, farmName, referralCode)
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Something went wrong', 'error')
    }
  }

  function fillDemo(kind: 'player' | 'admin') {
    setUsername(kind === 'admin' ? 'admin' : 'demo')
    setPassword(kind === 'admin' ? 'admin123' : 'demo123')
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
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="tablist" aria-label="Login or create an account">
            <button type="button"
              role="tab"
              aria-selected={isLogin}
              onClick={() => setAuthScreen('login')}
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
              onClick={() => setAuthScreen('register')}
              className={cn(
                'min-h-9 rounded-lg py-2 text-sm font-bold transition-all',
                !isLogin ? 'bg-white text-green-700 shadow' : 'text-stone-600',
              )}
            >
              Create farm
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="username" className="text-xs font-bold text-stone-600">Farmer ID</Label>
              <Input id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. farmer_joe"
                autoComplete="username"
                required
                className="mt-1 h-11 rounded-xl border-stone-200 bg-stone-50"
              />
            </div>

            {!isLogin && (
              <div>
                <Label htmlFor="farmName" className="text-xs font-bold text-stone-600">Farm name</Label>
                <Input id="farmName"
                  value={farmName}
                  onChange={e => setFarmName(e.target.value)}
                  placeholder="e.g. Sunny Meadows"
                  required
                  className="mt-1 h-11 rounded-xl border-stone-200 bg-stone-50"
                />
              </div>
            )}

            <div>
              <Label htmlFor="password" className="text-xs font-bold text-stone-600">Password</Label>
              <Input id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                className="mt-1 h-11 rounded-xl border-stone-200 bg-stone-50"
              />
            </div>

            {!isLogin && (
              <div>
                <Label htmlFor="ref" className="text-xs font-bold text-stone-600">
                  Referral code<span className="font-normal text-stone-600"> (optional — +200 coins each!)</span>
                </Label>
                <Input id="ref"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DEMO2026"
                  className="mt-1 h-11 rounded-xl border-stone-200 bg-stone-50 uppercase"
                />
              </div>
            )}

            <Button type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-green-700 to-lime-600 text-base font-extrabold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Please wait…' : isLogin ? '🚜 Enter farm' : '🌱 Start my farm'}
            </Button>
          </form>

          {isLogin && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-[11px] font-bold text-amber-700">🎮 Demo accounts</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => fillDemo('player')}
                  aria-label="Fill the form with the demo player credentials"
                  className="min-h-9 flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                >
                  👨‍🌾 Player<br /><span className="font-normal">demo / demo123</span>
                </button>
                <button onClick={() => fillDemo('admin')}
                  aria-label="Fill the form with the Super Admin demo credentials"
                  className="min-h-9 flex-1 rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                >
                  🛡️ SuperAdmin<br /><span className="font-normal">admin / admin123</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-stone-600">
          Join thousands of farmers · Daily rewards · Events · Leaderboard 🏆
        </p>
      </motion.div>
    </div>
  )
}
