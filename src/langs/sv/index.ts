import type { LangAdapter } from '../types.ts'

/** Szwedzki — klasa A. */
export const sv: LangAdapter = {
  code: 'sv',
  name: 'szwedzki',
  tatoeba: 'swe',
  freq: 'sv',
  freqSource: 'list',
  script: /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: false,
  needsReading: false,
  needsTranslit: false,
  blocklist: /knulla|fitta|kuk|jävla|helvete|skit/iu,
  tokenizer: 'space',
  display: { font: 'display', size: 30, lineHeight: 1.55 },
  tts: { locale: 'sv-SE', rate: 0.6 },
  sentence: { minTokens: 4, maxTokens: 18, maxUnknown: 0, clozeSlack: 0 },
  maxBand: 12000,
  quiz: { shape: 'edit', minOptions: 4 },
  production: ['type', 'speak'],
}
