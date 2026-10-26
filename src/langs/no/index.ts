import type { LangAdapter } from '../types.ts'

/**
 * Norweski — klasa A, w odmianie bokmål.
 *
 * Norweski ma dwa równoprawne standardy pisane: bokmål (używany przez ~85% piszących)
 * i nynorsk. Tatoeba trzyma je pod osobnymi kodami (`nob`, `nno`) i nie da się ich
 * sensownie zmieszać — ta sama myśl ma w nich inny zapis, więc wspólna talia uczyłaby
 * dwóch ortografii naraz jako jednej. Bierzemy bokmål, bo jest częstszy i to jego
 * wariant mają systemowe głosy (`nb-NO`).
 *
 * Talia jest z założenia mniejsza niż szwedzka i WYPADA PONIŻEJ BRAMKI M1 (400 zdań):
 * wychodzi ich 336. Powód jest w danych, nie w filtrach — korpus norweski w Tatoebie
 * ma 16 tysięcy zdań bez żadnego polskiego tłumaczenia, a słownik bokmålu w Wikisłowniku
 * liczy 4651 haseł wobec 21 800 szwedzkich. Z 2749 kandydatów 914 odpada, bo nie ma
 * w nich ani jednego słowa, które da się zasłonić i oglosować.
 *
 * Próbowałem obniżyć próg długości zdania z czterech tokenów do trzech: daje 374, czyli
 * nadal poniżej bramki. Rozluźnianie `maxUnknown` albo `clozeSlack` dołożyłoby zdań,
 * ale kosztem rozstrzygalności karty — a to jest dokładnie ta zamiana, której sekcja
 * o jakości kart zabrania. Talia zostaje mała i jest to świadomy wybór.
 */
export const no: LangAdapter = {
  code: 'no',
  name: 'norweski',
  tatoeba: 'nob',
  freq: 'no',
  // Wikisłownik rozdziela bokmål i nynorsk; uczymy bokmålu, więc `nb`.
  wiktionary: 'nb',
  freqSource: 'list',
  script: /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: false,
  needsReading: false,
  needsTranslit: false,
  blocklist: /\b(faen|helvete|dritt\w*|kuk|fitte|jævla)\b/iu,
  tokenizer: 'space',
  display: { font: 'display', size: 30, lineHeight: 1.55 },
  tts: { locale: 'nb-NO', rate: 0.6 },
  sentence: { minTokens: 4, maxTokens: 18, maxUnknown: 0, clozeSlack: 0 },
  maxBand: 12000,
  quiz: { shape: 'edit', minOptions: 4 },
  production: ['type', 'speak'],
}
