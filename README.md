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

Demo accounts (also on the login screen as one-tap buttons):

| User | Password | Role |
|---|---|---|
| `demo` | `demo123` | Player |
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

Everything you hear is **generated at runtime with the Web Audio API**. There
are no audio files in this repository. That is a deliberate trade: nothing to
download, no licensing to clear, works offline, and every cue is deterministic.

| Module | Responsibility |
|---|---|
| `src/lib/sfx.ts` | 63 sound-effect voices, preferences, throttling |
| `src/lib/music.ts` | Generative background music, 7 moods, own bus |
| `src/lib/ambience.ts` | The soundscape — things that happen on their own |
| `src/lib/game-sounds.ts` | Game vocabulary → voice (pure, unit tested) |
| `src/lib/scene-audio.ts` | Screen → music mood, state → soundscape |
| `src/components/game/audio-settings.tsx` | The player-facing controls |

**Sound effects and music are on separate buses.** You can silence the
soundtrack and keep click feedback, or the reverse. Both have their own toggle
and volume slider, persisted to `localStorage`, reachable from
**Me → Audio**.

### Sound effects

Voices are built from four primitives: a shaped oscillator (`tone`), filtered
noise, a formant-filtered **vocal** (pitch envelope + vibrato + growl + breath),
and a **trill** (amplitude pulse train) for purring and insects.

Animal calls get real synthesis rather than a single blip — a cow has a slow
low moo and a deeper bellow, a cat meows *and* purrs, a dog barks, growls and
whines. A raw oscillator at an animal's pitch does not read as that animal; the
pitch envelope and the resonant formant are what make it recognisable.

### Background music

A lookahead scheduler walks a chord progression and spawns voices on the
AudioContext clock. `setTimeout`-per-note drifts, and drift is the most audible
way to make generated music sound cheap.

Seven moods, one per screen (farm, night, shop, market, social, arcade, calm),
each a real progression in a sane register. The music **ducks** under a hatch
or level-up so the fanfare is not buried, and stops scheduling entirely when
the tab is hidden.

### Soundscape

On the farm view only, a cue fires every 7–17 s — birdsong and wind by day,
crickets at night, and only the species the player actually owns. A farm with
no cow never moos.

### Autoplay policy

Browsers block audio until a real gesture, and iOS Safari keeps the context
suspended. Audio is therefore created lazily on the first real pointer/key
event, and any play attempt before that is a silent no-op rather than an
exception.

## Project layout

```
src/app/            routes + API handlers
src/lib/            game rules, economy, auth, security, audio
src/components/     game views (ui/ holds only button/input/label)
scripts/            test suites and maintenance scripts
```

## Notes for contributors

- The game is **server-authoritative**. The client tracks raw telemetry for
  the two mini-games; every reward is computed server-side and re-validated
  against a plausibility cap.
- `can()` in `src/lib/security.ts` **fails closed**: a null or unknown admin
  role gets no permissions. Do not add a fallback that grants `*`.
- Passwords are scrypt with a `timingSafeEqual` comparison. Legacy SHA-256
  rows are verified and transparently upgraded on login.
- `scripts/reset-arcade.ts demo` tops up arcade energy for the shared demo
  account if you have drained it.
