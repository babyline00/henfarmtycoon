#!/usr/bin/env node
/**
 * Download the animal voice clips.
 *
 * Everything else in this project is synthesised at runtime, but animal
 * calls are the one place where synthesis cannot compete: a procedural
 * "moo" is recognisable as *a low vocalisation*, not as a cow. So the
 * species voices are real recordings, and everything else (UI clicks,
 * coins, the entire soundtrack) stays synthetic.
 *
 * Source: Mixkit free sound effects, under the Mixkit Sound Effects Free
 * License — free for commercial use, no attribution required, no
 * redistribution as a standalone collection. The exact terms are
 * recorded in public/sounds/animals/CREDITS.md, which this script writes,
 * so the provenance of every shipped file is on disk rather than in
 * someone's memory.
 *
 *   bun run scripts/fetch-animal-sounds.mjs
 *
 * Idempotent: existing, non-empty files are skipped, so re-running after
 * adding an entry to MANIFEST only fetches what is new.
 */
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const OUT_ROOT = 'public/sounds/animals'
const UA = 'Mozilla/5.0 (X11; Linux x86_64) henfarm-tycoon/1.0'

/**
 * slot -> where it plays in the game. `null` means "no recording available
 * from this source", and the runtime falls back to the synth voice.
 */
const MANIFEST = [
  // ── cow ──
  { species: 'cow', slot: 'cow', id: 1744, title: 'Cow moo' },
  { species: 'cow', slot: 'cow_low', id: 1752, title: 'Cow sick moo' },
  { species: 'cow', slot: 'cow_moo_barn', id: 1751, title: 'Cow moo in the barn' },
  { species: 'cow', slot: 'cow_moo_many', id: 1750, title: 'Multiple moo in the barn' },

  // ── sheep ──
  { species: 'sheep', slot: 'sheep', id: 1741, title: 'Sheep sounds' },

  // ── duck ──
  { species: 'duck', slot: 'duck', id: 1014, title: 'Rubber duck squeak' },

  // ── dog ──
  { species: 'dog', slot: 'dog', id: 1, title: 'Dog barking twice' },
  { species: 'dog', slot: 'dog_growl', id: 53, title: 'Angry and agitated dog growling' },
  { species: 'dog', slot: 'dog_whine', id: 466, title: 'Dog whimper sad' },

  // ── cat ──
  { species: 'cat', slot: 'cat', id: 93, title: 'Sweet kitty meow' },
  { species: 'cat', slot: 'cat_purr', id: 96, title: 'Big wild cat long purr' },
  { species: 'cat', slot: 'cat_meow_cartoon', id: 91, title: 'Cartoon little cat meow' },

  // ── horse ──
  { species: 'horse', slot: 'horse', id: 85, title: 'Scared horse neighing' },
  { species: 'horse', slot: 'horse_whinny', id: 1762, title: 'Stallion horse neigh' },
  { species: 'horse', slot: 'horse_snort', id: 80, title: 'Hard big horse snort' },

  // ── dragon ──
  { species: 'dragon', slot: 'dragon', id: 16, title: 'Big dragon in the wild roar' },
  { species: 'dragon', slot: 'dragon_growl', id: 309, title: 'Angry dragon growl' },
  { species: 'dragon', slot: 'dragon_roar_echo', id: 1727, title: 'Angry dragon roar echo' },
  { species: 'dragon', slot: 'dragon_fire', id: 2230, title: 'Fire breathing dragon' },

  // ── chicken / hen ──
  { species: 'hen', slot: 'hen_normal', id: 1772, title: 'Chickens clucking short' },
  { species: 'hen', slot: 'hen_golden', id: 1768, title: 'Chicken hens clucking' },
  { species: 'hen', slot: 'rooster', id: 2462, title: 'Rooster crowing in the morning' },
  { species: 'hen', slot: 'rooster_short', id: 2470, title: 'Short rooster crowing' },

  // ── soundscape ──
  // Deliberately short clips only. The long ambience loops on Mixkit are
  // 1.2-6.4 MB each, which is a brutal download to ask a phone for a
  // background texture that plays once in a while — the synthesised bird
  // and wind voices cost nothing and are fine for that job. What a
  // recording genuinely buys over synthesis is a *recognisable animal*,
  // so that is where the bytes are spent.
  { species: 'ambience', slot: 'bird', id: 65, title: 'Little birds in the wild chirping' },
  { species: 'ambience', slot: 'cricket', id: 1780, title: 'Single cricket screech' },
]

