'use client'

/**
 * Animated 2D SVG sprite library.
 *
 * Design notes
 * ------------
 * • SVG, not emoji. Emoji render differently per platform, cannot be
 *   animated, and are read out as verbose names by screen readers. These
 *   scale cleanly at any density, animate, and stay visually consistent.
 * • Every sprite is a pure function of `size` and a small colour set, so a
 *   sprite is deterministic — no Math.random, no layout thrash.
 * • Animation is driven entirely by CSS classes (see globals.css), not by
 *   JS or framer-motion. That keeps it off the main thread, lets the global
 *   `prefers-reduced-motion` block neutralise all of it in one place, and
 *   avoids re-rendering React on every frame.
 * • `role="img"` + a real label by default. Pass `decorative` when a text
 *   label already sits next to the sprite, so it is not announced twice.
 * • Unknown keys fall back to the emoji the game already used, so a new
 *   animal added to game.ts can never crash a view.
 */

import { cn } from '@/lib/utils'

export type SpriteName =
  // creatures
  | 'farmer' | 'hen' | 'rooster' | 'turkey' | 'goose'
  | 'cow' | 'sheep' | 'duck' | 'dog' | 'cat' | 'horse'
  | 'dragon' | 'runner'
  // items
  | 'egg' | 'basket' | 'wheat' | 'honey' | 'syringe' | 'pill'
  | 'testtube' | 'charm' | 'pumpkin' | 'box' | 'rocket'
  | 'lightning' | 'heart'
  // structures
  | 'barn' | 'factory' | 'crane' | 'ruin' | 'trafficlight'

/** Which idle animation, if any, suits a sprite. */
export type SpriteAnim = 'none' | 'idle' | 'peck' | 'wag' | 'float' | 'pulse'

// ── palette ───────────────────────────────────────────────────
// Per-sprite colours are passed in as CSS custom properties so one
// component definition serves every variant (e.g. 4 hen breeds).
export interface SpritePalette {
  body?: string
  bodyDark?: string
  belly?: string
  accent?: string
  accentDark?: string
  eye?: string
}

