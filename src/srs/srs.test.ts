import { describe, expect, it } from 'vitest'
import { AGAIN, EASY, GOOD, HARD, newCard, type CardState } from './types.ts'
import { LEARNING_STEPS, MATURE_INTERVAL, isMature, previewLabels, review } from './sm2.ts'
import { gradeFromProduction, gradeFromQuiz, measure, medianOf } from './grade.ts'

/**
 * Testy silnika powtórek. Sekcja 16 planu wymaga pokrycia tej logiki, i nie jest to
 * rytuał: zły interwał nie objawia się od razu, tylko po trzech tygodniach, kiedy nie
 * da się już odtworzyć, co go zepsuło.
 */

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0)
/** Losowość bez rozrzutu — testy sprawdzają regułę, nie generator liczb. */
const stable = () => 0.5

function card(overrides: Partial<CardState> = {}): CardState {
  return { ...newCard('es-s-1', 'es', 'sentences', NOW), ...overrides }
}

const minutesUntil = (due: string) => Math.round((Date.parse(due) - NOW) / 60_000)
const daysUntil = (due: string) => (Date.parse(due) - NOW) / 86_400_000

describe('kroki nauki', () => {
  it('nowa karta z „Dobrze" przechodzi krok po kroku, nie od razu na dni', () => {
    const first = review(card(), GOOD, NOW, stable)
    expect(first.card.interval).toBe(0)
    expect(minutesUntil(first.card.due)).toBe(LEARNING_STEPS[1])
    expect(first.inSession).toBe(true)
  })

  it('po ostatnim kroku karta wychodzi na jeden dzień', () => {
    const last = review(card({ step: LEARNING_STEPS.length - 1 }), GOOD, NOW, stable)
    expect(last.card.interval).toBe(1)
    expect(last.inSession).toBe(false)
    expect(last.label).toBe('1 dzień')
  })

  it('„Nie pamiętam" cofa do pierwszego kroku i karta wraca w tej samej sesji', () => {
    const back = review(card({ step: 1 }), AGAIN, NOW, stable)
    expect(back.card.step).toBe(0)
    expect(minutesUntil(back.card.due)).toBe(LEARNING_STEPS[0])
    expect(back.inSession).toBe(true)
  })

  it('„Trudne" powtarza bieżący krok, nie cofa i nie posuwa', () => {
    const same = review(card({ step: 1 }), HARD, NOW, stable)
    expect(same.card.step).toBe(1)
    expect(same.inSession).toBe(true)
  })

  it('„Łatwe" na nowej karcie przeskakuje kroki od razu na cztery dni', () => {
    const jump = review(card(), EASY, NOW, stable)
    expect(jump.card.interval).toBe(4)
    expect(jump.inSession).toBe(false)
  })
})

describe('karta w powtórkach', () => {
  it('„Dobrze" mnoży interwał przez łatwość', () => {
    const next = review(card({ interval: 10, ease: 2.5 }), GOOD, NOW, stable)
    expect(next.card.interval).toBe(25)
    expect(daysUntil(next.card.due)).toBeGreaterThan(24)
  })

  it('„Trudne" rośnie wolno i obniża łatwość', () => {
    const next = review(card({ interval: 10, ease: 2.5 }), HARD, NOW, stable)
    expect(next.card.interval).toBe(12)
    expect(next.card.ease).toBeCloseTo(2.35, 5)
  })

  it('„Łatwe" dokłada premię i podnosi łatwość', () => {
    const next = review(card({ interval: 10, ease: 2.5 }), EASY, NOW, stable)
    expect(next.card.ease).toBeCloseTo(2.65, 5)
    expect(next.card.interval).toBeGreaterThan(25)
  })

  it('wpadka zeruje interwał, zlicza się i zawraca kartę do tej samej sesji', () => {
    const lapse = review(card({ interval: 30, lapses: 2 }), AGAIN, NOW, stable)
    expect(lapse.card.interval).toBe(0)
    expect(lapse.card.lapses).toBe(3)
    expect(lapse.inSession).toBe(true)
    expect(minutesUntil(lapse.card.due)).toBe(LEARNING_STEPS[0])
  })

  it('łatwość nie wychodzi poza [1.3, 3.0] nawet po serii ocen skrajnych', () => {
    let low = card({ interval: 5, ease: 1.4 })
    for (let i = 0; i < 10; i++) low = review(low, AGAIN, NOW, stable).card
    expect(low.ease).toBe(1.3)

    let high = card({ interval: 5, ease: 2.9 })
    for (let i = 0; i < 10; i++) high = review(high, EASY, NOW, stable).card
    expect(high.ease).toBe(3.0)
  })

  it('interwały rosną przy powtarzanym „Dobrze" — bramka M2', () => {
    let state = card()
    const seen: number[] = []
    for (let i = 0; i < 8; i++) {
      state = review(state, GOOD, NOW, stable).card
      seen.push(state.interval)
    }
    const daily = seen.filter((interval) => interval > 0)
    for (let i = 1; i < daily.length; i++) {
      expect(daily[i]!).toBeGreaterThan(daily[i - 1]!)
    }
  })

  it('rozrzut rusza terminy, ale nie zmienia ich rzędu wielkości', () => {
    const results = Array.from({ length: 40 }, (_, i) =>
      review(card({ interval: 100 }), GOOD, NOW, () => i / 40).card.interval,
    )
    expect(Math.min(...results)).toBeGreaterThan(230)
    expect(Math.max(...results)).toBeLessThan(270)
    expect(new Set(results).size).toBeGreaterThan(1)
  })
})

