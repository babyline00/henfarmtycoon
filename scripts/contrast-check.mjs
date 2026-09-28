#!/usr/bin/env node
// Static WCAG contrast audit.
//
// Lighthouse flags contrast on rendered pixels, but the browser tooling in
// this environment cannot return computed values, so this walks the
// Tailwind class strings in the source instead and computes the ratio for
// every `text-*` + `bg-*` pair that appears in the same className.
//
//   node scripts/contrast-check.mjs
//
// Caveat: it only sees explicit bg-* utilities. Elements that inherit a
// background from an ancestor are reported as "inherited" and need manual
// review. Colours are the Tailwind v4 default palette (oklch-authored,
// but these hex values match the generated CSS).

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Tailwind default palette (stone/green/lime/amber/red/pink/sky/purple/
// emerald/white/black) for the steps this codebase actually uses.
const T = {
  white: '#ffffff',
  black: '#000000',
  stone: { 50:'#fafaf9',100:'#f5f5f4',200:'#e7e5e4',300:'#d6d3d1',400:'#a8a29e',500:'#78716c',600:'#57534e',700:'#44403c',800:'#292524',900:'#1c1917' },
  green:{ 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d' },
  lime: { 50:'#f7fee7',100:'#ecfccb',200:'#d9f99d',300:'#bef264',400:'#a3e635',500:'#84cc16',600:'#65a30d',700:'#4d7c0f',800:'#3f6212',900:'#365314' },
  amber:{ 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f' },
  red:  { 50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d' },
  pink: { 50:'#fdf2f8',100:'#fce7f3',200:'#fbcfe8',300:'#f9a8d4',400:'#f472b6',500:'#ec4899',600:'#db2777',700:'#be185d',800:'#9d174d',900:'#831843' },
  sky:  { 50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e' },
  purple:{50:'#faf5ff',100:'#f3e8ff',200:'#e9d5ff',300:'#d8b4fe',400:'#c084fc',500:'#a855f7',600:'#9333ea',700:'#7e22ce',800:'#6b21a8',900:'#581c87' },
  emerald:{50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b' },
  slate:{ 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a' },
  orange:{50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12' },
}

function hex(c) {
  if (c === 'white') return T.white
  if (c === 'black') return T.black
  const m = c.match(/^([a-z]+)-(\d+)$/)
  if (!m) return null
  const fam = T[m[1]]
  return fam && fam[m[2]] ? fam[m[2]] : null
}

function lum(h) {
  const n = h.replace('#', '')
  const v = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(x => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)))
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}

function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

// text-<color>, bg-<color>, plus the text size token (xxs|xs|sm|base|lg…)
const SIZE_PX = { '8px':8, '9px':9, '10px':10, '11px':11, 'xs':12, 'sm':14, 'base':16, 'lg':18, 'xl':20, '2xl':24, '3xl':30 }
const textSizeRe = /text-\[(\d+)px\]|text-(xxs|xs|sm|base|lg|xl|\d?xl)/

function sizeOf(cls) {
  const m = cls.match(textSizeRe)
  if (!m) return { px: 16, bold: false }
  if (m[1]) return { px: Number(m[1]), bold: false }
  const token = m[2]
  return { px: SIZE_PX[token] ?? 16, bold: false }
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(f)) out.push(p)
  }
  return out
}

const files = process.argv[2] ? [process.argv[2]] : walk('src')
const findings = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // every quoted className string
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{cn\(([\s\S]{0,400}?)\)\})/g)) {
    const raw = m[1] || m[2]
    const textMatch = raw.match(/text-([a-z]+-\d{2,3}|white|black)\b/)
    const bgMatch = raw.match(/bg-([a-z]+-\d{2,3}|white|black)\b/)
    if (!textMatch) continue
    const fg = hex(textMatch[1])
    if (!fg) continue
    const { px } = sizeOf(raw)
    const bold = /font-(black|bold|extrabold|900|800|700)/.test(raw)
    const large = px >= 24 || (px >= 18.66 && bold)
    const need = large ? 3 : 4.5
    if (!bgMatch) {
      findings.push({ file, fg, bg: 'inherited', r: null, need, px, raw: raw.slice(0, 70) })
      continue
    }
    const bg = hex(bgMatch[1])
    if (!bg) continue
    const r = ratio(fg, bg)
    if (r < need) findings.push({ file, fg, bg, r, need, px, raw: raw.slice(0, 70) })
  }
}

// report only definite failures; inherited-background cases are advisory
const hard = findings.filter(f => f.r !== null).sort((a, b) => a.r - b.r)
const soft = findings.filter(f => f.r === null)

console.log('\nWCAG contrast audit (static, from Tailwind class strings)\n')
console.log(`Definite failures (explicit bg-* in the same className): ${hard.length}`)
for (const f of hard) {
  const line = srcLine(f.file, f.raw)
  console.log(`  ${f.r.toFixed(2)} (need ${f.need})  ${f.fg} on ${f.bg}  ${f.px}px  ${f.file}:${line}`)
}
console.log(`\nAdvisory (inherits a background from an ancestor — verify manually): ${soft.length}`)
const byFg = {}
for (const f of soft) {
  const k = `text-${f.fg}`
  byFg[k] = (byFg[k] || 0) + 1
}
for (const [k, n] of Object.entries(byFg).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}x  ${k}`)
}

function srcLine(file, needle) {
  try {
    const lines = readFileSync(file, 'utf8').split('\n')
    const i = lines.findIndex(l => l.includes(needle.slice(0, 40)))
    return i + 1
  } catch { return '?' }
}
