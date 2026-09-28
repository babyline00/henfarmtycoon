#!/usr/bin/env node
/**
 * Repair pass for class-name / JSX glue damage.
 *
 * Context: an earlier automated colour edit stripped whitespace inside
 * className strings, fusing adjacent utilities into single invalid tokens
 * (`bg-stone-200text-stone-600`, `text-whiteshadow`, `font-extraboldactive:scale-95`)
 * and fusing JSX attributes onto tag names (`<spanclassName=`).
 * No content was lost — only the separators. This restores them.
 *
 * Strategy: tokenize each run of "class-like" characters with a longest-match
 * tokenizer over a Tailwind utility vocabulary. Anything the tokenizer cannot
 * split is left untouched and reported, so failures are visible rather than
 * silently mangled.
 *
 *   node scripts/repair-glue.mjs            # apply
 *   node scripts/repair-glue.mjs --dry      # report only
 */

import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'fs'

const DRY = process.argv.includes('--dry')

// ── colour families (Tailwind v4 default names) ──────────────
const FAMILIES = [
  'slate','gray','zinc','neutral','stone','red','orange','amber','yellow',
  'lime','green','emerald','teal','cyan','sky','blue','indigo','violet',
  'purple','fuchsia','pink','rose',
]
// non-palette colour tokens
const SPECIAL = ['white','black','transparent','current','inherit','none','auto']
// numeric shade range
const SHADE = '(?:[0-9]{1,2}|\\[[^\\]]+\\])'

const COLOUR = `(?:${FAMILIES.join('|')}-${SHADE}|${SPECIAL.join('|')})`

// ── sizing / spacing scales ──────────────────────────────────
const SPACING = '(?:px?|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|m|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|w|h|min-w|min-h|max-w|max-h|size|scroll-m)'
const NUM = '(?:px|0|0\\.5|1|1\\.5|2|2\\.5|3|3\\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|\\[[^\\]]+\\]|1\\/2|1\\/3|2\\/3|1\\/4|3\\/4|full|screen|auto|min|max|fit|dvh|svh|lvh)'
const FRAC = '(?:\\d+\\/\\d+)'
const TEXT_SIZE = '(?:\\[\\d+px\\]|xxs|xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)'

// ── the vocabulary ───────────────────────────────────────────
const UTILITIES = [
  // typography
  `text-${TEXT_SIZE}`,
  `leading-(${NUM}|none|tight|snug|normal|relaxed|loose)`,
  `tracking-(${NUM}|tighter|tight|normal|wide|wider|widest)`,
  `font-(${NUM}|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)`,
  'truncate','italic','not-italic','uppercase','lowercase','capitalize','normal-case',
  'underline','overline','line-through','no-underline',
  'tabular-nums','slashed-zero','ordinal','line-clamp-none',
  // colour
  `text-${COLOUR}`,
  `bg-${COLOUR}`,
  `border-${COLOUR}`,
  `border-[a-z]+-${COLOUR}`,
  `ring-${COLOUR}`,
  `ring-offset-${COLOUR}`,
  `outline-${COLOUR}`,
  `decoration-${COLOUR}`,
  `divide-${COLOUR}`,
  `placeholder-${COLOUR}`,
  `from-${COLOUR}`, `via-${COLOUR}`, `to-${COLOUR}`,
  `fill-${COLOUR}`, `stroke-${COLOUR}`, `accent-${COLOUR}`, `caret-${COLOUR}`,
  // borders
  `border-(${NUM}|none)`,
  `border-x-(${NUM}|none)`,`border-y-(${NUM}|none)`,
  `border-t-(${NUM}|none)`,`border-r-(${NUM}|none)`,`border-b-(${NUM}|none)`,`border-l-(${NUM}|none)`,
  'rounded','rounded-none','rounded-full','rounded-sm','rounded-md','rounded-lg','rounded-xl',
  'rounded-2xl','rounded-3xl',`rounded-${NUM}`,
  'shadow(-|sm|md|lg|xl|2xl|inner|none)',
  // layout
  `${SPACING}-${NUM}`,
  `flex-(${NUM}|1|auto|initial|none)`,
  `basis-${NUM}`,
  'flex','inline-flex','grid','inline-grid','block','inline-block','contents',
  'hidden','table','flow-root',
  `grid-cols-(${FRAC}|none|${NUM})`,
  `col-span-(${FRAC}|full|${NUM})`,
  `row-span-(${FRAC}|full|${NUM})`,
  `gap-(${NUM}|${FRAC}|px|px-2|px-4|px-6|px-8)`,
  `gap-x-(${NUM}|${FRAC})`,`gap-y-(${NUM}|${FRAC})`,
  `space-x-(${NUM}|${FRAC})`,`space-y-(${NUM}|${FRAC})`,
  'items-start','items-end','items-center','items-baseline','items-stretch',
  'justify-start','justify-end','justify-center','justify-between','justify-around','justify-evenly',
  'self-auto','self-start','self-end','self-center','self-stretch',
  'place-content-center','place-items-center',
  'overflow-hidden','overflow-auto','overflow-scroll','overflow-visible','overflow-x-hidden','overflow-y-auto',
  'truncate','text-ellipsis','text-clip',
  'object-cover','object-contain','object-fill','object-none','object-scale-down',
  'aspect-auto','aspect-square','aspect-video',
  'z-(\\d+|auto)','z-\\[\\d+\\]',
  'order-(\\d+|first|last|none)','order-\\[\\d+\\]',
  // position
  'static','fixed','absolute','relative','sticky',
  'inset-0',`inset-x-0`,`inset-y-0`,`${SPACING}-${NUM}`,
  // display / misc
  'antialiased','subpixel-antialiased','invisible','visible','collapse',
  'cursor-pointer','cursor-default','cursor-not-allowed','cursor-grab','cursor-grabbing',
  'select-none','select-text','select-all','select-auto',
  'pointer-events-none','pointer-events-auto',
  'resize','resize-none','resize-x','resize-y',
  'list-none','list-disc','list-decimal',
  'appearance-none','appearance-auto',
  'transition','transition-none','transition-all','transition-colors','transition-opacity',
  'transition-transform','transition-shadow','transition-none',
  'duration-(\\d+|75|100|150|200|300|500|700|1000)',
  'ease-linear','ease-in','ease-out','ease-in-out',
  'delay-(\\d+|75|100|150|200|300|500|700|1000)',
  'transform','transform-none','transform-gpu','transform-cpu',
  `scale-(${NUM}|50|75|90|95|100|105|110|125|150)`,
  `rotate-(${NUM}|0|45|90|180)`,
  `translate-x-(${NUM})`,`translate-y-(${NUM})`,
  `origin-(${NUM}|center|top|bottom|left|right)`,
  'animate-(none|spin|ping|pulse|bounce|flash|marquee)',
  'blur-none','backdrop-blur-sm','backdrop-blur','backdrop-blur-md','backdrop-blur-lg',
  'backdrop-blur-xl','backdrop-grayscale','backdrop-brightness-50',
  // semantics
  'sr-only','not-sr-only','container','prose','truncate',
  'divide-x','divide-y','divide-x-2','divide-y-2','divide-dashed',
  'border-dashed','border-dotted','border-solid','border-double',
  'whitespace-nowrap','whitespace-pre-line','whitespace-pre-wrap','whitespace-normal',
  'break-words','break-all','break-normal','break-keep',
  'uppercase','lowercase','align-middle','align-top','align-bottom',
  'tabular-nums','first:mt-0','last:mb-0',
]

