import type { LangAdapter } from '../types.ts'

/**
 * Chiński standardowy — klasa C. Brak spacji wymusza segmentację, ale w odróżnieniu
 * od japońskiego nie ma niejednoznacznych czytań: znak ma pinyin, a pinyin ma ton.
 *
 * Dwie rzeczy poszły łatwiej, niż zakładał plan. Lista częstości FrequencyWords dla
 * chińskiego JEST posegmentowana na słowa (`喜欢` ranga 99, `图书馆` 4409), więc nie
 * trzeba jej liczyć z korpusu jak przy japońskim. Segmentację załatwia zachłanne
 * dopasowanie do CC-CEDICT, bez analizatora morfologicznego.
 *
 * Brak trybu `type` z tego samego powodu co przy japońskim: wpisywanie przez systemowy
 * IME polega na wybraniu znaku z listy kandydatów, czyli na rozpoznaniu (sekcja 7.2).
 * Zostaje rysowanie.
 */
export const zh: LangAdapter = {
  code: 'zh',
  name: 'chiński',
  tatoeba: 'cmn',
  freq: 'zh_cn',
  freqSource: 'list',
  script: /^[\p{Script=Han}\p{P}\p{Zs}\d、。「」]+$/u,
  rtl: false,
  // Znaki nie są osobnym alfabetem do opanowania przed słowami — one SĄ słowami.
  // Uczymy ich razem ze słownictwem, więc etap 0 nie ma tu czego obsługiwać.
  hasScriptStage: false,
  needsReading: true,
  needsTranslit: true,
  tokenizer: 'dict',
  blocklist: /操你|傻逼|婊子|王八蛋|混蛋|他妈的/iu,
  display: { font: 'ja', size: 34, lineHeight: 2 },
  tts: { locale: 'zh-CN', rate: 0.5 },
  sentence: { minTokens: 4, maxTokens: 20, maxUnknown: 1, clozeSlack: 1 },
  maxBand: 12000,
  quiz: {
    // Tylko rzeczowniki: chiński nie odmienia, więc problem form odmienionych nie
    // istnieje, ale czasowniki i przymiotniki bywają w Wikisłowniku glosowane opisowo.
    clozePos: ['noun'],
    shape: 'kanji-components',
    minOptions: 4,
  },
  production: ['draw'],
}
