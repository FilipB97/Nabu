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
/**
 * Znaczenie na kartę rdzenia — inne niż na kartę zdania, i to jest cała rzecz.
 *
 * Karta zdania bierze znaczenie z KONTEKSTU: `夜` w zdaniu o wieczorze to „wieczór",
 * bo zdanie tak mówi. Karta rdzenia nie ma kontekstu — uczy słowa jako słowa, więc musi
 * wziąć znaczenie PODSTAWOWE. Wcześniej dziedziczyła sens z pierwszego napotkanego
 * zdania i wychodziło z tego `夜 = wieczór`, `时间 = godzina`, `米 = metr`: prawda
 * o jednym zdaniu podana jako prawda o słowie.
 *
 * Wyjątek: znaczenie zaczynające się wielką literą przy istnieniu innych. Wikisłownik
 * stawia na pierwszym miejscu nazwę taksonomiczną („Nicotiana, tytoń" dla `담배`),
 * która jest poprawna i bezużyteczna. Nazwy własne — Tokio, Japonia — nie mają
 * alternatywy pisanej małą literą, więc zostają.
 */
function primarySense(senses: readonly string[]): number {
  if (senses.length <= 1) return 0
  const first = senses[0] ?? ''
  if (!/^\p{Lu}/u.test(first)) return 0
  const lower = senses.findIndex((sense) => /^\p{Ll}/u.test(sense))
  return lower >= 0 ? lower : 0
}

export function buildCore(
  adapter: LangAdapter,
  items: Item[],
  /**
   * Hasła słownikowe. Bez nich rdzeń zna tylko to, co widział w zdaniach — a zdanie
   * mówi o swoim kontekście, nie o słowie.
   */
  dictionary?: ReadonlyMap<
    string,
    { head: string; pl: string; senses: string[]; readings: (string | null)[]; say?: string }
  >,
): { items: CoreEntry[]; lexicon: StageLexicon } {
  const pool = new Map<string, Candidate & { r?: string }>()

  for (const item of items) {
    const token = item.tokens[item.cloze]
    if (!token?.pos || !token.gloss) continue
    const lemma = token.lemma ?? token.s.toLocaleLowerCase()
    if (pool.has(lemma)) continue

    // Karta pokazuje POSTAĆ HASŁOWĄ, nie formę z tego zdania. Koreańskie `잡아` jest
    // formą czasownika `잡다`, a glosa („złapać") opisuje formę słownikową — karta
    // z formą odmienioną i glosą bezokolicznika uczy pary, której nie ma w słowniku.
    // Pisownia z hasła słownikowego, nie z formy w zdaniu ani z klucza mapy: hasło zna
    // wielkie litery, których klucz nie niesie (`Frau`), i formę podstawową, której nie
    // niesie zdanie (`잡다` zamiast `잡아`).
    const entry = dictionary?.get(lemma)
    const surface = entry?.head ?? token.s.toLocaleLowerCase()

    const at = entry ? primarySense(entry.senses) : -1
    const gloss = entry ? (entry.senses[at] ?? entry.pl) : token.gloss
    // Czytanie z hasła ma pierwszeństwo nad czytaniem z analizatora: pochodzi z tego
    // samego wiersza słownika co glosa, więc nie może się z nią rozjechać.
    // Kolejność: czytanie przypisane do TEGO znaczenia, potem wymowa całego hasła,
    // dopiero na końcu czytanie z analizatora — bo tylko dwa pierwsze pochodzą z tego
    // samego wiersza słownika co glosa.
    const reading = (entry?.readings[at] ?? undefined) || token.r || entry?.say

    pool.set(lemma, {
      lemma,
      surface,
      pl: gloss,
      pos: token.pos,
      band: token.b,
      ...(reading ? { r: reading } : {}),
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
