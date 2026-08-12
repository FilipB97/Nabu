import { AGAIN, EASY, GOOD, HARD, type CardState, type Grade } from './types.ts'

/**
 * SM-2 z krokami nauki w minutach — sekcja 6 planu.
 *
 * Decyzja o SM-2 zamiast FSRS jest świadoma: FSRS potrzebuje tysiąca powtórek w logu,
 * żeby było z czego liczyć parametry, a przedtem jest tylko złożonością bez zysku.
 *
 * To, czego brakowało w poprzednim podejściu i co trzeba tu zrobić dobrze, to KROKI
 * WEWNĄTRZ SESJI. Nowa karta nie może iść od razu na dwa dni — musi wrócić za minutę,
 * potem za dziesięć, i dopiero wtedy wyjść na skalę dniową. To jest ta część, którą
 * użytkownik odczuwa natychmiast: odpowiada na pytanie „kiedy to zobaczę znowu".
 */

/** Kroki nauki w minutach. Karta przechodzi je po kolei, zanim dostanie interwał dniowy. */
export const LEARNING_STEPS = [1, 10] as const

/** Interwał po ostatnim kroku nauki, w dniach. */
const GRADUATING_INTERVAL = 1

/** Interwał, gdy nowa karta dostanie od razu „Łatwe", w dniach. */
const EASY_INTERVAL = 4

const EASE_MIN = 1.3
const EASE_MAX = 3.0

const EASE_DELTA: Record<Grade, number> = {
  [AGAIN]: -0.2,
  [HARD]: -0.15,
  [GOOD]: 0,
  [EASY]: 0.15,
}

/** Mnożnik interwału dla „Trudne" — sekcja 6. */
const HARD_MULTIPLIER = 1.2
/** Dodatkowy mnożnik dla „Łatwe". */
const EASY_BONUS = 1.3

/**
 * Rozrzut terminów. Bez niego karty wprowadzone tego samego dnia wracają w komplecie
 * tego samego dnia i budują górkę, która z każdą powtórką rośnie.
 */
const FUZZ = 0.05

const MINUTE = 60_000
const DAY = 86_400_000

function clampEase(ease: number): number {
  return Math.min(EASE_MAX, Math.max(EASE_MIN, ease))
}

/**
 * Źródło losowości podawane z zewnątrz, żeby testy były deterministyczne.
 * Domyślnie `Math.random`.
 */
export type Random = () => number

function fuzzed(days: number, random: Random): number {
  if (days < 2) return days
  const spread = 1 + (random() * 2 - 1) * FUZZ
  return Math.max(1, Math.round(days * spread))
}

/** Początek następnego dnia — karty dniowe wracają rano, nie o losowej godzinie. */
function dueInDays(now: number, days: number): string {
  const date = new Date(now)
  date.setHours(4, 0, 0, 0)
  const base = date.getTime() <= now ? date.getTime() : date.getTime() - DAY
  return new Date(base + days * DAY).toISOString()
}

export type Review = {
  card: CardState
  /** Czy karta wraca jeszcze w tej sesji (jest w krokach minutowych). */
  inSession: boolean
  /** Przewidywany opis interwału do pokazania pod oceną. */
  label: string
}

/**
 * Stosuje ocenę do karty i zwraca nowy stan. Funkcja czysta — nie dotyka zegara
 * ani losowości poza tym, co dostała w argumentach.
 */
export function review(
  card: CardState,
  grade: Grade,
  now: number,
  random: Random = Math.random,
): Review {
  const ease = clampEase(card.ease + EASE_DELTA[grade])
  const reps = card.reps + 1
  const base = { ...card, ease, reps, updatedAt: now }

  // ---- karta w krokach nauki -------------------------------------------------
  if (card.interval === 0) {
    if (grade === EASY) {
      const days = fuzzed(EASY_INTERVAL, random)
      return {
        card: { ...base, interval: days, step: 0, due: dueInDays(now, days) },
        inSession: false,
        label: `${days} dni`,
      }
    }

    const step =
      grade === AGAIN ? 0 : grade === HARD ? card.step : Math.min(card.step + 1, LEARNING_STEPS.length)

    if (step >= LEARNING_STEPS.length) {
      const days = GRADUATING_INTERVAL
      return {
        card: { ...base, interval: days, step: 0, due: dueInDays(now, days) },
        inSession: false,
        label: '1 dzień',
      }
    }

    const minutes = LEARNING_STEPS[step]!
    return {
      card: { ...base, interval: 0, step, due: new Date(now + minutes * MINUTE).toISOString() },
      inSession: true,
      label: `${minutes} min`,
    }
  }

  // ---- karta w powtórkach ----------------------------------------------------
  if (grade === AGAIN) {
    // Wpadka: karta wraca do kroków i jeszcze dziś pojawi się ponownie.
    const minutes = LEARNING_STEPS[0]!
    return {
      card: {
        ...base,
        interval: 0,
        step: 0,
        lapses: card.lapses + 1,
        due: new Date(now + minutes * MINUTE).toISOString(),
      },
      inSession: true,
      label: `${minutes} min`,
    }
  }

  const multiplier =
    grade === HARD ? HARD_MULTIPLIER : grade === GOOD ? ease : ease * EASY_BONUS
  const days = fuzzed(Math.max(1, Math.round(card.interval * multiplier)), random)

  return {
    card: { ...base, interval: days, step: 0, due: dueInDays(now, days) },
    inSession: false,
    label: days === 1 ? '1 dzień' : `${days} dni`,
  }
}

/**
 * Podgląd interwału dla każdej oceny, bez zmiany stanu. Makieta pokazuje go pod
 * etykietą oceny („DOBRZE · 1 DZIEŃ"), więc musi być liczony tą samą ścieżką co realna
 * odpowiedź — inaczej obietnica rozjedzie się z tym, co faktycznie się dzieje.
 */
export function previewLabels(card: CardState, now: number): Record<Grade, string> {
  // Bez rozrzutu: podgląd ma być stabilny między klatkami.
  const stable: Random = () => 0.5
  return {
    [AGAIN]: review(card, AGAIN, now, stable).label,
    [HARD]: review(card, HARD, now, stable).label,
    [GOOD]: review(card, GOOD, now, stable).label,
    [EASY]: review(card, EASY, now, stable).label,
  }
}

/** Czy karta jest dojrzała — próg z sekcji 8.6 i wejście w tryb produkcji (6.4). */
export const MATURE_INTERVAL = 21

export function isMature(card: CardState): boolean {
  return card.interval >= MATURE_INTERVAL
}
