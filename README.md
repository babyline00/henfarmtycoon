# 🐔 HenFarm Tycoon

A farming game: hens, eggs, breeding, animals, a marketplace, clans, an
arcade and real-money deposits. Next.js 16 (App Router, Turbopack) + React 19
+ TypeScript + Tailwind + Prisma/SQLite.

## Running it

```bash
bun install
bun run db:push      # create the SQLite schema
bun run dev          # http://localhost:3022
```

`bun run dev` listens on **3022**. Override with `PORT=3000 bun run dev`.

There is no demo player account. Players sign up from the login screen.

The seed creates exactly one staff account, and it is the only way into the
admin portal, so change its password immediately on any real deployment:

| User | Password | Role |
|---|---|---|
| `admin` | `admin123` | Super Admin (full admin panel) |

## Verifying it

```bash
bun run verify       # typecheck + lint + unit + 3 HTTP suites + security
```

Run against a live server. Individual pieces:

```bash
bun run typecheck
bun run lint
bun run test         # 76 unit tests
bun run test:e2e     # 3 HTTP suites, needs a running server
bun run test:security
```

The HTTP suites honour `SMOKE_BASE_URL` (and a positional URL arg), so they
can be pointed at any instance:

```bash
SMOKE_BASE_URL=http://localhost:3022 bun run test:e2e
```

## Audio

Two systems, chosen per cue.

**Animal voices are real recordings. Everything else is synthesised.** That
split is deliberate. For UI blips, coins and hatching, procedural synthesis is
the better engineering answer: nothing to download, no licensing to clear,
works offline, deterministic. But a synthesised "moo" is recognisable as *a
low vocalisation*, not as a cow, and there is no synthesis trick for that. So
the species calls are samples.

| Module | Responsibility |
|---|---|
| `src/lib/sfx.ts` | Cue playback: recordings when present, synth otherwise |
| `src/lib/voice-files.ts` | Which cues have a recording, and their playback limits (pure, unit tested) |
| `src/lib/music.ts` | Generative background music, 7 moods, own bus |
| `src/lib/ambience.ts` | The soundscape — things that happen on their own |
| `src/lib/game-sounds.ts` | Game vocabulary -> voice (pure, unit tested) |
| `src/lib/scene-audio.ts` | Screen -> music mood, state -> soundscape |
| `src/components/game/audio-settings.tsx` | The player-facing controls |

**Every recording has a synth voice underneath it.** A missing file, a decode
error or an offline client falls back to synthesis, so a cue is never silent
and audio never breaks gameplay. A test enforces that pairing.

**Recordings are trimmed and capped.** Several source clips run for many
seconds and a button tap must not become a ten-second roar, so every cue
declares a `maxSec`; anything longer is faded out rather than cut. Recordings
are also mastered louder than a synth blip, so each carries a per-cue `gain`,
and the ambience sits deliberately under the animal calls.

**Caching is two-tier.** The hot set — hen, cow, cat, dog, what you hear in
the first ten seconds — is fetched on the first gesture; the rest arrives on
`requestIdleCallback`. A cue whose recording is not ready yet plays its synth
voice immediately rather than a gap, so a tap is never silent.

### Fetching the clips

```bash
bun run fetch:sounds        # idempotent; skips files already on disk
```

Sources are Mixkit, under the Mixkit Sound Effects Free License (commercial
use, no attribution, no redistribution as a standalone collection). The script
records every file's title, size and source id in
`public/sounds/animals/CREDITS.md`, and a test fails if a shipped file is
uncredited or a credited file is missing. It also refuses anything over
700 KB: the long ambience loops run to 6 MB, which is a brutal download to ask
a phone for a background texture, so those slots stay synthetic.

**Sound effects and music are on separate buses.** You can silence the
soundtrack and keep click feedback, or the reverse. Both have their own toggle
and volume slider, persisted to `localStorage`, reachable from **Me -> Audio**.

### Sound effects

Voices are built from four primitives: a shaped oscillator (`tone`), filtered
noise, a formant-filtered **vocal** (pitch envelope + vibrato + growl +
breath), and a **trill** (amplitude pulse train) for purring and insects.

### Background music

A lookahead scheduler walks a chord progression and spawns voices on the
AudioContext clock. `setTimeout`-per-note drifts, and drift is the most
audible way to make generated music sound cheap.

