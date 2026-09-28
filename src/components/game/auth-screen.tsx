'useclient'

import{ useState} from'react'
import{ motion} from'framer-motion'
import{ useGame} from'@/lib/store'
import{ Button} from'@/components/ui/button'
import{ Input} from'@/components/ui/input'
import{ Label} from'@/components/ui/label'

export functionAuthScreen() {
  const{ authScreen, setAuthScreen, login, register, loading, showFlash} = useGame()
  const[username, setUsername]= useState('')
  const[password, setPassword]= useState('')
  const[farmName, setFarmName]= useState('')
  const[referralCode, setReferralCode]= useState('')

  constisLogin= authScreen=== 'login'

  async functionhandleSubmit(e:React.FormEvent) {
    e.preventDefault()
    try{
      if(isLogin) awaitlogin(username, password)
      else awaitregister(username, password, farmName, referralCode)
    } catch(err) {
      showFlash(err instanceofError? err.message :'Failed', 'error')
    }
  }

  functionfillDemo(kind:'player' | 'admin') {
    setUsername(kind=== 'admin' ? 'admin' :'demo')
    setPassword(kind=== 'admin' ? 'admin123' :'demo123')
  }

  return(
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-sky-50 via-lime-50 to-amber-50px-5">
      {/* decorative field*/}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-green-200/70to-transparent" />
      <div className="pointer-events-none absolute bottom-6 left-6 text-5xlopacity-70">🌾</div>
      <div className="pointer-events-none absolute bottom-10 right-8 text-4xlopacity-60">🌻</div>
      <div className="pointer-events-none absolute bottom-16 left-1/3 text-3xlopacity-50">🌿</div>

      <motion.divinitial={{ y:-12, opacity: 0}}
        animate={{ y:0, opacity: 1}}
        className="relative z-10 flex w-full max-w-sm flex-colitems-center"
      >
        <motion.divanimate={{ rotate:[0, -8, 8, 0]}}
          transition={{ repeat:Infinity, duration:2.4, ease:'easeInOut' }}
          className="text-7xldrop-shadow-lg"
        >
          🐔
        </motion.div>
        <h1className="mt-2 text-3xl font-black tracking-tighttext-stone-800">
          HenFarm<span className="text-green-600">Tycoon</span>
        </h1>
        <p className="mt-1 text-center text-smtext-stone-500">
          Build your coop· Hatch rare hens· Get rich🥚💰
        </p>

        <div className="mt-6 w-full rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-xlbackdrop-blur">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-stone-100  p-1">
            <buttontype="button"
              onClick={() => setAuthScreen('login')}
              className={`rounded-lg py-2 text-sm font-bold transition-all${isLogin? 'bg-white text-green-700shadow' :'text-stone-500'}`}
            >
              Login</button>
            <buttontype="button"
              onClick={() => setAuthScreen('register')}
              className={`rounded-lg py-2 text-sm font-bold transition-all${!isLogin? 'bg-white text-green-700shadow' :'text-stone-500'}`}
            >
              CreateFarm</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="username" className="text-xs font-boldtext-stone-500">FarmerID</Label>
              <Inputid="username"
                value={username}
                onChange={e=> setUsername(e.target.value)}
                placeholder="e.g.farmer_joe"
                className="mt-1 h-11 rounded-xl border-stone-200bg-stone-50"
                autoComplete="username"
                required/>
            </div>

            {!isLogin&& (
              <div>
                <Label htmlFor="farmName" className="text-xs font-boldtext-stone-500">FarmName</Label>
                <Inputid="farmName"
                  value={farmName}
                  onChange={e=> setFarmName(e.target.value)}
                  placeholder="e.g.SunnyMeadows"
                  className="mt-1 h-11 rounded-xl border-stone-200bg-stone-50"
                  required/>
              </div>
            )}

            <div>
              <Label htmlFor="password" className="text-xs font-boldtext-stone-500">Password</Label>
              <Inputid="password"
                type="password"
                value={password}
                onChange={e=> setPassword(e.target.value)}
                placeholder="••••••"
                className="mt-1 h-11 rounded-xl border-stone-200bg-stone-50"
                autoComplete={isLogin? 'current-password' :'new-password'}
                required/>
            </div>

            {!isLogin&& (
              <div>
                <Label htmlFor="ref" className="text-xs font-boldtext-stone-500">
                  ReferralCode<span className="font-normaltext-stone-600">(optional— +200 coinseach!)</span>
                </Label>
                <Inputid="ref"
                  value={referralCode}
                  onChange={e=> setReferralCode(e.target.value.toUpperCase())}
                  placeholder="e.g.DEMO2026"
                  className="mt-1 h-11 rounded-xl border-stone-200 bg-stone-50  uppercase"
                />
              </div>
            )}

            <Buttontype="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-green-600 to-lime-600 text-base font-extrabold text-white shadow-lg transition-transform active:scale-[0.98]disabled:opacity-60"
            >
              {loading? 'Pleasewait...' :isLogin? '🚜 EnterFarm' :'🌱 StartMyFarm'}
            </Button>
          </form>

          {isLogin&& (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3text-center">
              <p className="text-[11px] font-boldtext-amber-700">🎮 DEMO ACCOUNTS</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => fillDemo('player')}
                  className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-bold text-amber-800hover:bg-amber-100"
                >
                  👨‍🌾 Player<br/><span className="font-normal">demo /demo123</span>
                </button>
                <button onClick={() => fillDemo('admin')}
                  className="flex-1 rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-bold text-red-700hover:bg-red-50"
                >
                  🛡️ SuperAdmin<br/><span className="font-normal">admin /admin123</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px]text-stone-600">
          Join thousands of farmers· Daily rewards· Events· Leaderboard🏆
        </p>
      </motion.div>
    </div>
  )
}
