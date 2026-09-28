#!/usr/bin/env node
/**
 * Second repair pass for the whitespace-stripping damage.
 *
 * The first tool (repair-glue.mjs) only fixed class tokens, and even those
 * incompletely: its shade pattern allowed 1-2 digits, so every standard
 * 3-digit Tailwind shade (stone-600, green-700, …) failed validation and
 * fused pairs like `font-boldtext-amber-800` were left behind.
 *
 * This pass handles all three damage shapes:
 *   1. JS keyword glue   `functionCoinPill`  -> `function CoinPill`
 *   2. JSX tag glue      `<h2className=`     -> `<h2 className=`
 *   3. class glue        `font-boldtext-…`   -> `font-bold text-…` (fixed shades)
 *
 * Safety: keyword/JSX repairs run on CODE regions only (string literals
 * and comments are masked first). The class tokenizer only splits a run
 * when it explodes ENTIRELY into vocabulary utilities, so prose, URLs and
 * identifiers are left alone. tsc error count is the oracle.
 *
 *   node scripts/repair-code-glue.mjs --dry    # report only
 *   node scripts/repair-code-glue.mjs          # apply
 */

import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'fs'

const DRY = process.argv.includes('--dry')
const report = []
let splitCount = 0

// ── Tailwind vocabulary (shades FIXED to 2-3 digits) ───────────
const FAMILIES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber',
  'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const SPECIAL = ['white', 'black', 'transparent', 'current', 'inherit', 'none', 'auto']
const SHADE = '(?:[0-9]{2,3}|\\[[^\\]]+\\])'
const COLOUR = `(?:${FAMILIES.join('|')}-${SHADE}|${SPECIAL.join('|')})`
const COP = '(?:/[0-9]{1,3})?' // Tailwind opacity modifier: bg-green-200/70
const NUM = '(?:px|0|0\\.5|1|1\\.5|2|2\\.5|3|3\\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|\\[[^\\]]+\\]|1\\/2|1\\/3|2\\/3|1\\/4|3\\/4|full|screen|auto|min|max|fit|dvh|svh|lvh)'
const TEXT_SIZE = '(?:\\[\\d+px\\]|xxs|xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)'

