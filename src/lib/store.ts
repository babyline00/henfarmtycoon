'use client'

import { create } from 'zustand'
import { play, unlockAudio } from './sfx'
import { soundForAction, soundForHatchResult } from './game-sounds'

// ── types (mirror of server payload) ─────────────────────────

export interface HenView {
  id: string; type: string; name: string; level: number
  ageDays: number; lifespan: number; status: 'active' | 'retired'
  emoji: string; rarity: string; pendingEggs: number; ratePerHour: number
  stage: string; stageName: string; stageEmoji: string
  traits: string[]; generation: number
  breedCooldownUntil: string | null
}
export interface ItemView {
  key: string; name: string; emoji: string; kind: string
  desc: string; qty: number; usable: boolean
}
export interface AnimalView {
  id: string; type: string; name: string; emoji: string
  effect: string; effectValue: number; passive: boolean
  pendingCoins: number; ageDays: number
}
export interface MissionView {
  key: string; title: string; desc: string; emoji: string
  target: number; rewardCoins: number; rewardGems: number; rewardXp: number
  progress: number; claimed: boolean; complete: boolean
}
export interface GameState {
  user: {
    id: string; username: string; farmName: string; avatar: string
    coins: number; gems: number; xp: number
    levelIdx: number; levelName: string; nextXp: number | null; levelProgress: number
    isAdmin: boolean; adminRole: string | null; referralCode: string; loginStreak: number
    canClaimDaily: boolean; dailyReward: number; dailyRewardDay: number
    createdAt: string
    numericLevel: number; numericLevelPct: number; numericLevelNextXp: number
    levelRewards: { level: number; coins: number; gems: number; unlock: string | null; reached: boolean; claimed: boolean }[]
    claimableLevelRewards: number
    vip: { plan: string | null; name: string; until: string; canClaimGems: boolean; dailyGems: number } | null
    flagged: boolean
  }
  farm: {
    coopLevel: number; coopCap: number; landLevel: number; landCap: number
    storageLevel: number; storageCap: number
    incubatorLevel: number; incubatorCap: number
    feedFactoryLevel: number
    shelterLevel: number; shelterCap: number; shelterBonus: number
    lastFedAt: string | null; health: number
    buffType: string | null; buffExpiresAt: string | null
    xpBuffUntil: string | null
    totalEggsHatch: number; totalEarned: number; productionMult: number
    weather: { key: string; name: string; emoji: string; pct: number; desc: string }
  }
  hens: HenView[]
  animals: AnimalView[]
  eggInventory: Record<string, number>
  incubators: { id: string; type: string; hatchAt: string; ready: boolean }[]
  missions: MissionView[]
  event: { name: string; description: string; multiplier: number; endsAt: string } | null
  config: { withdrawalMin: number; gemToCoins: number; marketFeePct: number; maintenanceMode: boolean }
  items: ItemView[]
  clan: { id: string; name: string; tag: string; emblem: string; level: number; contribution: number; role: string; prodBonusPct: number; lastClaimAt: string | null } | null
  pendingFriendRequests: number
  unreadNotifs: number
  pendingWithdrawals: number
  farmValue: number
}

export interface HatchResult {
  kind: string; title: string; emoji: string; detail: string
}

// ── api helper ───────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('henfarm_token')
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem('henfarm_token', t)
  else localStorage.removeItem('henfarm_token')
}

/** Carries the HTTP status so callers can tell "you are signed out"
 *  apart from "the network is down" — they need different recovery. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// A request that never settles would otherwise hold `loading: true`
// forever and disable every control bound to it, with no way out.
const REQUEST_TIMEOUT_MS = 15000

export async function api<T = unknown>(path: string, options?: { method?: string; body?: unknown; timeoutMs?: number }): Promise<T> {
  const timeout = options?.timeoutMs ?? REQUEST_TIMEOUT_MS
  let res: Response
  try {
    res = await fetch(path, {
      method: options?.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'x-auth-token': getToken()! } : {}),
      },
      signal: AbortSignal.timeout(timeout),
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    })
  } catch (e) {
    // A timeout or an offline device must not read as a server error.
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new ApiError('The farm is taking too long to respond. Please try again.', 0)
    }
    throw new ApiError(
      typeof navigator !== 'undefined' && !navigator.onLine
        ? 'You are offline. Reconnect to keep playing.'
        : 'Cannot reach the farm right now. Check your connection.',
      0,
    )
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'Something went wrong', res.status)
  return data as T
}

// ── store ────────────────────────────────────────────────────

interface Store {
  state: GameState | null
  loading: boolean
  booting: boolean
  /** Set when the farm could not be reached. Distinguishes a transient
   *  network failure from a signed-out session, and drives a retry UI. */
  bootError: string | null
  /** Which action is currently in flight. A single global `loading`
   *  flag let one slow request disable unrelated controls app-wide. */
  pendingAction: string | null
  authScreen: 'login' | 'register'
  flash: { message: string; type: 'success' | 'error' | 'info' } | null
  hatchResult: HatchResult | null
  adminOpen: boolean

  setAuthScreen: (s: 'login' | 'register') => void
  setAdminOpen: (v: boolean) => void
  showFlash: (message: string, type?: 'success' | 'error' | 'info') => void
  setHatchResult: (r: HatchResult | null) => void
  retryBoot: () => Promise<void>
  clearBootError: () => void

  boot: () => Promise<void>
  refresh: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, farmName: string, referralCode?: string) => Promise<void>
  logout: () => Promise<void>
  act: (action: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown> | null>
}

