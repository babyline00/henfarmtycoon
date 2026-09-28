# Arcade — physics contract and roadmap

## The rule

**Client and server import their physics from the same place.**

`src/lib/mini-games.ts` is dependency-free and holds the physics: speed
ramps, pacing floors, spawn rates, win targets. The canvas games import it,
and so does the anti-cheat validator.

This exists because they used to keep their own numbers and the validator
was the side that lost. Both bugs below were found by playing the games
against the live server, not by reading the code.

## What was broken

### 1. Chicken Run rejected honest play from level 10 up

The client tops out at `24 m/s × speedMult`. The server capped at a
hand-picked `30 m/s`.

| tier | speedMult | client ceiling | verdict |
|---|---|---|---|
| farm | 1.00 | 24.0 m/s | ok |
| village | 1.15 | 27.6 m/s | ok |
| city | 1.30 | **31.2 m/s** | rejected |
| highway | 1.50 | **36.0 m/s** | rejected |
| legendary | 1.75 | **42.0 m/s** | rejected |

A player running at full speed on a `city` road was told *"Distance
impossible"* and had their **account flagged for review**. The cap is now
derived from the client's own ceiling, with headroom for frame jitter and
network latency — it is never tighter than the physics.

### 2. Road Crossing rejected honest play at every tier

The client let you advance a row every `0.17 s` (5.9 rows/s). The server
demanded 1 row/second. Crossing the 12-row target took two seconds and came
back:

```
"12 rows impossible in 3s" — rewards voided, account flagged
```

Two fixes, because the two sides were wrong in opposite directions:

- The **client** now enforces a row-pacing floor (1.0 s, or 0.6 s with the
  ⚡ power-up), matching the server's intended pace. A 2-second crossing was
  too short to read the traffic, let alone survive it.
- The **server** validates against the fastest rate the client permits, so
  a powered-up run is never voided.

The ⚡ speed power-up was also dead: the 1 s server cap swallowed its
entire effect. It now genuinely buys a 1.67× faster row rate.

### 3. The win threshold disagreed between client and server

The client computed its own `winTarget + tier * 4`; the server compared
against the bare `winTarget`. On a `highway` run the server paid a win at
row 12 while the client was still hopping toward row 24 — the player never
saw the win screen. The server now publishes `winTargetFor(game, tier)` at
session start and both sides use it.

### 4. Road Crossing traffic bunched up on rotation

Rows are generated once against whatever `canvas.clientWidth` happened to
be. Rotating the device changed the width but not the stored vehicle
positions, so the traffic collapsed into one edge of the new road and the
crossing became trivially easy. `resize()` now rescales vehicle x by the
width ratio.

## Games

| key | what it is | energy | target |
|---|---|---|---|
| `chicken_run` | endless runner, 3 lanes, jump + collect | 10 | 1000 m |
| `road_crossing` | frogger, hop to the farm side | 15 | 12 + 4/tier rows |
| `egg_catch` | catcher, sweep the basket, dodge rocks | 8 | 25 eggs |

### Egg Catch runs on a fixed logical field

`CATCH_FIELD_W × CATCH_FIELD_H` (1000×700), scaled and letterboxed at draw
time. The other two derive geometry from `canvas.clientWidth`, so the same
session plays differently on a phone and a desktop and their collision
maths moves with the viewport. The logical field makes behaviour identical
on every screen — and it makes the item rate exact, because the server caps
catches by **integrating the same spawn ramp the game runs on**.

That cap is a single shared allowance, not a per-category one. Splitting it
would let a client claim the full allowance in eggs *and* again in coins;
only the sum is physically bounded.

## Roadmap

Not built yet. Ordered by value, not by how fun they sound.

### Near

1. **Combo / streak in Chicken Run.** Consecutive pickups without missing
   multiply the coin value. Needs a server rule, not just a client
   counter, or it is exactly the kind of thing a forged telemetry abuses.
2. **Per-game analytics in the admin panel.** The panel shows aggregate
   totals today. Win rate, median distance and the reward curve *per game*
   would answer "is Chicken Run actually fun" with a number.
3. **Daily arcade challenge.** One fixed seed and target per day, ranked.
   The session row already carries `duration`, `score` and `result`, so the
   data to rank it exists.

### Medium

4. ~~Port the logical-field approach to the other two games.~~ **Done.**
   Chicken Run and Road Crossing now simulate in a fixed logical field
   (`RUN_FIELD_*`, `CROSS_FIELD_*`) mapped onto the canvas by
   `fieldTransform`, the same way Egg Catch does. Their collision maths no
   longer depends on the viewport: reaction time in Chicken Run used to range
   from 4.71s to 7.03s depending on the device and is now 6.67s everywhere.
   `CROSS_FIELD_H` is 850 for that measured reason, and a test pins the
   number so retuning it is deliberate.

   Two things the port removed rather than fixed: Road Crossing's resize
   handler had to rescale every vehicle by the width ratio, because rows
   generated at the old width were left bunched at one edge of the new one —
   a resize is now purely a repaint. And the touch slop threshold was 20
   *client* pixels, so the required swipe grew as the canvas shrank; it is
   now 20 logical units.
5. **A fourth game on the same scaffold.** The framework is now the cheap
   part: register a key, a definition, physics constants, an evaluator, a
   route branch and a component. A rhythm/timing game would use the
   `catchMaxItems`-style cap.
6. **Game-specific audio beds.** Music has a mood per *screen*; a per-game
   layer (an arcade pulse that tracks the run) would need its own bus and
   ducking rules.

### Deliberately not doing

- **More anti-cheat heuristics.** The cap is a plausibility band, not proof.
  Adding more heuristics raises the chance of rejecting honest play, which
  is the failure mode that already bit twice. Tightening this properly
  wants signed telemetry from the client, not a better constant.
- **More species variants per animal.** Recordings are ~30–110 KB each; a
  sixth cow call is 60 KB of payload for marginal variety.
