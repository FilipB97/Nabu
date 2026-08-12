/**
 * Narzędzia kany — sekcja 9 planu (furigana) i 7.2 (karta `produce-kana`).
 *
 * Analizator morfologiczny podaje czytania katakaną, a furigana nad kanji pisze się
 * hiraganą. Zamiana jest arytmetyczna: bloki Unicode są ułożone równolegle, więc
 * wystarczy przesunięcie o 0x60.
 */

const KATAKANA_START = 0x30a1
const KATAKANA_END = 0x30f6
const TO_HIRAGANA = 0x60

/** Zamienia katakanę na hiraganę, zostawiając wszystko inne bez zmian. */
export function toHiragana(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0)!
    out +=
      code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCodePoint(code - TO_HIRAGANA)
        : char
  }
  return out
}

/** Czy tekst zawiera choć jeden znak kanji. */
export function hasKanji(text: string): boolean {
  return /\p{Script=Han}/u.test(text)
}

/**
 * Czy czytanie warto pokazywać. Furigana ma sens tylko nad kanji — nad samą kaną
 * powtarzałaby to, co użytkownik już widzi, i zabierała miejsce w interlinii.
 */
export function needsFurigana(surface: string, reading: string): boolean {
  return hasKanji(surface) && toHiragana(reading) !== surface
}
