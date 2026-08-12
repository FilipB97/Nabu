/**
 * Krok 02 — tokenizacja. Sekcja 10.1a planu.
 *
 * Trzy wtyczki, nie trzy pipeline'y. Każda zwraca ten sam kształt `{ s, r, b, pos, lemma }`,
 * więc reszta kroków i całe UI nie mają czego rozgałęziać.
 *
 * W M1 istnieje tylko `space` — obsługuje całą klasę A. `dict` (chiński) i `morph`
 * (japoński przez kuromoji, koreański opcjonalnie) dochodzą w M4 i po v1.
 */

import kuromoji from 'kuromoji'
import type { LangAdapter } from '../src/langs/types.ts'
import { needsFurigana, toHiragana } from '../src/langs/ja/kana.ts'
import { DROPPED, posFromIpadic } from '../src/langs/ja/pos.ts'

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
const space: Tokenizer = (text, adapter) => {
  const matches = [...text.matchAll(/\p{L}[\p{L}\p{M}'’-]*/gu)].map((m) => m[0])

  // Hak adaptera: koreański rozdziela wyraz na rdzeń i partykułę, żeby luka nie wypadała
  // na rzeczowniku zrośniętym z końcówką (sekcja 10.1a). Klasa A nie ma czego dzielić.
  const parts = adapter.splitToken
    ? matches.flatMap((w) => adapter.splitToken!(w))
    : matches.map((s) => ({ s }) as { s: string; pos?: string })

  return parts.map(({ s, pos }) => ({
    s,
    r: null,
    b: null,
    pos: pos ?? null,
    lemma: s.toLocaleLowerCase(),
  }))
}

/**
 * Analizator morfologiczny. Budowa wczytuje kilkanaście megabajtów słownika, więc
 * robimy to raz i trzymamy instancję — `prepareTokenizer` woła krok 05 przed pętlą.
 */
type Morph = kuromoji.Tokenizer<kuromoji.IpadicFeatures>

let morphology: Morph | null = null

export async function prepareTokenizer(adapter: LangAdapter): Promise<void> {
  if (adapter.tokenizer !== 'morph' || morphology) return
  morphology = await new Promise<Morph>((ok, fail) =>
    kuromoji
      .builder({ dicPath: 'node_modules/kuromoji/dict' })
      .build((error, built) => (error ? fail(error) : ok(built))),
  )
}

/**
 * Segmentacja przez IPADIC. Daje naraz trzy rzeczy, których podział po spacjach dać
 * nie może: granice słów tam, gdzie nie ma spacji; formę podstawową (`ください` →
 * `くださる`), po której trafiamy w słownik; oraz czytanie, z którego powstaje furigana.
 *
 * Czytanie zapisujemy WYŁĄCZNIE tam, gdzie różni się od zapisu i gdzie w ogóle jest
 * kanji (sekcja 5.1) — furigana nad samą kaną powtarzałaby to, co widać, i zabierała
 * miejsce zarezerwowane w interlinii.
 */
const morph: Tokenizer = (text) => {
  if (!morphology) {
    throw new Error('Analizator nie został zbudowany — wywołaj prepareTokenizer() przed tokenize()')
  }

  return morphology
    .tokenize(text)
    .map((token) => {
      const pos = posFromIpadic(token.pos, token.pos_detail_1)
      // Analizator nie zna czytania dla wyrazów spoza słownika — wtedy furigany nie ma.
      const raw = token.reading
      const reading = raw ? toHiragana(raw) : null
      const base =
        token.basic_form && token.basic_form !== '*' ? token.basic_form : token.surface_form
      return {
        s: token.surface_form,
        r: reading && raw && needsFurigana(token.surface_form, raw) ? reading : null,
        b: null,
        pos,
        lemma: base.toLocaleLowerCase(),
      }
    })
    .filter((token) => token.pos === null || !DROPPED.has(token.pos))
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
  morph,
}

export function tokenize(text: string, adapter: LangAdapter): Token[] {
  return TOKENIZERS[adapter.tokenizer](text, adapter)
}