export const useGame = create<Store>((set, get) => ({
  state: null,
  loading: false,
  booting: true,
  bootError: null,
  pendingAction: null,
  authScreen: 'login',
  flash: null,
  hatchResult: null,
  adminOpen: false,

  setAuthScreen: (s) => set({ authScreen: s }),
  setAdminOpen: (v) => set({ adminOpen: v }),

  showFlash: (message, type = 'success') => {
    set({ flash: { message, type } })
    setTimeout(() => {
      if (get().flash?.message === message) set({ flash: null })
    }, 3200)
  },

  setHatchResult: (r) => set({ hatchResult: r }),

  clearBootError: () => set({ bootError: null }),

  retryBoot: async () => {
    set({ bootError: null, booting: true })
    await get().boot()
  },

  boot: async () => {
    if (!getToken()) {
      set({ booting: false, state: null, bootError: null })
      return
    }
    try {
      const state = await api<GameState>('/api/game/state')
      set({ state, booting: false, bootError: null })
    } catch (e) {
      // Only discard the session when the server actually rejected it.
      // Clearing on any failure signed players out whenever the network
      // hiccupped, with no message explaining why.
      if (e instanceof ApiError && e.status === 401) {
        setToken(null)
        set({ booting: false, state: null, bootError: null })
      } else {
        const msg = e instanceof Error ? e.message : 'Could not load your farm'
        set({ booting: false, state: null, bootError: msg })
      }
    }
  },

  refresh: async () => {
    if (!getToken()) return
    try {
      const state = await api<GameState>('/api/game/state')
      set({ state, bootError: null })
    } catch (e) {
      // A dropped poll should not sign the player out or blank the UI.
      // Surface it as a transient banner and leave the last good state.
      if (e instanceof ApiError && e.status === 401) {
        setToken(null)
        set({ state: null, adminOpen: false })
      } else {
        set({ bootError: e instanceof Error ? e.message : 'Connection lost' })
      }
    }
  },

  login: async (username, password) => {
    unlockAudio()
    set({ loading: true })
    try {
      const res = await api<{ token: string; isAdmin: boolean }>('/api/auth', {
        method: 'POST',
        body: { action: 'login', username, password },
      })
      setToken(res.token)
      await get().refresh()
      get().showFlash(`Welcome back, farmer! 🌾`)
      play('reward')
    } finally {
      set({ loading: false })
    }
  },

  register: async (username, password, farmName, referralCode) => {
    unlockAudio()
    set({ loading: true })
    try {
      const res = await api<{ token: string }>('/api/auth', {
        method: 'POST',
        body: { action: 'register', username, password, farmName, referralCode: referralCode || undefined },
      })
      setToken(res.token)
      await get().refresh()
      get().showFlash('Farm created! Happy farming 🐔')
      play('win')
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    try { await api('/api/auth', { method: 'POST', body: { action: 'logout' } }) } catch { /* ignore */ }
    setToken(null)
    set({ state: null, adminOpen: false })
  },

  act: async (action, payload = {}) => {
    // Every act() call originates from a tap/click, which is exactly the
    // user gesture the autoplay policy needs — unlock here, not in the
    // views, so no call site can forget it.
    unlockAudio()
    set({ loading: true, pendingAction: action })
    try {
      const res = await api<{ ok?: boolean; message?: string; hatch?: HatchResult } & Record<string, unknown>>(
        '/api/game/action',
        { method: 'POST', body: { action, ...payload } }
      )
      await get().refresh()
      if (res.hatch) {
        set({ hatchResult: res.hatch })
        play(soundForHatchResult(res.hatch))
      } else {
        if (res.message) {
          get().showFlash(res.message)
        }
        // Payload-aware: buying a cow moos, using medicine hisses.
        // Unknown future actions resolve to null and stay silent rather
        // than playing a misleading cue.
        const cue = soundForAction(action, {
          itemType: typeof payload.itemType === 'string' ? payload.itemType : undefined,
          subType: typeof payload.subType === 'string' ? payload.subType : undefined,
          itemKey: typeof payload.itemKey === 'string' ? payload.itemKey : undefined,
        })
        if (cue) play(cue)
      }
      return res
    } catch (e) {
      get().showFlash(e instanceof Error ? e.message : 'Action failed', 'error')
      play('error')
      return null
    } finally {
      set({ loading: false, pendingAction: null })
    }
  },
}))