const P: Record<string, Required<SpritePalette>> = {
  hen:      { body: '#fff8e7', bodyDark: '#e6dcc4', belly: '#ffffff', accent: '#e23b3b', accentDark: '#a82828', eye: '#2b2b2b' },
  rooster:  { body: '#f2e6c9', bodyDark: '#d8c49a', belly: '#8f2f2f', accent: '#d92b2b', accentDark: '#8a1a1a', eye: '#2b2b2b' },
  turkey:   { body: '#7c5a44', bodyDark: '#5b3f2e', belly: '#3f2c20', accent: '#c2410c', accentDark: '#7c2d12', eye: '#1a1a1a' },
  goose:    { body: '#f8fafc', bodyDark: '#cbd5e1', belly: '#ffffff', accent: '#f97316', accentDark: '#9a3412', eye: '#1a1a1a' },
  cow:      { body: '#ffffff', bodyDark: '#d6d3d1', belly: '#e7e5e4', accent: '#292524', accentDark: '#1c1917', eye: '#1a1a1a' },
  sheep:    { body: '#fafaf9', bodyDark: '#d6d3d1', belly: '#ffffff', accent: '#3f3f46', accentDark: '#27272a', eye: '#1a1a1a' },
  duck:     { body: '#fde68a', bodyDark: '#fcd34d', belly: '#fffbeb', accent: '#ea580c', accentDark: '#9a3412', eye: '#1a1a1a' },
  dog:      { body: '#d6a15d', bodyDark: '#b4813f', belly: '#f5e6cd', accent: '#78350f', accentDark: '#451a03', eye: '#1a1a1a' },
  cat:      { body: '#a8a29e', bodyDark: '#78716c', belly: '#f5f5f4', accent: '#57534e', accentDark: '#292524', eye: '#16a34a' },
  horse:    { body: '#92400e', bodyDark: '#78350f', belly: '#d6a15d', accent: '#1c1917', accentDark: '#0c0a09', eye: '#1a1a1a' },
  dragon:   { body: '#16a34a', bodyDark: '#14532d', belly: '#86efac', accent: '#dc2626', accentDark: '#7f1d1d', eye: '#facc15' },
  runner:   { body: '#f8fafc', bodyDark: '#cbd5e1', belly: '#ffffff', accent: '#e23b3b', accentDark: '#a82828', eye: '#1a1a1a' },
  farmer:   { body: '#3b82f6', bodyDark: '#1d4ed8', belly: '#bfdbfe', accent: '#d6a15d', accentDark: '#92400e', eye: '#1a1a1a' },
  egg:      { body: '#fffbeb', bodyDark: '#fde68a', belly: '#ffffff', accent: '#f59e0b', accentDark: '#b45309', eye: '#1a1a1a' },
  basket:   { body: '#d6a15d', bodyDark: '#a16207', belly: '#fde68a', accent: '#92400e', accentDark: '#78350f', eye: '#1a1a1a' },
  wheat:    { body: '#f59e0b', bodyDark: '#b45309', belly: '#fde68a', accent: '#92400e', accentDark: '#78350f', eye: '#1a1a1a' },
  honey:    { body: '#f59e0b', bodyDark: '#b45309', belly: '#fde68a', accent: '#78350f', accentDark: '#451a03', eye: '#1a1a1a' },
  syringe:  { body: '#f8fafc', bodyDark: '#cbd5e1', belly: '#e2e8f0', accent: '#ef4444', accentDark: '#991b1b', eye: '#1a1a1a' },
  pill:     { body: '#ffffff', bodyDark: '#d4d4d8', belly: '#fafafa', accent: '#ef4444', accentDark: '#991b1b', eye: '#1a1a1a' },
  testtube: { body: '#f8fafc', bodyDark: '#cbd5e1', belly: '#a855f7', accent: '#7e22ce', accentDark: '#581c87', eye: '#1a1a1a' },
  charm:    { body: '#38bdf8', bodyDark: '#0369a1', belly: '#bae6fd', accent: '#facc15', accentDark: '#a16207', eye: '#1a1a1a' },
  pumpkin:  { body: '#f97316', bodyDark: '#c2410c', belly: '#fed7aa', accent: '#15803d', accentDark: '#14532d', eye: '#1a1a1a' },
  box:      { body: '#d97706', bodyDark: '#92400e', belly: '#fde68a', accent: '#dc2626', accentDark: '#7f1d1d', eye: '#1a1a1a' },
  rocket:   { body: '#e5e7eb', bodyDark: '#9ca3af', belly: '#f9fafb', accent: '#dc2626', accentDark: '#7f1d1d', eye: '#1a1a1a' },
  lightning:{ body: '#facc15', bodyDark: '#ca8a04', belly: '#fef9c3', accent: '#a16207', accentDark: '#713f12', eye: '#1a1a1a' },
  heart:    { body: '#ef4444', bodyDark: '#b91c1c', belly: '#fca5a5', accent: '#7f1d1d', accentDark: '#450a0a', eye: '#1a1a1a' },
  barn:     { body: '#dc2626', bodyDark: '#991b1b', belly: '#fecaca', accent: '#f5f5f4', accentDark: '#a8a29e', eye: '#1a1a1a' },
  factory:  { body: '#78716c', bodyDark: '#44403c', belly: '#d6d3d1', accent: '#ea580c', accentDark: '#7c2d12', eye: '#1a1a1a' },
  crane:    { body: '#facc15', bodyDark: '#ca8a04', belly: '#fef3c7', accent: '#292524', accentDark: '#1c1917', eye: '#1a1a1a' },
  ruin:     { body: '#a8a29e', bodyDark: '#78716c', belly: '#d6d3d1', accent: '#57534e', accentDark: '#292524', eye: '#1a1a1a' },
  trafficlight:{ body: '#44403c', bodyDark: '#1c1917', belly: '#57534e', accent: '#ef4444', accentDark: '#7f1d1d', eye: '#1a1a1a' },
}

// ── per-species geometry ──────────────────────────────────────
// Kept as data, separate from the <svg> wrapper, so the shapes can be
// tweaked without touching layout, sizing or accessibility.

type Body = (p: Required<SpritePalette>) => JSX.Element

