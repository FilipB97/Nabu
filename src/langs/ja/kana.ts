/**
 * Narzędzia kany — sekcja 9 planu (furigana) i 7.2 (karta `produce-kana`).
 *
 * Analizator morfologiczny podaje czytania katakaną, a furigana nad kanji pisze się
 * hiraganą. Zamiana jest arytmetyczna: bloki Unicode są ułożone równolegle, więc
 * wystarczy przesunięcie o 0x60.
 */

import type { ScriptItem } from '../types.ts'

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

/**
 * Inwentarz kany dla etapu 0 — sekcja 2a.
 *
 * Dwa razy po 46 znaków podstawowych, bez dakuten i handakuten: `が` to `か` ze znakiem
 * dźwięczności, więc jest regułą do zrozumienia, a nie osobnym znakiem do zapamiętania.
 * Wprowadzanie ich jako oddzielnych pozycji podwoiłoby etap 0 i uczyło tej samej rzeczy
 * drugi raz.
 *
 * Kolejność jest tradycyjna (gojūon), bo w tej kolejności kana jest uporządkowana
 * we wszystkich materiałach — łamanie jej utrudniłoby korzystanie z czegokolwiek poza
 * tą aplikacją.
 */
const GOJUON: ReadonlyArray<[hiragana: string, katakana: string, romaji: string]> = [
  ['あ', 'ア', 'a'], ['い', 'イ', 'i'], ['う', 'ウ', 'u'], ['え', 'エ', 'e'], ['お', 'オ', 'o'],
  ['か', 'カ', 'ka'], ['き', 'キ', 'ki'], ['く', 'ク', 'ku'], ['け', 'ケ', 'ke'], ['こ', 'コ', 'ko'],
  ['さ', 'サ', 'sa'], ['し', 'シ', 'shi'], ['す', 'ス', 'su'], ['せ', 'セ', 'se'], ['そ', 'ソ', 'so'],
  ['た', 'タ', 'ta'], ['ち', 'チ', 'chi'], ['つ', 'ツ', 'tsu'], ['て', 'テ', 'te'], ['と', 'ト', 'to'],
  ['な', 'ナ', 'na'], ['に', 'ニ', 'ni'], ['ぬ', 'ヌ', 'nu'], ['ね', 'ネ', 'ne'], ['の', 'ノ', 'no'],
  ['は', 'ハ', 'ha'], ['ひ', 'ヒ', 'hi'], ['ふ', 'フ', 'fu'], ['へ', 'ヘ', 'he'], ['ほ', 'ホ', 'ho'],
  ['ま', 'マ', 'ma'], ['み', 'ミ', 'mi'], ['む', 'ム', 'mu'], ['め', 'メ', 'me'], ['も', 'モ', 'mo'],
  ['や', 'ヤ', 'ya'], ['ゆ', 'ユ', 'yu'], ['よ', 'ヨ', 'yo'],
  ['ら', 'ラ', 'ra'], ['り', 'リ', 'ri'], ['る', 'ル', 'ru'], ['れ', 'レ', 're'], ['ろ', 'ロ', 'ro'],
  ['わ', 'ワ', 'wa'], ['を', 'ヲ', 'wo'],
  ['ん', 'ン', 'n'],
]

/** Samogłoska kończąca czytanie — po niej grupujemy dystraktory. */
function vowelOf(romaji: string): string {
  return /[aeiou]$/.test(romaji) ? romaji.slice(-1) : romaji
}

export function kanaItems(): ScriptItem[] {
  const items: ScriptItem[] = []
  // Najpierw cała hiragana, potem katakana: to są dwa systemy do opanowania, a nie
  // jeden z dwoma wariantami. Przeplatanie ich dawałoby karty あ / ア obok siebie,
  // czyli dokładnie tę parę, której nie da się rozróżnić po czytaniu.
  for (const [hira, , romaji] of GOJUON) {
    items.push({ s: hira, r: romaji, group: `hiragana-${vowelOf(romaji)}` })
  }
  for (const [, kata, romaji] of GOJUON) {
    items.push({ s: kata, r: romaji, group: `katakana-${vowelOf(romaji)}` })
  }
  return items
}

/**
 * Wyjaśnienie pojedynczego znaku przy pierwszym spotkaniu — sekcja 2a.
 *
 * Kana jest systemem, nie zbiorem obrazków: wiersz `k` to te same pięć samogłosek
 * z jedną spółgłoską z przodu, a każdy znak niesie całą sylabę. Powiedzenie tego przy
 * pierwszym `か` jest warte więcej niż dziesięć powtórek, w których użytkownik zgaduje
 * między `ka`, `ki` i `ku` — bo po tym zdaniu wie, czego szukać w kształcie.
 */
export function kanaNote(item: ScriptItem): string {
  const katakana = item.group.startsWith('katakana')
  const system = katakana
    ? 'Katakana: te same sylaby co w hiraganie, inny zapis. Pisze się nią słowa obce, nazwy i dźwięki.'
    : 'Hiragana: podstawowe pismo sylabiczne. Jeden znak to cała sylaba, zawsze czytana tak samo.'

  if (item.r === 'n') {
    return `${system} To jedyny znak bez samogłoski — samo „n" na końcu sylaby.`
  }
  if (item.r.length === 1) {
    return `${system} Czysta samogłoska „${item.r}" — od niej zaczyna się cały jej rząd.`
  }

  const vowel = item.r.slice(-1)
  const consonant = item.r.slice(0, -1)
  return (
    `${system} Sylaba „${item.r}" to ${consonant} + ${vowel}; ` +
    `wszystkie znaki tego rzędu kończą się na „${vowel}".`
  )
}
