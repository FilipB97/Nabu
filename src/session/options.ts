import type { DeckItem, Lexicon } from '@/store/decks'

/**
 * Dobór opcji quizu w locie — sekcja 6.3 planu.
 *
 * Build daje listę 6–8 kandydatów; tutaj wybieramy z niej `n − 1` i ustawiamy kolejność.
 * Trzy reguły, bez których quiz uczy układu przycisków zamiast słów:
 *
 * 1. Pozycja poprawnej odpowiedzi jest losowa i INNA niż przy poprzedniej powtórce
 *    tej karty. Bez tego użytkownik zapamiętuje „to jest ta druga od góry".
 * 2. Zestaw dystraktorów nie powtarza się dwa razy z rzędu — inaczej karta zamienia się
 *    w rozpoznawanie obrazka, a nie słowa.
 * 3. Dystraktor, na który użytkownik już się nabrał, wraca częściej. To jedyne miejsce,
 *    w którym quiz robi coś, czego samoocena nie potrafi: wie, CO z czym się myli.
 */

export type Option = {
  /** Lemat — identyfikator opcji, trafia do logu jako `chosen`. */
  id: string
  term: string
  gloss: string
}

export type OptionSet = {
  options: Option[]
  correct: number
}

/** Pamięć ostatniego wyświetlenia karty, żeby nie powtórzyć układu. */
export type LastShown = {
  correctAt: number
  distractorIds: string[]
}

/** Ile razy trafiona para musi wrócić, zanim przestaniemy ją podbijać. */
const CONFUSION_STREAK = 3

export type Confusions = ReadonlyMap<string, ReadonlyMap<string, number>>

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * Buduje zestaw opcji. Zwraca `null`, gdy kandydatów nie starcza — wywołujący pokazuje
 * wtedy kartę `reveal` z samooceną, po cichu (sekcja 7.1).
 */
export function buildOptions(
  item: DeckItem,
  lexicon: Lexicon,
  count: number,
  last: LastShown | null,
  confusions: Confusions,
  random: () => number = Math.random,
): OptionSet | null {
  const target = item.tokens[item.cloze]
  if (!item.quiz || !target?.gloss) return null

  const correctId = target.lemma ?? target.s.toLocaleLowerCase()
  const needed = count - 1

  const available = item.distractors.filter((id) => id !== correctId && lexicon[id])
  if (available.length < needed) return null

  // Reguła 3: pary, na których użytkownik już się nabrał, mają pierwszeństwo.
  const missed = confusions.get(correctId)
  const weighted = [...available].sort((a, b) => {
    const wa = missed?.get(a) ?? 0
    const wb = missed?.get(b) ?? 0
    if (wa !== wb) return wb - wa
    return random() - 0.5
  })

  // Reguła 2: nie powtarzamy zestawu z poprzedniej powtórki, o ile jest z czego wybierać.
  let picked = weighted.slice(0, needed)
  const sameAsLast =
    last !== null &&
    picked.length === last.distractorIds.length &&
    picked.every((id) => last.distractorIds.includes(id))

  if (sameAsLast && available.length > needed) {
    const rotated = [...weighted.slice(1), weighted[0]!]
    picked = rotated.slice(0, needed)
  }

  const distractors: Option[] = picked.map((id) => ({
    id,
    term: lexicon[id]!.s,
    gloss: lexicon[id]!.pl,
  }))

  const correctOption: Option = {
    id: correctId,
    term: target.s,
    gloss: target.gloss,
  }

  // Reguła 1: pozycja poprawnej losowa, ale inna niż poprzednio.
  const positions = shuffle(
    Array.from({ length: count }, (_, i) => i).filter((i) => i !== last?.correctAt),
    random,
  )
  const correctAt = positions[0] ?? 0

  const options: Option[] = []
  let next = 0
  for (let i = 0; i < count; i++) {
    options.push(i === correctAt ? correctOption : distractors[next++]!)
  }

  return { options, correct: correctAt }
}

/**
 * Buduje mapę mylonych par z logu odpowiedzi. To samo źródło zasila ekran statystyk
 * („NAJCZĘŚCIEJ MYLONE PARY") i regułę 3 powyżej — jedna dana, dwa zastosowania.
 */
export function buildConfusions(
  entries: readonly { id: string; chosen?: string; grade: number }[],
  correctIdOf: (cardId: string) => string | undefined,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  const streak = new Map<string, number>()

  for (const entry of entries) {
    const correct = correctIdOf(entry.id)
    if (!correct || !entry.chosen) continue

    if (entry.chosen === correct) {
      const key = correct
      const seen = (streak.get(key) ?? 0) + 1
      streak.set(key, seen)
      // Po serii trafień para przestaje być myląca i schodzi z listy.
      if (seen >= CONFUSION_STREAK) out.delete(correct)
      continue
    }

    streak.set(correct, 0)
    const pairs = out.get(correct) ?? new Map<string, number>()
    pairs.set(entry.chosen, (pairs.get(entry.chosen) ?? 0) + 1)
    out.set(correct, pairs)
  }

  return out
}
