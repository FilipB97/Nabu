/**
 * Krok 06 — dobór dystraktorów. Sekcja 10.1b planu.
 *
 * Quiz stoi na jakości błędnych opcji. Losowe słowa zamieniłyby kartę w test czytania,
 * a zbyt bliskie znaczeniowo dałyby dwie poprawne odpowiedzi naraz.
 *
 * ODEJŚCIE OD PLANU. Plan przewidywał tu lokalny model osadzeń liczący podobieństwo
 * znaczeniowe glos. Zrezygnowałem, i to nie dla oszczędności 120 MB pobrania:
 *
 * Makieta pokazuje dla hiszpańskiego `agua / leche / tiempo / pan` — woda, mleko, czas,
 * chleb. To NIE jest jedno pole znaczeniowe, tylko cztery pospolite rzeczowniki
 * o zbliżonej częstości. Przy karcie cloze bliskość znaczeniowa działa wręcz przeciwnie
 * do zamiaru: gdyby dystraktorami dla `agua` były `líquido` i `bebida`, w wielu zdaniach
 * pasowałyby równie dobrze jak odpowiedź poprawna i karta stałaby się nierozstrzygalna.
 *
 * Kryterium, które faktycznie robi robotę, to zgodność części mowy i zbliżone pasmo
 * częstości: opcja musi być słowem, które użytkownik mógłby znać, ale nie pasuje tutaj.
 * Podobieństwo kształtu zostaje jako wtyczka i przy CJK będzie decydujące (水 / 氷 / 湯).
 */

import { adapterFor } from '../src/langs/index.ts'
import type { LangAdapter, ShapeSimilarity } from '../src/langs/types.ts'
import { toJamoSequence } from '../src/langs/ko/hangul.ts'
import type { Item } from './05-assemble.ts'
import { kanjiSimilarity, loadComponents, type Components } from './lib/kradfile.ts'

/** Ilu kandydatów zapisujemy. Runtime losuje z nich `n − 1`, więc zestaw się nie powtarza. */
const CANDIDATES = 8

/** Dopuszczalny stosunek rang. Za szeroko — opcja odpada „na oko", za wąsko — brak kandydatów. */
const BAND_RATIO = 2.5

export type Candidate = {
  lemma: string
  surface: string
  pl: string
  pos: string
  band: number
}

/** Odległość Levenshteina, znormalizowana do 0–1, gdzie 1 to identyczność. */
export function editSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const rows = a.length + 1
  const cols = b.length + 1
  let prev = Array.from({ length: cols }, (_, i) => i)

  for (let i = 1; i < rows; i++) {
    const curr = [i, ...Array<number>(cols - 1).fill(0)]
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    prev = curr
  }

  const distance = prev[cols - 1]!
  return 1 - distance / Math.max(a.length, b.length)
}

/** Podobieństwo po rozłożeniu sylab hangulu na jamo — para 물 / 불 / 말 z makiety. */
export function jamoSimilarity(a: string, b: string): number {
  return editSimilarity(toJamoSequence(a).join(''), toJamoSequence(b).join(''))
}

/** Rozkład kanji, wczytywany tylko dla języków, które go używają. */
let components: Components | null = null

export async function prepareShape(shape: ShapeSimilarity): Promise<void> {
  if (shape === 'kanji-components' && !components) components = await loadComponents()
}

const SHAPE: Record<ShapeSimilarity, (a: string, b: string) => number> = {
  edit: editSimilarity,
  jamo: jamoSimilarity,
  'kanji-components': (a, b) => {
    if (!components) throw new Error('Rozkład kanji niewczytany — wywołaj prepareShape()')
    return kanjiSimilarity(a, b, components)
  },
}

/**
 * Waga kształtu w wyniku. Dla pism alfabetycznych celowo niska: `casa` i `caza` różnią
 * się jedną literą, ale to jest test ortografii, nie znajomości słowa. Przy CJK
 * podobieństwo kształtu jest właściwą trudnością i wagę podniesiemy w M4.
 */
