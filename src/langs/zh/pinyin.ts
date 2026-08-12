/**
 * Pinyin z zapisu cyfrowego na diakrytyczny.
 *
 * CC-CEDICT zapisuje tony liczbami (`chuan2 tong3`), a użytkownik ma zobaczyć
 * `chuán tǒng`. Zapis cyfrowy jest wygodny w pliku i bezużyteczny na karcie: ton jest
 * w chińskim częścią słowa, nie ozdobą, więc musi być widoczny tam, gdzie pada wzrok.
 *
 * Reguła stawiania znaku, w kolejności: `a` i `e` zawsze wygrywają; w `ou` znak idzie
 * na `o`; poza tym na ostatnią samogłoskę. To jest oficjalna zasada, nie przybliżenie.
 */

const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

/** Samogłoska, która przyjmuje znak tonu. */
function markedVowel(syllable: string): number {
  const lower = syllable.toLowerCase()
  const a = lower.indexOf('a')
  if (a >= 0) return a
  const e = lower.indexOf('e')
  if (e >= 0) return e
  const ou = lower.indexOf('ou')
  if (ou >= 0) return ou
  for (let i = lower.length - 1; i >= 0; i--) {
    if ('aeiouü'.includes(lower[i]!)) return i
  }
  return -1
}

/** Zamienia jedną sylabę z zapisu cyfrowego. `nu:3` → `nǚ`, `ma5` → `ma`. */
export function syllableToDiacritics(raw: string): string {
  const withUmlaut = raw.replace(/u:/g, 'ü').replace(/v/g, 'ü')
  const match = /^([a-zA-Zü]+)([1-5])$/.exec(withUmlaut)
  if (!match) return withUmlaut

  const [, letters, digit] = match
  const tone = Number(digit)
  // Ton neutralny (5) nie ma znaku — i to jest informacja, nie jego brak.
  if (tone === 5) return letters!

  const at = markedVowel(letters!)
  if (at < 0) return letters!

  const vowel = letters![at]!.toLowerCase()
  const marked = MARKS[vowel]?.[tone - 1]
  if (!marked) return letters!

  return letters!.slice(0, at) + marked + letters!.slice(at + 1)
}

/** Zamienia cały zapis CC-CEDICT: `chuan2 tong3` → `chuán tǒng`. */
export function toDiacritics(numbered: string): string {
  return numbered.split(/\s+/).filter(Boolean).map(syllableToDiacritics).join(' ')
}
