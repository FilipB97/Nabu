/**
 * Klawiatura kany — sekcja 7.2 planu, karta `produce-kana`.
 *
 * Systemowy IME jest tu wykluczony z zasady: użytkownik wpisuje `mizu`, IME podaje listę
 * kandydatów, użytkownik ROZPOZNAJE 水 na liście. Pracę pamięciową wykonał IME, a test
 * przypomnienia jest pozorny. Klawiatura w aplikacji podaje same kany, bez kandydatów
 * i bez podpowiedzi.
 *
 * Układ jest gojūon, wierszami — tak jak w każdej tablicy kany, której użytkownik już się
 * uczył na etapie 0. Dakuten i handakuten dostają osobny rząd, bo są modyfikacją, a nie
 * osobnymi znakami; naciśnięte po sylabie zamieniają ją na dźwięczną.
 */

/** Sylaby dźwięczne i półdźwięczne, po znaku bazowym. */
const VOICED: Record<string, string> = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご',
  さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
}

const SEMI_VOICED: Record<string, string> = {
  は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ',
}

/** Znak dźwięczności i półdźwięczności jako klawisze modyfikujące. */
export const DAKUTEN = '゛'
export const HANDAKUTEN = '゜'

/**
 * Składa naciśnięte klawisze w tekst. Dakuten i handakuten działają wstecz, na ostatnią
 * wpisaną sylabę — dokładnie jak na klawiaturze systemowej.
 */
export function composeKana(keys: readonly string[]): string {
  const out: string[] = []

  for (const key of keys) {
    if (key === DAKUTEN || key === HANDAKUTEN) {
      const last = out.at(-1)
      if (!last) continue
      const table = key === DAKUTEN ? VOICED : SEMI_VOICED
      const swapped = table[last]
      if (swapped) out[out.length - 1] = swapped
      continue
    }
    out.push(key)
  }

  return out.join('')
}

/** Układ gojūon wierszami, plus małe kany i znaki dźwięczności. */
export const KANA_ROWS: readonly (readonly string[])[] = [
  [...'あいうえお'],
  [...'かきくけこ'],
  [...'さしすせそ'],
  [...'たちつてと'],
  [...'なにぬねの'],
  [...'はひふへほ'],
  [...'まみむめも'],
  [...'やゆよわをん'],
  [...'らりるれろ'],
  [...'っゃゅょぁぃぅぇぉー'],
  [DAKUTEN, HANDAKUTEN],
]
