import { AGAIN, EASY, GOOD, HARD, type CardState, type Grade } from './types.ts'
import { isMature } from './sm2.ts'

/**
 * Zamiana wyniku obiektywnego na ocenę SM-2 — sekcja 6.2 i 6.4 planu.
 *
 * Użytkownik nie wystawia sobie oceny (poza kartą `reveal`, która jest fallbackiem).
 * Silnik dostaje fakt — trafił albo nie, w jakim czasie, po ilu podpowiedziach —
 * i sam decyduje, co to znaczy dla harmonogramu.
 *
 * PROBLEM, KTÓRY TO ROZWIĄZUJE. Przy czterech opcjach czysty strzał trafia w 25%
 * przypadków. Reguła „trafienie = Dobrze" oznacza, że co czwarta karta, której
 * użytkownik nie zna, dostaje rosnący interwał. Po kilku tygodniach harmonogram
 * jest pełen kart nigdy nienauczonych, których terminy uciekły w przyszłość,
 * a użytkownik nie ma jak tego zauważyć — bo aplikacja nigdy o nie nie zapytała ponownie.
 */

/** Poniżej tego czasu trafienie na dojrzałej karcie liczy się jako „Łatwe". */
const FAST_MS = 2000

/** Ile razy wolniej od mediany, żeby trafienie zeszło do „Trudne". */
const SLOW_FACTOR = 2.5

/** Powyżej tego czasu uznajemy, że użytkownik odłożył telefon — nie liczymy do mediany. */
export const ABANDONED_MS = 60_000

export type QuizOutcome = {
  correct: boolean
  /** Czas od wyrenderowania karty do dotknięcia, już po korektach z `measure()`. */
  ms: number
}

export type ProductionOutcome = {
  correct: boolean
  ms: number
  /** Ile podpowiedzi zużył (kontur kreski, ujawniona litera). */
  hints: number
  /** Ile razy poprawiał odpowiedź przed zatwierdzeniem. */
  retries: number
  /** Odpowiedź różniła się wyłącznie znakami diakrytycznymi. */
  nearMiss?: boolean
}

/**
 * Mediana czasu odpowiedzi użytkownika dla danego typu karty. Krocząca, z ostatnich
 * odpowiedzi — bo tempo zmienia się razem z wprawą i „wolno" po miesiącu znaczy
 * co innego niż „wolno" pierwszego dnia.
 */
export type Tempo = {
  medianMs: number | null
}

/**
 * Reguły w kolejności sprawdzania. Kolejność jest istotna: „było trudne" nadpisuje
 * wszystko wyżej, a ochrona nowej karty ma pierwszeństwo przed premią za szybkość.
 */
export function gradeFromQuiz(card: CardState, outcome: QuizOutcome, tempo: Tempo): Grade {
  if (!outcome.correct) return AGAIN

  // Nowa karta nigdy nie dostaje „Łatwe". Skok na cztery dni po jednym trafieniu
  // z czterech opcji to dokładnie ten przypadek, w którym strzał wygląda jak wiedza.
  if (card.reps <= 1) return GOOD

  // Trafienie znacząco wolniejsze od własnej normy użytkownika: odpowiedź była
  // wyliczona, nie przypomniana.
  if (tempo.medianMs !== null && outcome.ms > tempo.medianMs * SLOW_FACTOR) return HARD

  if (outcome.ms < FAST_MS && isMature(card)) return EASY

  return GOOD
}

/** Ocena kart produkcji — sekcja 6.4. */
export function gradeFromProduction(card: CardState, outcome: ProductionOutcome): Grade {
  if (!outcome.correct) return AGAIN
  if (outcome.hints >= 2) return AGAIN
  if (outcome.hints === 1 || outcome.retries > 0 || outcome.nearMiss) return HARD
  if (card.reps <= 1) return GOOD
  if (outcome.ms < FAST_MS && isMature(card)) return EASY
  return GOOD
}

/**
 * Czas odpowiedzi po korektach z sekcji 6.2.
 *
 * Odejmujemy czas automatycznego odtworzenia dźwięku — użytkownik go słucha, a nie
 * zastanawia się — i obcinamy wartości powyżej minuty, bo to już nie jest odpowiedź,
 * tylko odłożony telefon. Obcięte wartości NIE wchodzą do mediany, żeby jedna przerwa
 * na kawę nie przesunęła progu „wolnego trafienia" dla następnych stu kart.
 */
export function measure(rawMs: number, audioMs = 0): { ms: number; countsToTempo: boolean } {
  const ms = Math.max(0, rawMs - audioMs)
  return { ms: Math.min(ms, ABANDONED_MS), countsToTempo: ms <= ABANDONED_MS }
}

/** Mediana z próbek. Zwraca `null` przy zbyt małej próbie — wtedy reguła się nie stosuje. */
export function medianOf(samples: readonly number[], minimum = 20): number | null {
  if (samples.length < minimum) return null
  const sorted = [...samples].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}
