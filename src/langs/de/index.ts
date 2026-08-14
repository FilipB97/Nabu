import type { LangAdapter } from '../types.ts'

/**
 * Niemiecki — klasa A z jedną własną cechą: złożeniami.
 *
 * `Geschwindigkeitsbegrenzung` jest jednym tokenem i jednym słowem, więc trafia do talii
 * jako jedna pozycja o bardzo rzadkiej randze. To nie jest usterka — takie słowo naprawdę
 * jest rzadkie jako całość — ale ma konsekwencję: górny limit tokenów w zdaniu może być
 * niższy niż w innych językach klasy A, bo niemieckie zdanie mieści tę samą treść
 * w mniejszej liczbie wyrazów.
 *
 * Rzeczowniki pisane wielką literą w środku zdania łamią heurystykę „wielka litera nie
 * na początku zdania = nazwa własna" z kroku 05. Ratuje ją drugi warunek tej heurystyki:
 * hasło musi być NIEOBECNE w Wikisłowniku. Niemieckie rzeczowniki pospolite w nim są,
 * więc przez filtr przechodzą; wypadają tylko te, których słownik nie zna — czyli
 * faktycznie nazwy własne i złożenia okazjonalne.
 */
export const de: LangAdapter = {
  code: 'de',
  name: 'niemiecki',
  tatoeba: 'deu',
  freq: 'de',
  freqSource: 'list',
  script: /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: false,
  needsReading: false,
  needsTranslit: false,
  blocklist: /\b(fick\w*|scheiß\w*|scheisse|fotze|arschloch|wichser)\b/iu,
  tokenizer: 'space',
  display: { font: 'display', size: 30, lineHeight: 1.55 },
  tts: { locale: 'de-DE', rate: 0.6 },
  // Górna granica niższa niż przy hiszpańskim: złożenia pakują w jeden token tyle,
  // co tam trzy, więc zdanie o 18 tokenach jest po niemiecku znacznie dłuższe.
  sentence: { minTokens: 4, maxTokens: 16, maxUnknown: 0, clozeSlack: 0 },
  maxBand: 12000,
  quiz: { shape: 'edit', minOptions: 4 },
  production: ['type'],
}
