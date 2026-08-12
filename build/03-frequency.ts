/**
 * Krok 03 — pasma częstości. Sekcja 10.1 planu.
 *
 * FrequencyWords daje listę `{lang}_50k` posortowaną malejąco po liczbie wystąpień
 * w napisach filmowych. Ranga to numer wiersza: `de` = 1, `que` = 2 i tak dalej.
 *
 * Napisy filmowe to język mówiony, potoczny, z przewagą dialogu — czyli dokładnie
 * ten rejestr, którego uczy aplikacja. Lista częstości z korpusu prasowego dałaby
 * inne pasma i gorzej pasowałaby do zdań z Tatoeby.
 */

import { writeFile, stat } from 'node:fs/promises'
import type { LangAdapter } from '../src/langs/types.ts'
import { prepareTokenizer, tokenize } from './02-tokenize.ts'
import { cachePath, readLines, readTsv } from './lib/io.ts'

export type FrequencyMap = Map<string, number>

export async function loadFrequency(path: string): Promise<FrequencyMap> {
  const ranks: FrequencyMap = new Map()
  let rank = 0

  for await (const line of readLines(path)) {
    const word = line.split(' ')[0]
    if (!word) continue
    rank += 1
    // Lista bywa niejednoznaczna po normalizacji wielkości liter; pierwsze wystąpienie
    // jest częstsze, więc wygrywa.
    const key = word.toLocaleLowerCase()
    if (!ranks.has(key)) ranks.set(key, rank)
  }

  return ranks
}

/**
 * Ranga lematu. Brak na liście oznacza słowo rzadsze niż 50 000 najczęstszych —
 * zwracamy `null`, a filtr w kroku 05 takie zdanie odrzuci.
 */
export function bandOf(lemma: string, ranks: FrequencyMap): number | null {
  return ranks.get(lemma.toLocaleLowerCase()) ?? null
}

/**
 * Liczy rangi częstości z samego korpusu, tokenizując go tym samym analizatorem,
 * którego używa reszta pipeline'u. Wynik cache'ujemy, bo przemielenie dwustu tysięcy
 * zdań przez analizator morfologiczny trwa minuty, a przy strojeniu filtrów uruchamiamy
 * krok 05 wielokrotnie.
 */
export async function buildFrequencyFromCorpus(
  adapter: LangAdapter,
  sentencesPath: string,
): Promise<FrequencyMap> {
  const cached = cachePath(`freq-corpus-${adapter.code}.txt`)
  try {
    if ((await stat(cached)).size > 0) return loadFrequency(cached)
  } catch {
    // brak cache — liczymy poniżej
  }

  await prepareTokenizer(adapter)
  process.stdout.write(`  licze czestosc z korpusu ${adapter.code} … `)

  const counts = new Map<string, number>()
  for await (const [, , text] of readTsv(sentencesPath)) {
    if (!text) continue
    for (const token of tokenize(text, adapter)) {
      // Cząstki gramatyczne i końcówki nie są słowami do nauczenia się, a zdominowałyby
      // czoło listy tak samo, jak psują gotową listę FrequencyWords.
      if (token.pos === 'particle' || token.pos === 'aux') continue
      counts.set(token.lemma, (counts.get(token.lemma) ?? 0) + 1)
    }
  }

  const ordered = [...counts].sort((a, b) => b[1] - a[1])
  await writeFile(cached, ordered.map(([w, n]) => `${w} ${n}`).join('\n'), 'utf8')
  console.log(`${ordered.length} form`)

  return new Map(ordered.map(([word], index) => [word, index + 1]))
}
