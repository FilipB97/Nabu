/**
 * Składanie i rozkład sylab hangulu.
 *
 * Jedna implementacja, dwa zastosowania (sekcja 10.1b planu): klawiatura jamo przy
 * karcie `produce-jamo` oraz podobieństwo kształtu przy doborze dystraktorów — para
 * 물 / 불 / 말 różni się jednym jamo i to jest dokładnie ta trudność, którą chcemy
 * postawić przed użytkownikiem.
 *
 * Blok Hangul Syllables jest w Unicode ułożony arytmetycznie:
 *   kod = 0xAC00 + (초성 × 588) + (중성 × 28) + 종성
 * czyli rozkład i złożenie to dzielenie z resztą, bez tablic i bez słownika.
 */

const SYLLABLE_BASE = 0xac00
const SYLLABLE_COUNT = 11172
const MEDIAL_COUNT = 21
const FINAL_COUNT = 28

/** 초성 — 19 spółgłosek nagłosowych, w kolejności unikodowej. */
export const INITIALS = [...'ᄀᄁᄂᄃᄄᄅᄆᄇᄈᄉᄊᄋᄌᄍᄎᄏᄐᄑᄒ']

/** 중성 — 21 samogłosek. */
export const MEDIALS = [...'ᅡᅢᅣᅤᅥᅦᅧᅨᅩᅪᅫᅬᅭᅮᅯᅰᅱᅲᅳᅴᅵ']

/** 종성 — 27 spółgłosek wygłosowych; indeks 0 oznacza brak wygłosu. */
export const FINALS = ['', ...'ᆨᆩᆪᆫᆬᆭᆮᆯᆰᆱᆲᆳᆴᆵᆶᆷᆸᆹᆺᆻᆼᆽᆾᆿᇀᇁᇂ']

export type Jamo = { initial: number; medial: number; final: number }

/** Czy znak jest złożoną sylabą hangulu z bloku Hangul Syllables. */
export function isSyllable(char: string): boolean {
  const code = char.codePointAt(0)
  return code !== undefined && code >= SYLLABLE_BASE && code < SYLLABLE_BASE + SYLLABLE_COUNT
}

/** Rozkłada sylabę na indeksy jamo. Zwraca `null` dla znaku spoza bloku sylab. */
export function decompose(char: string): Jamo | null {
  if (!isSyllable(char)) return null
  const offset = char.codePointAt(0)! - SYLLABLE_BASE
  return {
    initial: Math.floor(offset / (MEDIAL_COUNT * FINAL_COUNT)),
    medial: Math.floor(offset / FINAL_COUNT) % MEDIAL_COUNT,
    final: offset % FINAL_COUNT,
  }
}

/** Składa indeksy jamo z powrotem w sylabę. */
export function compose({ initial, medial, final }: Jamo): string {
  if (initial < 0 || initial >= INITIALS.length)
    throw new RangeError(`초성 poza zakresem: ${initial}`)
  if (medial < 0 || medial >= MEDIAL_COUNT) throw new RangeError(`중성 poza zakresem: ${medial}`)
  if (final < 0 || final >= FINAL_COUNT) throw new RangeError(`종성 poza zakresem: ${final}`)
  return String.fromCodePoint(
    SYLLABLE_BASE + (initial * MEDIAL_COUNT + medial) * FINAL_COUNT + final,
  )
}

/**
 * Rozkłada cały wyraz na ciąg indeksów jamo, po jednym elemencie na jamo.
 * Znaki spoza bloku sylab przechodzą bez zmiany, dzięki czemu porównanie działa
 * także dla tekstu z interpunkcją i spacjami.
 */
export function toJamoSequence(text: string): string[] {
  const out: string[] = []
  for (const char of text) {
    const parts = decompose(char)
    if (!parts) {
      out.push(char)
      continue
    }
    out.push(INITIALS[parts.initial]!, MEDIALS[parts.medial]!)
    if (parts.final > 0) out.push(FINALS[parts.final]!)
  }
  return out
}