// variants may prefix any utility
const VARIANT = '(?:[a-z-]+(?:-[a-z]+)?:)*'
const CORE = new RegExp(`^(?:${VARIANT})(?:${UTILITIES.join('|')})$`)

// JSX attribute names that can get glued onto a tag name
const ATTR = /(className|onClick|onChange|onSubmit|onKeyDown|onFocus|onBlur|href|src|alt|title|role|type|value|checked|disabled|readOnly|placeholder|id|key|ref|style|rows|cols|step|max|min|maxLength|autoFocus|tabIndex|htmlFor|ariaLabel|viewBox|fillRule|strokeWidth|strokeLinecap|preserveAspectRatio|xmlns|xlinkHref|data-testid|srcSet|loading|decoding|crossOrigin|referrerPolicy|rel|target|download|name|content|variant|size|color|as|asChild|open|defaultOpen|defaultChecked|checked)(?==)/

let report = []

function isValid(tok) {
  if (!tok) return false
  if (tok.includes('/') && !/^\w[\w-]*\/[\w-]+$/.test(tok)) return false
  return CORE.test(tok)
}

/** Longest-prefix split of a single fused token. */
function splitToken(tok) {
  for (let i = tok.length - 1; i > 0; i--) {
    const a = tok.slice(0, i)
    const b = tok.slice(i)
    if (isValid(a) && isValid(b)) return [a, b]
  }
  return null
}

/** Recursively split a fused token into as many valid utilities as possible. */
function explode(tok) {
  const s = splitToken(tok)
  if (!s) return null
  const left = explode(s[0]) ?? [s[0]]
  const right = explode(s[1]) ?? [s[1]]
  return [...left, ...right]
}

// characters that may appear inside a class token
const TOKEN_CHARS = /[A-Za-z0-9_\-:\/\[\]\.\%#]/y

/** Walk the source, joining/splitting only inside className-ish regions. */
function repairSrc(src, file) {
  // 1. JSX attribute glue:  <spanclassName=  ->  <span className=
  let out = src.replace(/([a-zA-Z])(className|onClick|onChange|onKeyDown|onFocus|onBlur|onSubmit|htmlFor|tabIndex|readOnly|autoFocus|srcSet|crossOrigin|referrerPolicy)(?==)/g,
    (m, a, b) => `${a} ${b}`)
  out = out.replace(/(['"])(className|onClick|onChange|onKeyDown|onFocus|onBlur|onSubmit|htmlFor|tabIndex|readOnly|autoFocus)(['"])(?=\s*:\s*)/g,
    (m, q1, a, q2) => `${q1} ${a} ${q2}`)

  // 2. class-token glue
  let changed = 0
  out = out.replace(/[A-Za-z0-9_\-:\/\[\]\.\%#]+/g, (tok) => {
    if (isValid(tok)) return tok
    const parts = explode(tok)
    if (!parts) return tok
    changed++
    report.push(`${file}: ${tok}  ->  ${parts.join(' ')}`)
    return parts.join(' ')
  })

  return { out, changed }
}

const files = globSync('src/**/*.tsx')
let total = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const { out, changed } = repairSrc(src, f)
  if (out !== src) {
    total += changed
    if (!DRY) writeFileSync(f, out)
  }
}

console.log(DRY ? 'DRY RUN —' : 'APPLIED —')
console.log(`${total} fused token(s) split across ${files.length} file(s)\n`)
console.log(report.slice(0, 60).join('\n'))
if (report.length > 60) console.log(`\n… and ${report.length - 60} more`)