/** Refuse anything larger than this. Keeps the worst-case payload sane. */
const MAX_BYTES = 700 * 1024

const LICENSE = {
  source: 'Mixkit — mixkit.co/free-sound-effects/',
  license: 'Mixkit Sound Effects Free License',
  url: 'https://mixkit.co/license/#sfxFree',
  terms: [
    'Free for use in commercial and non-commercial projects.',
    'No attribution required.',
    'Cannot be distributed as a standalone collection of sounds.',
    'Cannot be resold or redistributed on its own.',
  ],
}

function urlFor(id) {
  return `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`
}

function pageUrl(id) {
  return `https://mixkit.co/free-sound-effects/${id}/`
}

async function exists(path) {
  try { const s = await stat(path); return s.size > 1024 } catch { return false }
}

async function download(entry) {
  const dir = join(OUT_ROOT, entry.species)
  const file = join(dir, `${entry.slot}.mp3`)
  if (await exists(file)) {
    console.log(`  · ${entry.species}/${entry.slot}.mp3 already present`)
    return { ...entry, file: `sounds/animals/${entry.species}/${entry.slot}.mp3`, bytes: (await stat(file)).size, cached: true }
  }
  await mkdir(dir, { recursive: true })
  const res = await fetch(urlFor(entry.id), { headers: { 'User-Agent': UA, Referer: 'https://mixkit.co/' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  // A 1x1 GIF or an HTML error page is the classic silent failure here, so
  // check we really got audio before writing it to disk.
  if (buf.length < 1024) throw new Error(`suspiciously small (${buf.length} bytes)`)
  const isMp3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33 // 'ID3'
    || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)              // MPEG frame sync
  if (!isMp3) throw new Error(`not an MP3 (magic ${buf.subarray(0, 3).toString('hex')})`)
  if (buf.length > MAX_BYTES) {
    throw new Error(`${(buf.length / 1024 / 1024).toFixed(1)} MB exceeds the ${MAX_BYTES / 1024} KB ceiling`)
  }
  await writeFile(file, buf)
  console.log(`  ✓ ${entry.species}/${entry.slot}.mp3  ${(buf.length / 1024).toFixed(0)} KB  (${entry.title})`)
  return { ...entry, file: `sounds/animals/${entry.species}/${entry.slot}.mp3`, bytes: buf.length, cached: false }
}

async function writeCredits(downloaded) {
  const bySpecies = new Map()
  for (const d of downloaded) {
    if (!bySpecies.has(d.species)) bySpecies.set(d.species, [])
    bySpecies.get(d.species).push(d)
  }
  let md = `# Animal sound credits

These are the only audio *files* in this project. Everything else — UI
cues, coins, hatching, the whole soundtrack — is synthesised at runtime by
\`src/lib/sfx.ts\` and \`src/lib/music.ts\`.

## Licence

All clips below come from **${LICENSE.source}** under the
**${LICENSE.license}**:

<${LICENSE.url}>

${LICENSE.terms.map(t => `- ${t}`).join('\n')}

## Files

`
  for (const [species, items] of [...bySpecies].sort()) {
    md += `### ${species}\n\n| file | recording | length | source id |\n|---|---|---|---|\n`
    for (const it of items.sort((a, b) => a.slot.localeCompare(b.slot))) {
      md += `| \`${it.file}\` | ${it.title} | ${(it.bytes / 1024).toFixed(0)} KB | [${it.id}](${pageUrl(it.id)}) |\n`
    }
    md += '\n'
  }
  md += 'Regenerate with `bun run scripts/fetch-animal-sounds.mjs`.\n'
  await writeFile(join(OUT_ROOT, 'CREDITS.md'), md)
  console.log(`\n  wrote ${OUT_ROOT}/CREDITS.md`)
}

async function main() {
  console.log(`Fetching ${MANIFEST.length} animal clips…\n`)
  const ok = []
  const failed = []
  for (const entry of MANIFEST) {
    try {
      ok.push(await download(entry))
    } catch (e) {
      console.log(`  ✗ ${entry.species}/${entry.slot} — ${e.message}`)
      failed.push({ ...entry, error: e.message })
    }
  }
  await writeCredits(ok)

  // Anything the runtime maps to a slot that has no file falls back to the
  // synth voice, so a partial fetch is not a broken build.
  console.log(`\n${ok.length} available, ${failed.length} unavailable (those slots fall back to synthesis).`)
  if (failed.length) {
    console.log('Unavailable slots:')
    for (const f of failed) console.log(`  - ${f.species}/${f.slot} (${f.title})`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
