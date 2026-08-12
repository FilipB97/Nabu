/**
 * Etapy 0 i 1 — `script.json` i `core.json`. Sekcja 2a planu.
 *
 * Oba pliki powstają z materiału, który już mamy, i żaden nie wymaga nowego pobrania:
 *
 * - **etap 0** to inwentarz pisma z adaptera. Kana i hangul to zbiory zamknięte,
 *   których nie ma w żadnym korpusie — trzeba je wypisać raz i wypisane są tam,
 *   gdzie reszta wiedzy o języku.
 * - **etap 1** to najczęstsze słowa tej talii. Bierzemy je z puli luk, a nie z listy
 *   częstości, bo pula ma już komplet: polską glosę, część mowy, pasmo i czytanie.
 *   Cena jest taka, że rdzeń dziedziczy ograniczenie `clozePos` — dla japońskiego
 *   i chińskiego będą to same rzeczowniki.
 */

import type { LangAdapter } from '../../src/langs/types.ts'
import type { Item } from '../05-assemble.ts'
import { candidatesFor, groupByPos, type Candidate } from '../06-distractors.ts'

/** Ile słów liczy rdzeń. Plan mówi 60–100; bierzemy górną granicę, gdy materiał starcza. */
const CORE_SIZE = 100

/** Ilu kandydatów zapisujemy przy pozycji etapu 0. */
const SCRIPT_CANDIDATES = 8

/**
 * Słownik pozycji, do których odsyłają dystraktory. Runtime pokazuje opcję po
 * identyfikatorze, więc każdy identyfikator musi się dać rozwiązać — także taki,
 * który nie jest osobną kartą (rdzeń bierze dystraktory z całej talii, nie tylko
 * ze swojej setki).
 */
export type StageLexicon = Record<string, { s: string; pl: string; pos: string; b: number }>

export type ScriptEntry = {
  id: string
  /** Znak — przód karty. */
  s: string
  /** Czytanie — odpowiedź. */
  r: string
  group: string
  distractors: string[]
  quiz: boolean
}

export type CoreEntry = {
  id: string
  /** Słowo w piśmie docelowym — przód karty. */
  s: string
  /** Czytanie, gdy zapis go nie niesie. */
  r?: string
  /** Polska glosa — odpowiedź. */
  pl: string
  pos: string
  band: number
  distractors: string[]
  quiz: boolean
}

/**
 * Etap 0. Dystraktory biorą się najpierw z tej samej grupy (mylonej), potem z tego samego
 * systemu pisma, a dopiero na końcu skądkolwiek. Kolejność ma znaczenie: `あ` z opcjami
 * `i / u / e` jest kartą o samogłoskach, a `あ` z opcjami `ka / shi / n` sprawdza tylko,
 * czy użytkownik pamięta cokolwiek.
 */
export function buildScript(adapter: LangAdapter): {
  items: ScriptEntry[]
  lexicon: StageLexicon
} {
  const inventory = adapter.scriptItems?.() ?? []
  if (inventory.length === 0) return { items: [], lexicon: {} }

  const ids = inventory.map((_, index) => `${adapter.code}-w-${index}`)
  const needed = adapter.quiz.minOptions - 1

  const lexicon: StageLexicon = {}
  inventory.forEach((item, index) => {
    // `s` to znak, `pl` to jego czytanie — dokładnie ten sam układ co w leksykonie zdań,
    // gdzie `s` jest słowem, a `pl` jego glosą. Która z tych dwóch wartości trafia na
    // opcję quizu, decyduje ekran, nie dane.
    lexicon[ids[index]!] = { s: item.s, pl: item.r, pos: 'script', b: index + 1 }
  })

  const items = inventory.map((item, index) => {
    const sameGroup: string[] = []
    const rest: string[] = []

    inventory.forEach((other, otherIndex) => {
      if (otherIndex === index || other.r === item.r) return
      ;(other.group === item.group ? sameGroup : rest).push(ids[otherIndex]!)
    })

    const distractors = [...sameGroup, ...rest].slice(0, SCRIPT_CANDIDATES)
    return {
      id: ids[index]!,
      s: item.s,
      r: item.r,
      group: item.group,
      distractors,
      quiz: distractors.length >= needed,
    }
  })

  return { items, lexicon }
}

/**
 * Etap 1. Najczęstsze słowa talii, po jednym na lemat, z dystraktorami dobranymi tą samą
 * regułą co przy zdaniach — ta sama część mowy i zbliżone pasmo.
 */
export function buildCore(
  adapter: LangAdapter,
  items: Item[],
): { items: CoreEntry[]; lexicon: StageLexicon } {
  const pool = new Map<string, Candidate & { r?: string }>()

  for (const item of items) {
    const token = item.tokens[item.cloze]
    if (!token?.pos || !token.gloss) continue
    const lemma = token.lemma ?? token.s.toLocaleLowerCase()
    if (pool.has(lemma)) continue
    pool.set(lemma, {
      lemma,
      // Forma zapisana małą literą, tak samo jak w leksykonie zdań: `Tan` i `tan`
      // to jedno słowo, a wielka litera bierze się z pozycji w zdaniu.
      surface: token.s.toLocaleLowerCase(),
      pl: token.gloss,
      pos: token.pos,
      band: token.b,
      ...(token.r ? { r: token.r } : {}),
    })
  }

  const byPos = groupByPos(pool)
  const needed = adapter.quiz.minOptions - 1
  const id = (lemma: string) => `${adapter.code}-c-${lemma}`

  const lexicon: StageLexicon = {}
  for (const candidate of pool.values()) {
    lexicon[id(candidate.lemma)] = {
      s: candidate.surface,
      pl: candidate.pl,
      pos: candidate.pos,
      b: candidate.band,
    }
  }

  const core = [...pool.values()]
    .sort((a, b) => a.band - b.band)
    .slice(0, CORE_SIZE)
    .map((candidate) => {
      const distractors = candidatesFor(candidate, byPos, adapter.quiz.shape)
      return {
        // Identyfikator lematu, nie numer porządkowy: rdzeń przebudowany na nowszej talii
        // ma trafić w te same karty, które użytkownik już zna.
        id: id(candidate.lemma),
        s: candidate.surface,
        ...(candidate.r ? { r: candidate.r } : {}),
        pl: candidate.pl,
        pos: candidate.pos,
        band: candidate.band,
        distractors: distractors.map(id),
        quiz: distractors.length >= needed,
      }
    })

  return { items: core, lexicon }
}