const SHAPE_WEIGHT: Record<ShapeSimilarity, number> = {
  edit: 0.15,
  jamo: 0.5,
  'kanji-components': 0.5,
}

/** Czy dwie glosy są na tyle bliskie, że obie odpowiedzi byłyby poprawne. */
export function glossesCollide(a: string, b: string): boolean {
  const x = a.toLocaleLowerCase().trim()
  const y = b.toLocaleLowerCase().trim()
  if (x === y) return true
  if (x.includes(y) || y.includes(x)) return true
  const words = (s: string) => new Set(s.split(/[\s,;/]+/).filter((w) => w.length > 3))
  for (const w of words(x)) if (words(y).has(w)) return true
  return false
}

function scoreOf(target: Candidate, other: Candidate, shape: ShapeSimilarity): number {
  // Bliskość pasma: 1 przy identycznej randze, spada wraz ze stosunkiem rang.
  const ratio = Math.max(target.band, other.band) / Math.max(1, Math.min(target.band, other.band))
  const bandScore = 1 / ratio

  const shapeScore = SHAPE[shape](target.surface, other.surface)
  const w = SHAPE_WEIGHT[shape]
  return (1 - w) * bandScore + w * shapeScore
}

/**
 * Buduje pulę kandydatów z lematów, które w tej talii występują jako luka. Ograniczenie
 * do słownictwa talii jest decyzją z rozmowy o planie: kandydaci mają już polską glosę,
 * więc krok nie kosztuje ani jednego wywołania modelu, a dystraktorem jest słowo,
 * którego użytkownik i tak się uczy.
 */
export function buildPool(items: Item[]): Map<string, Candidate> {
  const pool = new Map<string, Candidate>()

  for (const item of items) {
    const token = item.tokens[item.cloze]
    if (!token?.pos || !token.gloss) continue
    const lemma = token.lemma ?? token.s.toLocaleLowerCase()
    if (pool.has(lemma)) continue
    pool.set(lemma, {
      lemma,
      surface: token.s.toLocaleLowerCase(),
      pl: token.gloss,
      pos: token.pos,
      band: token.b,
    })
  }

  return pool
}

export async function assignDistractors(items: Item[], lang: string): Promise<void> {
  const adapter: LangAdapter = adapterFor(lang)
  await prepareShape(adapter.quiz.shape)
  const pool = buildPool(items)
  const byPos = new Map<string, Candidate[]>()

  for (const candidate of pool.values()) {
    const list = byPos.get(candidate.pos)
    if (list) list.push(candidate)
    else byPos.set(candidate.pos, [candidate])
  }

  const needed = adapter.quiz.minOptions - 1
  const cache = new Map<string, string[]>()

  for (const item of items) {
    const token = item.tokens[item.cloze]
    if (!token?.pos || !token.gloss) {
      item.quiz = false
      continue
    }
    const lemma = token.lemma ?? token.s.toLocaleLowerCase()
    const target = pool.get(lemma)
    if (!target) {
      item.quiz = false
      continue
    }

    // Ten sam lemat bywa luką w wielu zdaniach — liczymy raz.
    const known = cache.get(lemma)
    if (known) {
      item.distractors = known
      item.quiz = known.length >= needed
      continue
    }

    const scored = (byPos.get(target.pos) ?? [])
      .filter((other) => {
        if (other.lemma === target.lemma) return false
        const ratio =
          Math.max(target.band, other.band) / Math.max(1, Math.min(target.band, other.band))
        if (ratio > BAND_RATIO) return false
        return !glossesCollide(target.pl, other.pl)
      })
      .map((other) => ({ other, score: scoreOf(target, other, adapter.quiz.shape) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, CANDIDATES)
      .map((entry) => entry.other.lemma)

    cache.set(lemma, scored)
    item.distractors = scored
    item.quiz = scored.length >= needed
  }
}
