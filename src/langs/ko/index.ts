import type { LangAdapter } from '../types.ts'

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
  script: /^[\p{Script=Hangul}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: true,
  needsReading: false,
  needsTranslit: true,
  blocklist: /씨발|개새끼|좋리/iu,
  tokenizer: 'space',
  display: { font: 'ko', size: 32, lineHeight: 1.75 },
  tts: { locale: 'ko-KR', rate: 0.5 },
  sentence: { minTokens: 4, maxTokens: 18 },
  quiz: { shape: 'jamo', minOptions: 4 },
  production: ['jamo'],
}