/** Chunky bird: shared by hen / rooster / turkey / goose / duck. */
function birdBody(p: Required<SpritePalette>, crest: 'none' | 'comb' | 'fan' | 'tuft') {
  return (
    <g>
      {crest === 'comb' && <path d="M22 13c1-4 4-4 5 0 1-4 4-4 5 0 1-3 4-3 4 1" fill={p.accent} />}
      {crest === 'fan' && (
        <g fill={p.accent}>
          <path d="M20 14c-2-6 1-9 4-6z" /><path d="M25 13c-1-7 3-8 5-5z" /><path d="M30 14c2-6 6-5 6-2z" />
        </g>
      )}
      {crest === 'tuft' && <path d="M25 14c1-5 4-6 6-3" fill="none" stroke={p.accent} strokeWidth="1.6" strokeLinecap="round" />}
      {/* body */}
      <ellipse cx="25" cy="30" rx="13" ry="11" fill={p.body} />
      <ellipse cx="25" cy="33" rx="8" ry="7" fill={p.belly} />
      {/* tail */}
      <path d="M37 27c5-3 8-2 9 1-3 1-6 2-9 2z" fill={p.bodyDark} />
      {/* neck + head */}
      <path d="M18 24c-2-5-1-9 2-11 4-2 7 0 8 3 1 4-1 8-5 10z" fill={p.body} />
      <circle cx="24" cy="15" r="6" fill={p.body} />
      <circle cx="26" cy="14" r="1.6" fill={p.eye} />
      <circle cx="26.6" cy="13.4" r="0.6" fill="#fff" />
      {/* beak */}
      <path d="M29 15l5 1.5-5 2z" fill={p.accentDark} />
      {/* legs */}
      <path d="M22 40v4M28 40v4" stroke={p.accentDark} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  )
}

/** Four-legged farm animal with a swishable tail. */
function quadrupedBody(p: Required<SpritePalette>, opts: {
  snout: number; ears: 'flop' | 'point' | 'round'; legs: number
}) {
  return (
    <g>
      {/* legs first so they sit behind the body */}
      {Array.from({ length: opts.legs }).map((_, i) => (
        <rect key={i} x={14 + i * 6} y={33} width="3.4" height="9" rx="1.7" fill={p.bodyDark} />
      ))}
      <ellipse cx="25" cy="28" rx="15" ry="10" fill={p.body} />
      <ellipse cx="25" cy="32" rx="10" ry="6" fill={p.belly} />
      {/* head */}
      <circle cx="39" cy="20" r="7.5" fill={p.body} />
      {opts.ears === 'flop' && <ellipse cx="35" cy="13" rx="2.6" ry="5" fill={p.bodyDark} transform="rotate(-25 35 13)" />}
      {opts.ears === 'point' && <path d="M35 13l-2-6 5 3zM43 13l2-6-5 3z" fill={p.bodyDark} />}
      {opts.ears === 'round' && <circle cx="35" cy="13" r="2.4" fill={p.bodyDark} />}
      <circle cx="41" cy="19" r="1.5" fill={p.eye} />
      <ellipse cx="45" cy="22" rx={opts.snout} ry="2.6" fill={p.belly} />
    </g>
  )
}

