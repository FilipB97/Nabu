import type { LangAdapter } from '../types.ts'

/**
 * Fiński — formalnie klasa A, w praktyce ma problem koreańskiego.
 *
 * Alfabet łaciński i spacje są, więc tokenizacja jest trywialna. Ale fiński ma piętnaście
 * przypadków i doklejane końcówki, przez co JEDNO słowo występuje w korpusie w dziesiątkach
 * form: `talo`, `talossa`, `talosta`, `taloon`, `talollani`. Lista częstości traktuje każdą
 * z nich jako osobne hasło, więc ranga tokenu kłamie dokładnie tak samo jak przy koreańskim:
 * najrzadszym słowem zdania bywa pospolity rzeczownik w rzadkim przypadku.
 *
 * Stąd te same trzy odstępstwa co w adapterze koreańskim i z tego samego powodu:
 *
 * - `maxUnknown: 1` — token spoza listy nie wywraca zdania, bo przy aglutynacji połowa
 *   form jest poza listą, choć same słowa są pospolite;
 * - `clozeSlack: 3` — luka nie musi być najrzadszym słowem zdania, bo „najrzadszy" liczy
 *   się po randze formy, a nie po randze słowa;
 * - `maxBand: 30000` — przy progu 12 000 wypadłyby podstawowe rzeczowniki w zwykłych
 *   przypadkach, bo ich częstość rozprasza się między formy.
 *
 * Właściwym lekarstwem jest tokenizer morfologiczny (omorfi albo voikko) sprowadzający
 * formę do rdzenia. Do tego czasu pasma fińskiego NIE SĄ porównywalne z pasmami
 * włoskiego czy niemieckiego — i to jest świadomy koszt, nie przeoczenie.
 */
export const fi: LangAdapter = {
  code: 'fi',
  name: 'fiński',
  tatoeba: 'fin',
  freq: 'fi',
  freqSource: 'list',
  script: /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: false,
  needsReading: false,
  needsTranslit: false,
  blocklist: /\b(vittu\w*|perkele|paska\w*|saatana|kyrp\w+|pillu)\b/iu,
  tokenizer: 'space',
  display: { font: 'display', size: 30, lineHeight: 1.55 },
  tts: { locale: 'fi-FI', rate: 0.6 },
  // Górna granica niższa niż przy włoskim: fińskie zdanie mieści tę samą treść w mniejszej
  // liczbie wyrazów, bo to, co po włosku jest przyimkiem i rodzajnikiem, tu jest końcówką.
  sentence: { minTokens: 3, maxTokens: 15, maxUnknown: 1, clozeSlack: 3 },
  maxBand: 30000,
  quiz: { shape: 'edit', minOptions: 4 },
  production: ['type', 'speak'],
}
