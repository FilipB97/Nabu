import type { LangAdapter } from '../types.ts'

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
  maxBand: 12000,
  quiz: { shape: 'kanji-components', minOptions: 4 },
  production: ['draw', 'kana'],
}