const GEOMETRY: Record<SpriteName, Body> = {
  // ── creatures ──────────────────────────────────────────────
  hen:     p => birdBody(p, 'comb'),
  rooster: p => birdBody(p, 'fan'),
  turkey:  p => birdBody(p, 'tuft'),
  goose:   p => birdBody(p, 'none'),
  duck:    p => birdBody(p, 'none'),

  cow: p => (
    <g>
      {quadrupedBody(p, { snout: 3, ears: 'round', legs: 4 })}
      <path d="M32 24c2 3 3 6 1 8" stroke={p.bodyDark} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="37" cy="14" r="1.6" fill={p.bodyDark} />
      <path d="M35 15h4" stroke={p.bodyDark} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
  sheep: p => (
    <g>
      {quadrupedBody(p, { snout: 2, ears: 'flop', legs: 4 })}
      {[[16, 24], [21, 21], [26, 24], [31, 21], [21, 27], [31, 27]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill={p.belly} />
      ))}
    </g>
  ),
  duck:   p => birdBody(p, 'none'),
  dog: p => (
    <g>
      {quadrupedBody(p, { snout: 3, ears: 'flop', legs: 4 })}
      <path d="M44 25c3 0 4 2 2 3" stroke={p.accentDark} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  ),
  cat: p => (
    <g>
      {quadrupedBody(p, { snout: 2, ears: 'point', legs: 4 })}
      <path d="M36 22l-3 1M36 25l-3 1M44 22l3 1M44 25l3 1" stroke={p.accentDark} strokeWidth="0.9" strokeLinecap="round" />
    </g>
  ),
  horse: p => (
    <g>
      {quadrupedBody(p, { snout: 4, ears: 'point', legs: 4 })}
      <path d="M35 12c-1-5 1-8 3-9" stroke={p.bodyDark} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M42 12c1-4 0-6-1-7" stroke={p.bodyDark} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  ),

  dragon: p => (
    <g>
      <path d="M36 22c6-6 10-4 11 0-4 1-7 3-10 5z" fill={p.bodyDark} />
      <ellipse cx="24" cy="28" rx="14" ry="11" fill={p.body} />
      <path d="M20 18l-3-7 6 3zM27 17l-1-8 5 5zM33 19l3-7 3 6z" fill={p.accentDark} />
      <circle cx="38" cy="18" r="8" fill={p.body} />
      <circle cx="41" cy="16" r="2" fill={p.eye} />
      <path d="M42 23l6 1-6 3z" fill={p.accentDark} />
      <path d="M20 38v5M28 38v5" stroke={p.accentDark} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  runner: p => (
    <g>
      <ellipse cx="25" cy="28" rx="12" ry="12" fill={p.body} />
      <path d="M31 12c3-4 7-5 9-3-3 1-5 2-7 4z" fill={p.accent} />
      <circle cx="30" cy="22" r="1.7" fill={p.eye} />
      <path d="M34 26l5 1-5 2.5z" fill={p.accentDark} />
      <path d="M20 39l-3 5M28 39l3 5" stroke={p.accentDark} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  farmer: p => (
    <g>
      <circle cx="25" cy="17" r="8" fill={p.accent} />
      <path d="M13 17a12 6 0 0 1 24 0z" fill={p.accentDark} />
      <path d="M17 26h16a5 5 0 0 1 5 5v11H12V31a5 5 0 0 1 5-5z" fill={p.body} />
      <circle cx="22" cy="18" r="1.4" fill={p.eye} />
      <circle cx="28" cy="18" r="1.4" fill={p.eye} />
      <path d="M21 23c2 2 6 2 8 0" stroke={p.eye} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M18 30l-4 6M32 30l4 6" stroke={p.bodyDark} strokeWidth="3" strokeLinecap="round" />
    </g>
  ),

  // ── items ──────────────────────────────────────────────────
  egg: p => (
    <g>
      <path d="M25 8c7 0 12 10 12 18a12 12 0 0 1-24 0c0-8 5-18 12-18z" fill={p.body} />
      <path d="M18 30c2 5 6 7 9 7" stroke={p.belly} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M20 14c3-3 7-4 10-3" stroke={p.accent} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55" />
    </g>
  ),
  basket: p => (
    <g>
      <path d="M10 22h30l-3 18a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3z" fill={p.body} />
      <path d="M16 22v21M25 22v21M34 22v21" stroke={p.bodyDark} strokeWidth="1.4" opacity="0.7" />
      <path d="M16 22a9 9 0 0 1 18 0" fill="none" stroke={p.accentDark} strokeWidth="2" />
      <circle cx="20" cy="20" r="4" fill={p.belly} />
      <circle cx="28" cy="18" r="4" fill={p.belly} />
    </g>
  ),
  wheat: p => (
    <g>
      <path d="M25 44V18" stroke={p.accentDark} strokeWidth="2.2" strokeLinecap="round" />
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          <ellipse cx="20" cy={18 + i * 5} rx="4.5" ry="3" fill={p.body} transform={`rotate(-25 20 ${18 + i * 5})`} />
          <ellipse cx="30" cy={21 + i * 5} rx="4.5" ry="3" fill={p.body} transform={`rotate(25 30 ${21 + i * 5})`} />
        </g>
      ))}
    </g>
  ),
  honey: p => (
    <g>
      <path d="M14 20h22v4l4 16a3 3 0 0 1-3 4H13a3 3 0 0 1-3-4l4-16z" fill={p.body} />
      <rect x="12" y="16" width="26" height="5" rx="2" fill={p.accentDark} />
      <path d="M14 32h22" stroke={p.belly} strokeWidth="3" opacity="0.7" />
      <path d="M25 12l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill={p.accent} opacity="0.8" />
    </g>
  ),
  syringe: p => (
    <g transform="rotate(-35 25 25)">
      <rect x="10" y="21" width="24" height="8" rx="2" fill={p.body} opacity="0.85" />
      <rect x="10" y="21" width="14" height="8" rx="2" fill={p.accent} />
      <rect x="32" y="23" width="8" height="4" rx="1" fill={p.bodyDark} />
      <path d="M40 25h5" stroke={p.bodyDark} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="6" y="22" width="5" height="6" rx="1" fill={p.bodyDark} />
      <path d="M13 18v-3M18 18v-4M23 18v-3" stroke={p.bodyDark} strokeWidth="1.2" strokeLinecap="round" />
    </g>
  ),
  pill: p => (
    <g transform="rotate(-25 25 25)">
      <rect x="10" y="18" width="30" height="14" rx="7" fill={p.body} stroke={p.bodyDark} strokeWidth="1.5" />
      <path d="M25 18h8a7 7 0 0 1 0 14h-8z" fill={p.accent} />
    </g>
  ),
  testtube: p => (
    <g>
      <path d="M18 8h14v20a7 7 0 0 1-14 0z" fill={p.body} opacity="0.5" stroke={p.bodyDark} strokeWidth="1.6" />
      <path d="M18 22h14v6a7 7 0 0 1-14 0z" fill={p.belly} />
      <rect x="17" y="5" width="16" height="4" rx="1.5" fill={p.accentDark} />
      <circle cx="24" cy="17" r="2" fill={p.belly} opacity="0.8" />
    </g>
  ),
  charm: p => (
    <g>
      <path d="M25 6l4 4" stroke={p.accentDark} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M29 10c5 3 7 8 5 13s-8 8-13 6-7-8-5-13 8-9 13-6z" fill={p.body} opacity="0.85" />
      <path d="M25 14l2.6 5.4 6 .8-4.3 4.2 1 6-5.3-2.9-5.3 2.9 1-6-4.3-4.2 6-.8z" fill={p.accent} />
    </g>
  ),
  pumpkin: p => (
    <g>
      <ellipse cx="25" cy="30" rx="15" ry="12" fill={p.body} />
      <ellipse cx="19" cy="30" rx="6" ry="11" fill={p.bodyDark} opacity="0.4" />
      <ellipse cx="31" cy="30" rx="6" ry="11" fill={p.bodyDark} opacity="0.4" />
      <path d="M24 18v-5c0-2 2-3 4-2l3 2" stroke={p.accentDark} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M20 26l2 3 2-3zM27 26l2 3 2-3z" fill={p.accentDark} />
      <path d="M21 36c2 2 6 2 8 0" stroke={p.accentDark} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  ),
  box: p => (
    <g>
      <path d="M8 20l17-8 17 8v20l-17 8-17-8z" fill={p.body} />
      <path d="M8 20l17 8 17-8M25 28v20" stroke={p.bodyDark} strokeWidth="1.8" fill="none" />
      <path d="M25 12l-6 4 6 4 6-4z" fill={p.accent} />
    </g>
  ),
  rocket: p => (
    <g>
      <path d="M25 4c6 6 9 14 9 22v8H16v-8c0-8 3-16 9-22z" fill={p.body} />
      <circle cx="25" cy="17" r="4" fill={p.accent} />
      <path d="M16 26l-7 8 7-2zM34 26l7 8-7-2z" fill={p.bodyDark} />
      <path d="M21 34h8l-4 10z" fill={p.accentDark} />
    </g>
  ),
  lightning: p => (
    <g>
      <path d="M28 4L12 28h10l-4 18 18-26H26z" fill={p.body} />
      <path d="M28 4L12 28h10l-4 18 18-26H26z" fill="none" stroke={p.accentDark} strokeWidth="1.6" strokeLinejoin="round" />
    </g>
  ),
  heart: p => (
    <g>
      <path d="M25 42S8 31 8 20a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 11-17 22-17 22z" fill={p.body} />
      <path d="M16 17a5 5 0 0 1 4-3" stroke={p.belly} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </g>
  ),

  // ── structures ─────────────────────────────────────────────
  barn: p => (
    <g>
      <path d="M6 22L25 8l19 14v20H6z" fill={p.body} />
      <path d="M6 22L25 8l19 14" stroke={p.bodyDark} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <rect x="18" y="28" width="14" height="14" fill={p.belly} />
      <path d="M18 28l14 14M32 28L18 42" stroke={p.bodyDark} strokeWidth="1.4" />
      <path d="M23 8V4h4v4" fill={p.accent} />
    </g>
  ),
  factory: p => (
    <g>
      <path d="M6 42V22l12 7V22l12 7V16h14v26z" fill={p.body} />
      <rect x="10" y="33" width="7" height="9" fill={p.belly} />
      <rect x="22" y="33" width="7" height="9" fill={p.belly} />
      <rect x="33" y="22" width="7" height="7" fill={p.accent} />
      <path d="M38 16c0-4 4-4 4 0s4 4 4 0" stroke={p.accent} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  ),
  crane: p => (
    <g>
      <path d="M14 42V14h5v28z" fill={p.body} />
      <path d="M14 14h26v4H14z" fill={p.body} />
      <path d="M14 18l-9 24h6l6-16z" fill={p.bodyDark} />
      <path d="M34 18h8" stroke={p.bodyDark} strokeWidth="1.6" />
      <rect x="40" y="18" width="4" height="10" fill={p.bodyDark} />
      <path d="M20 14l-4-6 8 2z" fill={p.accentDark} />
    </g>
  ),
  ruin: p => (
    <g>
      <path d="M8 42V20l6 4 6-8 7 6 6-9 7 7v22z" fill={p.body} />
      <rect x="20" y="30" width="10" height="12" fill={p.accentDark} />
      <path d="M12 24v6M30 20v8" stroke={p.bodyDark} strokeWidth="1.4" />
    </g>
  ),
  trafficlight: p => (
    <g>
      <rect x="21" y="4" width="8" height="34" rx="3" fill={p.body} />
      <rect x="17" y="8" width="16" height="10" rx="4" fill={p.bodyDark} />
      <rect x="17" y="20" width="16" height="10" rx="4" fill={p.bodyDark} />
      <rect x="17" y="32" width="16" height="10" rx="4" fill={p.bodyDark} />
      <circle cx="25" cy="13" r="3" fill={p.accent} />
      <circle cx="25" cy="25" r="3" fill={p.belly} opacity="0.5" />
      <circle cx="25" cy="37" r="3" fill={p.belly} opacity="0.5" />
    </g>
  ),
}

