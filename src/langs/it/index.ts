import type { LangAdapter } from '../types.ts'

/**
 * Włoski — klasa A, najbliższy hiszpańskiemu z całego zestawu.
 *
 * Fleksja jest umiarkowana, zapis odpowiada wymowie niemal jeden do jednego, a korpus
 * Tatoeby należy do największych. Z polskiego punktu widzenia to język, w którym
 * najmniej rzeczy może pójść źle — i dlatego progi zostają takie jak przy hiszpańskim,
 * bez strojenia pod cokolwiek.
 *
 * Apostrof jest częścią wyrazu (`l'acqua`, `dall'alto`), ale `\p{P}` go obejmuje, więc
 * reguła zapisu nie wymaga wyjątku. Tokenizer po spacjach zostawia go przy wyrazie —
 * ta sama decyzja co przy katalońskim `l'aigua` w kroku 02.
 */
export const it: LangAdapter = {
  code: 'it',
  name: 'włoski',
  tatoeba: 'ita',
  freq: 'it',
  freqSource: 'list',
  script: /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: false,
  needsReading: false,
  needsTranslit: false,
  blocklist: /\b(cazzo\w*|merda|stronz\w+|figa|troia|vaffanculo|coglion\w+)\b/iu,
  tokenizer: 'space',
  display: { font: 'display', size: 30, lineHeight: 1.55 },
  tts: { locale: 'it-IT', rate: 0.6 },
  sentence: { minTokens: 4, maxTokens: 18, maxUnknown: 0, clozeSlack: 0 },
  maxBand: 12000,
  quiz: { shape: 'edit', minOptions: 4 },
  production: ['type', 'speak'],
}
