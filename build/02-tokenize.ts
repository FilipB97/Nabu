/**
 * Krok 02 — tokenizacja. Sekcja 10.1a planu.
 *
 * Trzy wtyczki, nie trzy pipeline'y. Każda zwraca ten sam kształt `{ s, r, b, pos, lemma }`,
 * więc reszta kroków i całe UI nie mają czego rozgałęziać.
 *
 * W M1 istnieje tylko `space` — obsługuje całą klasę A. `dict` (chiński) i `morph`
 * (japoński przez kuromoji, koreański opcjonalnie) dochodzą w M4 i po v1.
 */

import type { LangAdapter } from '../src/langs/types.ts'

export type Token = {
  /** Forma powierzchniowa, dokładnie jak w zdaniu. */
  s: string
  /** Czytanie, gdy różni się od zapisu. Dla pism alfabetycznych zawsze `null`. */
  r: string | null
  /** Ranga częstości lematu; uzupełnia ją krok 03. */
  b: number | null
  /** Część mowy; uzupełnia ją krok 04 z Wikisłownika. */
  pos: string | null
  /** Postać hasłowa. Dla `space` na starcie to forma z małej litery. */
  lemma: string
}

export type Tokenizer = (text: string, adapter: LangAdapter) => Token[]

/**
 * Podział regexem po ciągach liter. Interpunkcja i spacje nie stają się tokenami —
 * niosą je `before`/`after` przy budowie karty cloze, a nie osobne pozycje.
 *
 * Apostrof wewnątrz wyrazu zostaje (`l'aigua`, `it's`), bo w językach romańskich
 * i germańskich bywa częścią formy, a nie separatorem.
 */
const space: Tokenizer = (text) => {
  const matches = text.matchAll(/\p{L}[\p{L}\p{M}'’-]*/gu)
  return [...matches].map((m) => ({
    s: m[0],
    r: null,
    b: null,
    pos: null,
    lemma: m[0].toLocaleLowerCase(),
  }))
}

const notImplemented =
  (name: string): Tokenizer =>
  () => {
    throw new Error(
      `Tokenizer "${name}" nie jest jeszcze zaimplementowany. ` +
        'Sekcja 10.1a planu: `dict` wchodzi po v1 (chiński), `morph` w M4 (japoński).',
    )
  }

const TOKENIZERS: Record<LangAdapter['tokenizer'], Tokenizer> = {
  space,
  dict: notImplemented('dict'),
  morph: notImplemented('morph'),
}

export function tokenize(text: string, adapter: LangAdapter): Token[] {
  return TOKENIZERS[adapter.tokenizer](text, adapter)
}