Seven moods, one per screen (farm, night, shop, market, social, arcade,
calm), each a real progression in a sane register. The music **ducks** under a
hatch or level-up so the fanfare is not buried, and stops scheduling entirely
when the tab is hidden.

### Soundscape

On the farm view only, a cue fires every 7-17 s — birdsong and wind by day,
crickets at night, and only the species the player actually owns. A farm with
no cow never moos.

### Autoplay policy

Browsers block audio until a real gesture, and iOS Safari keeps the context
suspended. `unlockAudio()` is wired to the first pointer/key event in
`page.tsx` — **not** only to login/register/action. That distinction matters:
unlocking only on those meant a returning player (any page load with an
existing session) had a suspended SFX context, so `play()` bailed out and the
first several taps were completely silent.

## Project layout

```
src/app/            routes + API handlers
src/lib/            game rules, economy, auth, security, audio
src/components/     game views (ui/ holds only button/input/label)
scripts/            test suites and maintenance scripts
```

## Auth

**No demo accounts.** The login screen used to offer one-tap credentials for
`demo`, which put a publicly known password on every reachable deployment.
Accounts are now created by players, or recovered by an admin. The seed still
creates `admin`, because it is the only door into the admin portal — change it
on first deploy.

**Usernames are case-folded.** SQLite compares TEXT case-sensitively, so
without folding `Demo` and `demo` were two accounts with two passwords and
anyone could register a near-copy of a real player. Registration and login
both go through `canonicalUsername()`. `farmName` keeps its original casing.

**Brute-force limiting is two independent buckets**, because either one alone
is defeatable:

| Bucket | Key | Counts | Stops |
|---|---|---|---|
| per-IP | client address | every attempt | one host spraying many usernames |
| per-account | address + account | **failures only** | one account sprayed from many hosts |

The per-account bucket is the one that matters, and it counts failures only
on purpose: a bucket that also counted successful logins would lock out a
player who simply signs in repeatedly, which is a self-inflicted DoS.

`X-Forwarded-For` is **ignored unless `TRUST_PROXY=1`**. It is
client-controlled unless a proxy that overwrites it is genuinely deployed.
Trusting it unconditionally meant a fresh header per request bought unlimited
login attempts and the limit never fired — you can still see that regression
tested in `scripts/security-smoke-test.mjs`.

**Sessions** are opaque 32-byte tokens, 30 days, in the `Session` table. Three
ways to end them: logout (one), change-password (all but the current one), and
admin force-logout (all). Expired rows are swept opportunistically on login.

**Password policy is defined once**, in `lib/auth.ts` as `passwordProblem()`,
and every door uses it: registration, a player's own change, and an admin
reset. It used to live only in the register route, so the admin reset accepted
any 8 characters — the weakest way into an account had the loosest lock.

## Admin portal

Eleven tabs behind the permission matrix, not a single coarse gate:

| Tab | What it does |
|---|---|
| Dash | Platform totals, growth, coin flow, top holders |
| Analytics | DAU/retention, economy health, revenue by SKU, top spenders |
| Games | Enable/disable, energy cost, season payouts, cheat monitor |
| Support | Ticket queue, threaded replies, close/reopen |
| Users | Search, block, role assignment, balance adjust, password reset, force-logout |
| Payouts | Withdrawal approve / hold / reject |
| Deposits | Verify or reject deposits against the reference and proof |
| Economy | Emergency kill switches, per-key config, rules reference |
| Events | Create, start/stop, delete |
| Notify | Broadcast to every player |
| Security | Flagged accounts, rate-limit hits, permission matrix, audit log |

Each admin action is authorised by what it can *do* (`AREA_FOR` in
`/api/admin/users`), not by which screen it lives on, and every destructive
action writes an audit-log row. `set_role` is Super Admin only; resetting
another *staff* account's password is Super Admin only.

## Notes for contributors

- The game is **server-authoritative**. The client tracks raw telemetry for
  the two mini-games; every reward is computed server-side and re-validated
  against a plausibility cap.
- `can()` in `src/lib/security.ts` **fails closed**: a null or unknown admin
  role gets no permissions. Do not add a fallback that grants `*`.
- Passwords are scrypt with a `timingSafeEqual` comparison. Legacy SHA-256
  rows are verified and transparently upgraded on login.
- `bun run scripts/reset-arcade.ts <username>` tops up arcade energy and
  clears anti-cheat flags for one account. It deliberately takes no default.
- Players can change their own password and revoke every session from
  **Me -> Security**. An admin can do the same for anyone from the Users tab.