/** Emoji fallback for any key this library does not know about. */
const EMOJI_FALLBACK: Partial<Record<SpriteName, string>> = {
  hen: '🐔', rooster: '🐓', turkey: '🦃', goose: '🪿',
  cow: '🐄', sheep: '🐑', duck: '🦆', dog: '🐕', cat: '🐈', horse: '🐎',
  dragon: '🐲', runner: '🐤', farmer: '🧑‍🌾',
  egg: '🥚', basket: '🧺', wheat: '🌾', honey: '🍯', syringe: '💉',
  pill: '💊', testtube: '🧪', charm: '🧿', pumpkin: '🎃', box: '📦',
  rocket: '🚀', lightning: '⚡', heart: '❤️',
  barn: '🏠', factory: '🏭', crane: '🏗️', ruin: '🧱', trafficlight: '🚦',
}

// ── game-key ⇄ sprite mapping ──────────────────────────────────
// Mirrors the keys in src/lib/game.ts exactly. Keeping this in one place
// means a new animal only needs a mapping, not a new component.
export const HEN_SPRITE: Record<string, SpriteName> = {
  normal: 'hen', golden: 'rooster', royal: 'turkey', magic: 'goose',
}
export const ANIMAL_SPRITE: Record<string, SpriteName> = {
  cow: 'cow', sheep: 'sheep', duck: 'duck', dog: 'dog', cat: 'cat', horse: 'horse',
}
export const EGG_SPRITE: Record<string, SpriteName> = {
  normal: 'egg', golden: 'lightning', royal: 'box', magic: 'charm',
  diamond: 'lightning', mystery: 'box',
}
export const ITEM_SPRITE: Record<string, SpriteName> = {
  medicine: 'syringe', vitamin: 'pill', golden_feed: 'honey', growth_shot: 'rocket',
  xp_tonic: 'testtube', egg_charm: 'charm', scarecrow: 'pumpkin', feed_sack: 'wheat',
}
/** Which idle animation reads best per species. */
export const ANIM_FOR: Record<SpriteName, SpriteAnim> = {
  hen: 'peck', rooster: 'peck', turkey: 'idle', goose: 'idle',
  cow: 'idle', sheep: 'idle', duck: 'float', dog: 'wag', cat: 'idle', horse: 'idle',
  dragon: 'pulse', runner: 'peck', farmer: 'idle',
  egg: 'float', basket: 'idle', wheat: 'idle', honey: 'pulse',
  syringe: 'none', pill: 'none', testtube: 'pulse', charm: 'float', pumpkin: 'idle',
  box: 'idle', rocket: 'pulse', lightning: 'pulse', heart: 'pulse',
  barn: 'none', factory: 'none', crane: 'none', ruin: 'none', trafficlight: 'none',
}

