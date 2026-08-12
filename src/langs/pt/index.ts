import type { LangAdapter } from '../types.ts'

/** Portugalski — klasa A. Ostrzegamy przy jednoczesnym uruchomieniu z hiszpańskim. */
export const pt: LangAdapter = {
  code: 'pt',
  name: 'portugalski',
  tatoeba: 'por',
  freq: 'pt',
  freqSource: 'list',
  script: /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: false,
  needsReading: false,
  needsTranslit: false,
  blocklist: /foder|caralho|puta|merda|buceta|porra|cacete|viado/iu,
  tokenizer: 'space',
  display: { font: 'display', size: 30, lineHeight: 1.55 },
  tts: { locale: 'pt-PT', rate: 0.6 },
  sentence: { minTokens: 4, maxTokens: 18, maxUnknown: 0, clozeSlack: 0 },
  maxBand: 12000,
  quiz: { shape: 'edit', minOptions: 4 },
  production: ['type'],
}
