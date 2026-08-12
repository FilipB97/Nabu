/**
 * Krok 01 — pobranie źródeł. Sekcja 10.1 planu.
 *
 * Pobieramy eksporty per język, nie pełne zrzuty Tatoeby: `spa_sentences` waży 6 MB,
 * a pełne `sentences.tar.bz2` 150 MB i zawiera 400 języków, z których potrzebujemy
 * dwóch. To samo z powiązaniami — Tatoeba wystawia je per para języków.
 *
 * Wszystko idzie na laptopa, nie do przeglądarki, więc problem CORS znika.
 */

import { downloadBz2 } from './lib/io.ts'
import { adapterFor } from '../src/langs/index.ts'

const TATOEBA = 'https://downloads.tatoeba.org/exports/per_language'
const FREQ = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018'

/** Kod docelowy tłumaczeń — cała aplikacja tłumaczy na polski. */
export const POL = 'pol'
/** Kod języka pośredniczącego przy tłumaczeniach niebezpośrednich. */
export const ENG = 'eng'

export type Sources = {
  sentences: string
  polish: string
  directLinks: string
  pivotLinks: string
  pivotToPolish: string
  frequency: string
}

/** Pobiera komplet źródeł dla jednego języka i zwraca ścieżki w cache. */
export async function fetchSources(lang: string): Promise<Sources> {
  const adapter = adapterFor(lang)
  const code = adapter.tatoeba

  console.log(`\n[01-fetch] ${adapter.name} (${code})`)

  const sentences = await downloadBz2(
    `${TATOEBA}/${code}/${code}_sentences.tsv.bz2`,
    `${code}_sentences.tsv`,
  )
  const polish = await downloadBz2(
    `${TATOEBA}/${POL}/${POL}_sentences.tsv.bz2`,
    `${POL}_sentences.tsv`,
  )
  const directLinks = await downloadBz2(
    `${TATOEBA}/${code}/${code}-${POL}_links.tsv.bz2`,
    `${code}-${POL}_links.tsv`,
  )
  const pivotLinks = await downloadBz2(
    `${TATOEBA}/${code}/${code}-${ENG}_links.tsv.bz2`,
    `${code}-${ENG}_links.tsv`,
  )
  const pivotToPolish = await downloadBz2(
    `${TATOEBA}/${ENG}/${ENG}-${POL}_links.tsv.bz2`,
    `${ENG}-${POL}_links.tsv`,
  )

  // Lista częstości nie jest spakowana i jest mała, więc idzie zwykłym pobraniem.
  const { download } = await import('./lib/io.ts')
  const frequency = await download(
    `${FREQ}/${adapter.freq}/${adapter.freq}_50k.txt`,
    `${adapter.freq}_50k.txt`,
  )

  return { sentences, polish, directLinks, pivotLinks, pivotToPolish, frequency }
}

if (import.meta.filename === process.argv[1]) {
  const lang = process.argv[2]
  if (!lang) throw new Error('Użycie: node build/01-fetch.ts <kod-języka>')
  await fetchSources(lang)
  console.log('\nGotowe.')
}