export interface SpriteProps {
  name: SpriteName
  /** Rendered size in px (the viewBox is a 50x50 grid). */
  size?: number
  anim?: SpriteAnim
  /** Override the species palette, e.g. to tint a hen by trait. */
  palette?: SpritePalette
  /** Accessible name. Defaults to the sprite name. */
  label?: string
  /** Set when a visible text label already identifies the sprite. */
  decorative?: boolean
  className?: string
  /** Optional explicit animation-duration override, e.g. for fast loops. */
  durationMs?: number
}

export function Sprite({
  name, size = 32, anim = 'none', palette, decorative = false,
  label, className, durationMs,
}: SpriteProps) {
  const geo = GEOMETRY[name]
  const base = P[name] ?? P.hen
  const p: Required<SpritePalette> = { ...base, ...palette }
  const resolvedAnim = anim === 'none' ? 'none' : anim
  const style = {
    '--sprite-body': p.body,
    '--sprite-body-dark': p.bodyDark,
    '--sprite-belly': p.belly,
    '--sprite-accent': p.accent,
    '--sprite-accent-dark': p.accentDark,
    '--sprite-eye': p.eye,
    ...(durationMs ? ({ animationDuration: `${durationMs}ms` } as React.CSSProperties) : {}),
  } as React.CSSProperties

  // Unknown sprite: degrade to the emoji the game already used, never throw.
  if (!geo) {
    return (
      <span role={decorative ? 'presentation' : 'img'} aria-label={decorative ? undefined : (label ?? name)} style={{ fontSize: size, lineHeight: 1 }}>
        {EMOJI_FALLBACK[name] ?? '❔'}
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 50 50"
      width={size}
      height={size}
      className={cn('sprite shrink-0', resolvedAnim !== 'none' && `sprite-${resolvedAnim}`, className)}
      style={style}
      role={decorative ? 'presentation' : 'img'}
      aria-label={decorative ? undefined : (label ?? name)}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      {geo(p)}
    </svg>
  )
}

/**
 * Convenience wrapper for the common case: render whatever the game
 * currently uses for a type key, falling back to its emoji.
 *
 *   <TypeSprite kind="animal" typeKey={a.type} size={40} />
 */
export function TypeSprite({
  kind, typeKey, size, anim, label, decorative, className,
}: {
  kind: 'hen' | 'animal' | 'egg' | 'item'
  typeKey: string
  size?: number
  anim?: SpriteAnim
  label?: string
  decorative?: boolean
  className?: string
}) {
  const map = kind === 'hen' ? HEN_SPRITE
    : kind === 'animal' ? ANIMAL_SPRITE
    : kind === 'egg' ? EGG_SPRITE
    : ITEM_SPRITE
  const name = map[typeKey]
  if (!name) {
    return (
      <span role={decorative ? 'presentation' : 'img'} aria-label={decorative ? undefined : (label ?? typeKey)} style={{ fontSize: size ?? 20, lineHeight: 1 }}>
        ❔
      </span>
    )
  }
  return (
    <Sprite
      name={name}
      size={size}
      anim={anim ?? ANIM_FOR[name]}
      label={label ?? typeKey}
      decorative={decorative}
      className={className}
    />
  )
}
