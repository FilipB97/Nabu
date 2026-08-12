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

import { readLines } from './lib/io.ts'

export type FrequencyMap = Map<string, number>

/** Powyżej tej rangi słowo uznajemy za zbyt rzadkie — sekcja 10.2. */
export const MAX_BAND = 12_000

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
