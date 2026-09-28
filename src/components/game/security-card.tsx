'use client'

import { useState } from 'react'
import { api, setToken, useGame } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GameCard } from './shared'
import { cn } from '@/lib/utils'

/**
 * Change password / sign out everywhere.
 *
 * There was no way to change your own password at all, which is not a
 * feature gap so much as a hole: if a token leaked, the owner had no way
 * to cut the attacker off. Both actions here exist to close that.
 *
 * Changing the password requires the current one, holds the new one to the
 * server's policy (8+ characters, 2 character classes), and revokes every
 * other session. "Sign out everywhere" revokes all of them, including this
 * one, so the caller is bounced to the login screen on success.
 */
export function SecurityCard() {
  const { showFlash } = useGame()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [show, setShow] = useState(false)

  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current.length > 0 && next.length > 8 && next === confirm && !busy

  async function changePassword() {
    if (!canSubmit) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await api<{ error?: string }>('/api/auth', {
        method: 'POST',
        body: { action: 'change_password', currentPassword: current, newPassword: next },
      })
      if (res.error) { setMsg({ kind: 'err', text: res.error }); showFlash(res.error, 'error'); return }
      showFlash('🔐 Password changed. Other devices were signed out.', 'success')
      setCurrent(''); setNext(''); setConfirm('')
      setMsg({ kind: 'ok', text: 'Password changed. Every other device has been signed out.' })
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Could not change your password'
      setMsg({ kind: 'err', text })
      showFlash(text, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function logoutEverywhere() {
    setBusy(true)
    try {
      const res = await api<{ error?: string; revoked?: number }>('/api/auth', {
        method: 'POST',
        body: { action: 'logout_all' },
      })
      if (res.error) { setMsg({ kind: 'err', text: res.error }); return }
      setToken(null)
      showFlash(`🚪 Signed out of ${res.revoked ?? 0} device(s)`, 'success')
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Could not sign out'
      setMsg({ kind: 'err', text })
      showFlash(text, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        aria-expanded={show}
        className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-stone-50"
      >
        <span>
          <span className="block text-sm font-black text-stone-800">🔐 Password &amp; security</span>
          <span className="block text-[11px] text-stone-600">Change your password or sign out everywhere</span>
        </span>
        <span className="shrink-0 text-stone-500" aria-hidden="true">{show ? '▲' : '▼'}</span>
      </button>

      {show && (
        <GameCard className="space-y-3">
          <div>
            <Label htmlFor="sec-current" className="text-[10px] font-bold text-stone-600">Current password</Label>
            <Input
              id="sec-current"
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="mt-0.5 h-10 rounded-lg bg-stone-50 text-xs"
            />
          </div>
          <div>
            <Label htmlFor="sec-next" className="text-[10px] font-bold text-stone-600">New password</Label>
            <Input
              id="sec-next"
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters, 2 character classes"
              aria-describedby="sec-help"
              className="mt-0.5 h-10 rounded-lg bg-stone-50 text-xs"
            />
            <p id="sec-help" className="mt-0.5 text-[10px] text-stone-600">
              Mix letters, numbers or symbols. Every other device will be signed out.
            </p>
          </div>
          <div>
            <Label htmlFor="sec-confirm" className="text-[10px] font-bold text-stone-600">Confirm new password</Label>
            <Input
              id="sec-confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              aria-invalid={mismatch || undefined}
              className={cn('mt-0.5 h-10 rounded-lg text-xs', mismatch ? 'border-red-500 bg-red-50' : 'bg-stone-50')}
            />
            {mismatch && <p className="mt-0.5 text-[10px] font-bold text-red-700">Passwords do not match</p>}
          </div>

          {msg && (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'rounded-lg px-2 py-1.5 text-[11px] font-bold',
                msg.kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800',
              )}
            >
              {msg.text}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={changePassword}
              disabled={!canSubmit}
              className="h-11 w-full rounded-xl bg-green-700 text-sm font-extrabold text-white disabled:opacity-40"
            >
              🔐 Change password
            </Button>
            <Button
              onClick={logoutEverywhere}
              disabled={busy}
              variant="outline"
              className="h-11 w-full rounded-xl border-stone-300 text-sm font-bold text-stone-700 disabled:opacity-40"
            >
              🚪 Sign out on all devices
            </Button>
          </div>
        </GameCard>
      )}
    </>
  )
}