const UTILITIES = [
  `text-${TEXT_SIZE}`,
  `leading-(${NUM}|none|tight|snug|normal|relaxed|loose)`,
  `tracking-(${NUM}|tighter|tight|normal|wide|wider|widest)`,
  `font-(${NUM}|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)`,
  'truncate', 'italic', 'not-italic',
  'opacity-(0|5|10|15|20|25|30|35|40|45|50|55|60|65|70|75|80|85|90|95|100)', 'uppercase', 'lowercase', 'capitalize', 'normal-case',
  'underline', 'overline', 'line-through', 'no-underline',
  'tabular-nums', 'slashed-zero',
  `text-${COLOUR}' + COP + `,
  `bg-${COLOUR}' + COP + `,
  `border-${COLOUR}' + COP + `,
  `ring-${COLOUR}' + COP + `,
  `ring-offset-${COLOUR}`,
  `outline-${COLOUR}`,
  `decoration-${COLOUR}' + COP + `,
  `divide-${COLOUR}`,
  `placeholder-${COLOUR}`,
  `from-${COLOUR}' + COP + '`, `via-${COLOUR}' + COP + '`, `to-${COLOUR}' + COP + '`,
  `fill-${COLOUR}' + COP + '`, `stroke-${COLOUR}' + COP + '`, `accent-${COLOUR}`, `caret-${COLOUR}`,
  `border-(${NUM}|none)`,
  `border-x-(${NUM}|none)`, `border-y-(${NUM}|none)`,
  `border-t-(${NUM}|none)`, `border-r-(${NUM}|none)`, `border-b-(${NUM}|none)`, `border-l-(${NUM}|none)`,
  'rounded', 'rounded-none', 'rounded-full', 'rounded-sm', 'rounded-md', 'rounded-lg',
  'rounded-xl', 'rounded-2xl', 'rounded-3xl', `rounded-${NUM}`,
  'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-inner', 'shadow-none',
  `(?:px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|m|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|w|h|min-w|min-h|max-w|max-h|size|scroll-m)-${NUM}`,
  `flex-(${NUM}|1|auto|initial|none)`,
  `basis-${NUM}`,
  'flex', 'inline-flex', 'grid', 'inline-grid', 'block', 'inline-block', 'contents',
  'hidden', 'table', 'flow-root',
  `grid-cols-(${NUM}|none)`,
  `col-span-(full|${NUM})`,
  `row-span-(full|${NUM})`,
  `space-x-(${NUM})`, `space-y-(${NUM})`,
  'items-start', 'items-end', 'items-center', 'items-baseline', 'items-stretch',
  'justify-start', 'justify-end', 'justify-center', 'justify-between', 'justify-around', 'justify-evenly',
  'self-auto', 'self-start', 'self-end', 'self-center', 'self-stretch',
  'overflow-hidden', 'overflow-auto', 'overflow-scroll', 'overflow-visible', 'overflow-x-hidden', 'overflow-y-auto',
  'text-ellipsis', 'text-clip',
  'object-cover', 'object-contain', 'object-fill', 'object-none', 'object-scale-down',
  'aspect-auto', 'aspect-square', 'aspect-video',
  'z-(\\d+|auto)',
  'order-(\\d+|first|last|none)',
  'static', 'fixed', 'absolute', 'relative', 'sticky',
  'inset-0', 'inset-x-0', 'inset-y-0',
  'antialiased', 'subpixel-antialiased', 'invisible', 'visible',
  'cursor-pointer', 'cursor-default', 'cursor-not-allowed', 'cursor-grab',
  'select-none', 'select-text', 'select-all', 'select-auto',
  'pointer-events-none', 'pointer-events-auto',
  'resize', 'resize-none', 'resize-x', 'resize-y',
  'list-none', 'list-disc', 'list-decimal',
  'appearance-none',
  'transition', 'transition-none', 'transition-all', 'transition-colors', 'transition-opacity',
  'transition-transform', 'transition-shadow',
  'duration-(\\d+|75|100|150|200|300|500|700|1000)',
  'ease-linear', 'ease-in', 'ease-out', 'ease-in-out',
  'delay-(\\d+|75|100|150|200|300|500|700|1000)',
  'transform', 'transform-none', 'transform-gpu', 'transform-cpu',
  `scale-(${NUM}|50|75|90|95|100|105|110|125|150)`,
  `rotate-(${NUM}|0|45|90|180)`,
  `translate-x-(${NUM})`, `translate-y-(${NUM})`,
  `origin-(${NUM}|center|top|bottom|left|right)`,
  'animate-none', 'animate-spin', 'animate-ping', 'animate-pulse', 'animate-bounce',
  'blur-none', 'backdrop-blur-sm', 'backdrop-blur', 'backdrop-blur-md', 'backdrop-blur-lg', 'backdrop-blur-xl',
  'sr-only', 'not-sr-only', 'container', 'prose',
  'divide-x', 'divide-y', 'border-dashed', 'border-dotted', 'border-solid',
  'whitespace-nowrap', 'whitespace-pre-line', 'whitespace-pre-wrap', 'whitespace-normal',
  'break-words', 'break-all', 'break-normal',
  'align-middle', 'align-top', 'align-bottom',
  'first:mt-0', 'last:mb-0',
  'size-(\\d+|full)',
]

const VARIANT = '(?:[a-z-]+(?:-[a-z]+)?:)*'
const CORE = new RegExp(`^(?:${VARIANT})(?:${UTILITIES.join('|')})$`)
const isValid = (tok) => !!tok && CORE.test(tok)

