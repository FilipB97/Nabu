/**
 * Typy silnika powtórek — sekcja 5.3 i 6 planu.
 *
 * Cały ten katalog jest czystym TypeScriptem bez importów z Reacta (zasada z sekcji 16).
 * Powód nie jest estetyczny: to jedyna część aplikacji, której błąd jest niewidoczny
 * gołym okiem. Zła karta rzuca się w oczy od razu, a zły interwał objawia się dopiero
 * po trzech tygodniach — i wtedy nie da się już odtworzyć, co go zepsuło.
 */

/** Etapy nauki — sekcja 2a. */
export type Stage = 'script' | 'core' | 'sentences' | 'production'

/**
 * Oceny SM-2. Wartości liczbowe, bo trafiają do logu i porównuje się je progami
 * („skuteczność = odsetek ocen ≥ 3" z sekcji 3.3 liczymy jako `grade >= GOOD`).
 */
export const AGAIN = 0
export const HARD = 1
export const GOOD = 2
export const EASY = 3

export type Grade = typeof AGAIN | typeof HARD | typeof GOOD | typeof EASY

export type CardState = {
  id: string
  lang: string
  stage: Stage
  /** Kiedy karta wraca. ISO z czasem, nie samą datą — kroki nauki idą w minutach. */
  due: string
  /** Dni. Zero oznacza kartę w krokach nauki. */
  interval: number
  /** Indeks kroku nauki, gdy `interval === 0`. */
  step: number
  ease: number
  reps: number
  lapses: number
  suspended: boolean
  /**
   * Lemat, którego uczy ta karta. Zapisany przy tworzeniu, bo bez niego nie da się
   * odpowiedzieć na pytanie „czy to słowo już mam" bez wczytania całej talii —
   * a od tego zależy, czy dobór nowych pozycji wprowadzi je drugi raz.
   * Karty sprzed tego pola go nie mają.
   */
  lemma?: string
  /** Epoch ms — klucz do rozstrzygania konfliktów przy synchronizacji (sekcja 5.5). */
  updatedAt: number
}

/** Wpis w logu odpowiedzi — sekcja 5.3. */
export type LogEntry = {
  ts: number
  id: string
  lang: string
  grade: Grade
  /** Czas odpowiedzi w ms, po korektach z sekcji 6.2. */
  ms: number
  mode: CardType
  /** TYLKO quiz: identyfikator wybranej opcji, także gdy trafiona. */
  chosen?: string
  /** TYLKO quiz: cały pokazany zestaw, w kolejności wyświetlenia. */
  options?: string[]
}

/** Typy kart — sekcja 7. */
export type CardType =
  | 'quiz-word'
  | 'quiz-cloze'
  | 'quiz-listen'
  | 'produce-type'
  | 'produce-kana'
  | 'produce-jamo'
  | 'produce-draw'
  | 'script'
  | 'reveal'

/** Nowa karta, jeszcze nieodpowiadana. */
export function newCard(
  id: string,
  lang: string,
  stage: Stage,
  now: number,
  lemma?: string,
): CardState {
  return {
    id,
    lang,
    stage,
    ...(lemma ? { lemma } : {}),
    due: new Date(now).toISOString(),
    interval: 0,
    step: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    suspended: false,
    updatedAt: now,
  }
}
