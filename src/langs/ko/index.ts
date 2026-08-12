import type { LangAdapter } from '../types.ts'
import { lemmaCandidates } from './lemma.ts'
import { splitParticle } from './particles.ts'

/**
 * Koreański — klasa B. Hangul jest w pełni fonetyczny i ma spacje, więc potrzebny
 * jest tylko etap 0 i opcjonalna romanizacja. `space` wystarczy do v1: aglutynacja
 * końcówek obniża trafność dopasowania do listy częstości, ale nie na tyle,
 * żeby to blokowało start (sekcja 10.1a).
 *
 * Produkcja przez wbudowaną klawiaturę jamo, nie przez systemowy IME — użytkownik
 * nie musi mieć zainstalowanej koreańskiej klawiatury (sekcja 7.2).
 */
export const ko: LangAdapter = {
  code: 'ko',
  name: 'koreański',
  tatoeba: 'kor',
  freq: 'ko',
  freqSource: 'list',
  script: /^[\p{Script=Hangul}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: true,
  needsReading: false,
  needsTranslit: true,
  blocklist: /씨발|시발|개새끼|병신|좆|지랄|썅/iu,
  tokenizer: 'space',
  display: { font: 'ko', size: 32, lineHeight: 1.75 },
  tts: { locale: 'ko-KR', rate: 0.5 },
  // Koreański pakuje w jedno słowo tyle, co hiszpański w dwa: 43% zdań w korpusie
  // ma dwa albo trzy tokeny. Próg 4 odrzucałby połowę materiału bez powodu.
  sentence: { minTokens: 3, maxTokens: 16, maxUnknown: 1, clozeSlack: 3 },
  maxBand: 30000,
  quiz: { clozePos: ['noun', 'adv'], shape: 'jamo', minOptions: 4 },
  production: ['jamo'],
  lemmaCandidates,
  splitToken: splitParticle,
}
