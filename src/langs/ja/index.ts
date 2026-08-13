import type { LangAdapter } from '../types.ts'
import { kanaItems, kanaNote, needsFurigana } from './kana.ts'
import { KANA_ROWS, composeKana } from './keyboard.ts'

/**
 * Japoński — klasa C. Brak spacji wymusza segmentację morfologiczną, a kanji mają
 * niejednoznaczne czytania zależne od kontekstu.
 *
 * Interlinia jest znacząco większa niż w pozostałych językach, bo nad znakami staje
 * furigana i miejsce na nią rezerwujemy z góry — układ nie może skakać w momencie
 * jej pojawienia się (sekcja 9 planu).
 *
 * Brak trybu `type`: wpisywanie kanji przez systemowy IME jest testem pozornym,
 * bo listę kandydatów podaje IME. Zostają rysowanie i wpisanie czytania (sekcja 7.2).
 */
export const ja: LangAdapter = {
  code: 'ja',
  name: 'japoński',
  tatoeba: 'jpn',
  freq: 'ja',
  freqSource: 'corpus',
  script: /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{P}\p{Zs}\dー々]+$/u,
  rtl: false,
  hasScriptStage: true,
  needsReading: true,
  needsTranslit: true,
  blocklist: /クソ|ちんこ|べっちょ|セックス/iu,
  tokenizer: 'morph',
  display: { font: 'ja', size: 34, lineHeight: 2 },
  tts: { locale: 'ja-JP', rate: 0.4 },
  // Analizator morfologiczny rozbija na cząstki gramatyczne, więc to samo zdanie
  // daje więcej tokenów niż podział po spacjach. Progi odpowiednio wyżej.
  sentence: { minTokens: 5, maxTokens: 24, maxUnknown: 1, clozeSlack: 1 },
  maxBand: 20000,
  quiz: {
    // Tylko rzeczowniki. Czasowniki i przymiotniki trafiałyby do opcji w formie
    // odmienionej (`大きく`, `歌い`), a ich glosa opisuje formę słownikową — cztery
    // opcje w różnych formach są wskazówką gramatyczną, nie testem znajomości słowa.
    clozePos: ['noun'],
    shape: 'kanji-components',
    minOptions: 4,
  },
  production: ['draw', 'kana'],
  scriptItems: kanaItems,
  scriptAbout:
    'Japoński zapisuje się trzema pismami naraz. Kana — hiragana i katakana — jest ' +
    'sylabiczna: jeden znak to jedna sylaba, czytana zawsze tak samo. Kanji przychodzą ' +
    'później i nad nimi i tak stoi kana, więc od niej trzeba zacząć. Znaków jest 2 × 46 ' +
    'i układają się w tabelę pięciu samogłosek na dziewięć spółgłosek.',
  scriptNote: kanaNote,
  showReading: needsFurigana,
  keyboard: { rows: KANA_ROWS, compose: composeKana },
}