function splitToken(tok) {
  for (let i = tok.length - 1; i > 0; i--) {
    if (isValid(tok.slice(0, i)) && isValid(tok.slice(i))) return [tok.slice(0, i), tok.slice(i)]
  }
  return null
}
function explode(tok) {
  const s = splitToken(tok)
  if (!s) return null
  return [...(explode(s[0]) ?? [s[0]]), ...(explode(s[1]) ?? [s[1]])]
}

// ── masking is layered so each repair sees the right text ─────
// 1. maskStrings: string literals become opaque placeholders. Runs first
//    so `//` inside strings (URLs, prose) can never read as a comment.
// 2. splitFusedComments runs on that stream: comments visible, strings safe.
// 3. maskComments: comment text becomes placeholders so code repairs
//    (keyword splits especially) can never touch prose.
// 4. repairCode runs. 5. unmask restores everything.
function maskStrings(src) {
  const parts = []
  const re = /('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.|\$\{(?:[^{}]|\{[^{}]*\})*\})*`)/g
  let last = 0, out = ''
  for (const m of src.matchAll(re)) {
    out += src.slice(last, m.index)
    const idx = parts.length
    parts.push(m[0])
    out += `\u0000${idx}\u0000`
    last = m.index + m[0].length
  }
  out += src.slice(last)
  return { masked: out, parts }
}
function maskComments(src, parts) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g
  let last = 0, out = ''
  for (const m of src.matchAll(re)) {
    out += src.slice(last, m.index)
    const idx = parts.length
    parts.push(m[0])
    out += `\u0000${idx}\u0000`
    last = m.index + m[0].length
  }
  out += src.slice(last)
  return out
}
// ── fused-comment splitter ────────────────────────────────
// Newlines between `//` comment lines and code were stripped in places,
// so whole statements now hide inside trailing comments:
//   `// prose. letW = canvas.clientWidth …`
// Only CERTAIN splits are automated: inner-`//` continuation markers,
// sentence-end + statement keyword, and declaration/if/for/return/await
// statement starts. Ambiguous prose/code glue is left for hand-fix
// (tsc's "cannot find name" errors point at those lines).
const STMT = '(?:let|const|var|if|for|while|return|await|async|function|new|switch|else|try|catch|finally|do)'
function splitFusedComments(masked, file) {
  const lines = masked.split('\n')
  const out = []
  for (const line of lines) {
    // first // outside strings (strings are masked; skip :// hits)
    const idx = line.search(/(?<!:)\/\//)
    if (idx === -1) { out.push(line); continue }
    const prefix = line.slice(0, idx)
    const rest = line.slice(idx)
    const chunks = rest.split(/(?<!:)\/\//)
    // chunks[0] is '' (rest starts with //); drop it
    const segs = chunks.slice(1)
    if (segs.length === 0) { out.push(line); continue }
    const indent = (prefix.match(/^\s*/) || [''])[0]
    if (prefix.trim() !== '') out.push(prefix)
    const last = segs.length - 1
    let pendingCode = null
    segs.forEach((seg, i) => {
      const norm = '//' + (seg.startsWith(' ') || seg === '' ? seg : ' ' + seg)
      if (i < last) { out.push(indent + norm); return }
      // last segment: maybe prose + code
      // sentence-end split: conservative — declarations need their `=` and
      let m = seg.match(/^(.*[.!?]\s+)(?=(?:(?:let|const|var)(?=[A-Z]|\s+[A-Za-z_$][\w$]*\s*=[^=])|if\s*\(|for\s*\(|while\s*\(|return(?=[A-Z])|await\s+[A-Z]|function(?=[A-Z])|new\s+[A-Z]))/)
      // control flow needs its paren, so explanatory prose rarely matches.
      if (!m) m = seg.match(/^(.*?[\s;{}(])(?=(?:(?:let|const|var)(?=[A-Z]|[\s]+[A-Za-z_$])|if\s*\(|for\s*\(|while\s*\(|return(?=[A-Z])|await\s+[A-Za-z]|async\s+function\b|function(?=[A-Z]|\s+[A-Za-z])|new\s+[A-Z]))/)
      if (m) {
        out.push(indent + '//' + (m[1].startsWith(' ') || m[1] === '' ? m[1] : ' ' + m[1]).replace(/\s+$/, ''))
        pendingCode = seg.slice(m[1].length)
      } else {
        out.push(indent + norm)
      }
    })
    if (pendingCode) out.push(indent + pendingCode)
  }
  return out.join('\n')
}

function unmask(src, parts) {
  return src.replace(/\u0000(\d+)\u0000/g, (_, i) => parts[Number(i)])
}

// ── code-region repairs ────────────────────────────────────────
const WORD = '[A-Za-z0-9_$]'
const NOT_BEFORE = `(?<![A-Za-z0-9_$])`

function repairCode(code, file) {
  let n = 0
  const fix = (re, rep, tag) => {
    code = code.replace(re, (...a) => {
      n++
      if (report.length < 80) report.push(`${file}: [${tag}] ${a[0].slice(0, 44)}`)
      return typeof rep === 'function' ? rep(...a) : rep
    })
  }

  // 1. reserved-word glue — the word is reserved so `wordX` can never be
  //    a real identifier; the split is always correct.
  fix(new RegExp(`${NOT_BEFORE}function(?=[A-Za-z][A-Za-z0-9_$])`, 'g'), 'function ', 'kw')
  fix(new RegExp(`${NOT_BEFORE}(const|let|var)(?=[A-Z][A-Za-z0-9_$])`, 'g'), (...a) => `${a[1]} `, 'kw')
  fix(new RegExp(`${NOT_BEFORE}(const|let|var)(?=\\[)`, 'g'), (...a) => `${a[1]} `, 'kw')
  fix(new RegExp(`${NOT_BEFORE}return(?=[A-Za-z][A-Za-z0-9_$])`, 'g'), (m) => {
    // `returnCELL = …` was `return` + newline + `CELL = …` (bare return),
    // not `return CELL = …` (which would return the assignment).
    return m === 'returnCELL' ? 'return; CELL' : 'return '
  }, 'kw')
  fix(new RegExp(`${NOT_BEFORE}new(?=[A-Z][A-Za-z0-9_$]*\\()`, 'g'), 'new ', 'kw')
  fix(new RegExp(`${NOT_BEFORE}await(?=[A-Za-z][A-Za-z0-9_$]*)`, 'g'), 'await ', 'kw')
  // Reserved-word glue. Guarded: these words are also the first half of
  // real identifiers (typeKey, defaultValue, extendsHelper), so the
  // following token must be a space or a declaration punctuation.
  fix(new RegExp(`${NOT_BEFORE}(import|export|default|interface|type|extends)(?=[A-Z][A-Za-z0-9_$]*(?:\\s|[=<{(:,]|\\[))`, 'g'), (...a) => `${a[1]} `, 'kw')
  fix(new RegExp(`${NOT_BEFORE}else(?=[A-Za-z][A-Za-z0-9_$])`, 'g'), 'else ', 'kw')
  fix(new RegExp(`${NOT_BEFORE}typeof(?=[A-Za-z][A-Za-z0-9_$]*)`, 'g'), 'typeof ', 'kw')
  fix(new RegExp(`${NOT_BEFORE}instanceof(?=[A-Za-z][A-Za-z0-9_$]*)`, 'g'), 'instanceof ', 'kw')
  fix(new RegExp(`${NOT_BEFORE}delete(?=[A-Za-z][A-Za-z0-9_$]*)`, 'g'), 'delete ', 'kw')
  fix(new RegExp(`(?<![A-Za-z0-9_$\\[-])(const|let|var)(?=[a-z][A-Za-z0-9_$]*\\s*=[^=])`, 'g'), (...a) => `${a[1]} `, 'kw=')

  // 1b. type-annotation glue — `;` separators were stripped inside
  // object/interface type literals: `stringclassName?:` was
  // `string; className?:`. The leading keyword is a reserved type name so
  // `Type+name:` can never be a real annotation; every observed match is
  // a fused `Type; name:` pair (verified by enumeration before applying).
  fix(new RegExp(`${NOT_BEFORE}(React\\.ReactNode|string|number|boolean|void|any|unknown|never)([a-z][A-Za-z0-9_$]*\\??:)`, 'g'), (...a) => `${a[1]}; ${a[2]}`, 'typ')

  // 2. JSX tag glue — tag followed immediately by an attribute name.
  const HTML_ATTR = '(?:className|on[A-Z]|htmlFor|tabIndex|readOnly|autoFocus|srcSet|crossOrigin|referrerPolicy|aria-[a-z]+|data-[a-z]+|role=|id=|key=|ref=|style=|href=|src=|alt=|title=|type=|value=|checked|disabled|placeholder=|name=|width=|height=|colSpan=|rowSpan=)'
  const HTML_TAG = '(?:div|span|button|textarea|select|input|label|form|table|thead|tbody|main|nav|header|footer|section|article|aside|h1|h2|h3|h4|tr|td|th|ul|ol|li|img|canvas|video|strong|small|code|pre|a)'
  fix(new RegExp(`<(${HTML_TAG})(?=${HTML_ATTR})`, 'g'), (...a) => `<${a[1]} `, 'jsx')
  fix(new RegExp(`<(motion\.[A-Za-z]+)(?=(?:initial=|animate=|exit=|transition=|while[A-Z]|variants?=|layout|drag|style=|className))`, 'g'), (...a) => `<${a[1]} `, 'jsx')
  fix(new RegExp(`<([A-Z][A-Za-z0-9_]*)(?=${HTML_ATTR})`, 'g'), (...a) => `<${a[1]} `, 'jsx')
  // svg tags last: `<text` must not steal `<textarea`.
  fix(new RegExp(`<(svg|path|circle|rect|ellipse|line|polyline|polygon|g|text|defs|clipPath|stop|use)(?=[a-z]+=)`, 'g'), (...a) => `<${a[1]} `, 'jsx')

  splitCount += n
  return code
}

// ── string-region repair: class glue only ─────────────────────
function repairString(str, file) {
  return str.replace(/[A-Za-z0-9_\-:\/\[\]\.\%#]+/g, (tok) => {
    if (isValid(tok)) return tok
    const parts = explode(tok)
    if (!parts) return tok
    splitCount++
    if (report.length < 80) report.push(`${file}: [cls] ${tok} -> ${parts.join(' ')}`)
    return parts.join(' ')
  })
}

const files = globSync('src/**/*.tsx')
let touched = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // 'useclient' directive (exact string, anywhere)
  let working = src.replace(/'useclient'/g, "'use client'")
  const sm = maskStrings(working)
  const parts = sm.parts
  const decommented = splitFusedComments(sm.masked, f)
  const fullyMasked = maskComments(decommented, parts)
  const repairedCode = repairCode(fullyMasked, f)
  // repair strings individually so the class tokenizer sees real text
  const repairedParts = parts.map(p => {
    if (/^'use client'$/.test(p)) return p
    if (/^\/\//.test(p) || /^\/\*/.test(p)) return p
    if (/^['"`]/.test(p)) return repairString(p, f)
    return p
  })
  const out = unmask(repairedCode, repairedParts)
  if (out !== src) {
    touched++
    if (!DRY) writeFileSync(f, out)
  }
}

console.log(DRY ? 'DRY RUN —' : 'APPLIED —')
console.log(`${splitCount} repair(s) across ${touched} file(s)\n`)
console.log(report.join('\n'))
if (report.length >= 80) console.log(`\n… and more (capped at 80 shown)`)
