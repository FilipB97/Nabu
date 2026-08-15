import type { LangAdapter } from '../types.ts'

/** Hiszpański — klasa A: alfabet łaciński, spacje, brak czytań i transkrypcji. */
export const es: LangAdapter = {
  code: 'es',
  name: 'hiszpański',
  tatoeba: 'spa',
  freq: 'es',
  freqSource: 'list',
  script: /^[\p{Script=Latin}\p{P}\p{Zs}\d¡¿]+$/u,
  rtl: false,
  hasScriptStage: false,
  needsReading: false,
  needsTranslit: false,
  blocklist: /follar|joder|coño|puta|puto|mierda|polla|cojones|gilipollas|cabrón/iu,
  tokenizer: 'space',
  display: { font: 'display', size: 30, lineHeight: 1.55 },
  tts: { locale: 'es-ES', rate: 0.6 },
  sentence: { minTokens: 4, maxTokens: 18, maxUnknown: 0, clozeSlack: 0 },
  maxBand: 12000,
  quiz: { shape: 'edit', minOptions: 4 },
  production: ['type', 'speak'],
}