describe('podgląd interwałów pod ocenami', () => {
  it('liczy się tą samą ścieżką co realna odpowiedź', () => {
    const labels = previewLabels(card({ interval: 10, ease: 2.5 }), NOW)
    expect(labels[GOOD]).toBe(review(card({ interval: 10, ease: 2.5 }), GOOD, NOW, () => 0.5).label)
    expect(labels[AGAIN]).toBe('1 min')
  })
})

describe('quiz → ocena, ochrona przed strzałem', () => {
  const tempo = { medianMs: 4000 }

  it('pudło to zawsze „Nie pamiętam"', () => {
    expect(gradeFromQuiz(card({ reps: 9, interval: 40 }), { correct: false, ms: 500 }, tempo)).toBe(AGAIN)
  })

  it('nowa karta nigdy nie dostaje „Łatwe", choćby trafiona błyskawicznie', () => {
    // To jest sedno ochrony: trafienie 1 z 4 po 300 ms wygląda jak wiedza,
    // a przy nowej karcie jest nieodróżnialne od strzału.
    const fresh = card({ reps: 1, interval: 30 })
    expect(gradeFromQuiz(fresh, { correct: true, ms: 300 }, tempo)).toBe(GOOD)
  })

  it('trafienie wolniejsze niż 2,5× własnej mediany schodzi do „Trudne"', () => {
    const known = card({ reps: 5, interval: 10 })
    expect(gradeFromQuiz(known, { correct: true, ms: 11_000 }, tempo)).toBe(HARD)
    expect(gradeFromQuiz(known, { correct: true, ms: 5_000 }, tempo)).toBe(GOOD)
  })

  it('bez mediany reguła wolnego trafienia się nie stosuje', () => {
    const known = card({ reps: 5, interval: 10 })
    expect(gradeFromQuiz(known, { correct: true, ms: 30_000 }, { medianMs: null })).toBe(GOOD)
  })

  it('szybkie trafienie na dojrzałej karcie to „Łatwe", na młodej nie', () => {
    expect(gradeFromQuiz(card({ reps: 9, interval: MATURE_INTERVAL }), { correct: true, ms: 900 }, tempo)).toBe(EASY)
    expect(gradeFromQuiz(card({ reps: 9, interval: 5 }), { correct: true, ms: 900 }, tempo)).toBe(GOOD)
  })

  // Deklaracja „było trudne" była kiedyś czwartą regułą i wygrywała z pozostałymi.
  // Zniknęła razem z przyciskiem: samoocena wraca do aplikacji tylnymi drzwiami,
  // a „trudne" i tak powstaje z czasu odpowiedzi, czyli z pomiaru zamiast z deklaracji.
  it('trudność bierze się z czasu, nie z deklaracji użytkownika', () => {
    const known = card({ reps: 9, interval: 40 })
    expect(gradeFromQuiz(known, { correct: true, ms: 300 }, tempo)).not.toBe(HARD)
    expect(gradeFromQuiz(known, { correct: true, ms: 11_000 }, tempo)).toBe(HARD)
  })
})

describe('produkcja → ocena', () => {
  const mature = card({ reps: 9, interval: 40 })

  it('trafienie za pierwszym razem bez podpowiedzi', () => {
    expect(gradeFromProduction(mature, { correct: true, ms: 900, hints: 0, retries: 0 })).toBe(EASY)
  })

  it('jedna podpowiedź albo poprawka to „Trudne"', () => {
    expect(gradeFromProduction(mature, { correct: true, ms: 3000, hints: 1, retries: 0 })).toBe(HARD)
    expect(gradeFromProduction(mature, { correct: true, ms: 3000, hints: 0, retries: 1 })).toBe(HARD)
  })

  it('różnica tylko w diakrytykach to „Trudne", nie pudło', () => {
    expect(gradeFromProduction(mature, { correct: true, ms: 3000, hints: 0, retries: 0, nearMiss: true })).toBe(HARD)
  })

  it('druga podpowiedź albo błędna odpowiedź to „Nie pamiętam"', () => {
    expect(gradeFromProduction(mature, { correct: true, ms: 3000, hints: 2, retries: 0 })).toBe(AGAIN)
    expect(gradeFromProduction(mature, { correct: false, ms: 3000, hints: 0, retries: 0 })).toBe(AGAIN)
  })
})

describe('pomiar czasu odpowiedzi', () => {
  it('odejmuje czas odtworzenia dźwięku', () => {
    expect(measure(5000, 1500).ms).toBe(3500)
  })

  it('obcina odłożony telefon i wyklucza go z mediany', () => {
    const long = measure(600_000)
    expect(long.ms).toBe(60_000)
    expect(long.countsToTempo).toBe(false)
  })

  it('zwykła odpowiedź liczy się do mediany', () => {
    expect(measure(3000).countsToTempo).toBe(true)
  })
})

describe('mediana tempa', () => {
  it('nie liczy przy zbyt małej próbie — reguła ma się wtedy nie stosować', () => {
    expect(medianOf([1000, 2000, 3000])).toBeNull()
  })

  it('liczy medianę przy dostatecznej próbie', () => {
    expect(medianOf(Array.from({ length: 21 }, (_, i) => i * 100))).toBe(1000)
  })
})

describe('dojrzałość karty', () => {
  it('próg jest ten sam, którego używa statystyka i wejście w produkcję', () => {
    expect(isMature(card({ interval: MATURE_INTERVAL }))).toBe(true)
    expect(isMature(card({ interval: MATURE_INTERVAL - 1 }))).toBe(false)
  })
})
