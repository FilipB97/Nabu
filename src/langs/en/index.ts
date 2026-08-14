import type { LangAdapter } from '../types.ts'

/**
 * Angielski — klasa A, ale z dwoma odstępstwami, o których trzeba wiedzieć.
 *
 * **Jest językiem pośredniczącym pipeline'u.** Dla pozostałych języków zdanie bez
 * bezpośredniego tłumaczenia na polski dostaje je przez angielski. Tutaj ta warstwa
 * nie istnieje — `eng-eng_links` nie ma i nie może być — więc cała talia stoi na
 * tłumaczeniach wprost. Ich jest dużo (angielski i polski to najgęściej powiązana
 * para w Tatoebie), więc to nie jest strata, tylko uproszczenie: każde zdanie w talii
 * ma tłumaczenie napisane przez człowieka, żadne nie przyszło łańcuchem.
 *
 * **Zapis nie mówi wymowy.** Angielski jest pod tym względem bliżej japońskiego niż
 * hiszpańskiego: `though`, `through`, `tough` i `thought` różnią się wymową w sposób,
 * którego z liter nie da się wyprowadzić. Nie zakładamy jednak etapu 0 — nie ma tu
 * skończonego inwentarza do opanowania (angielska ortografia to zbiór wyjątków, nie
 * system), a użytkownik i tak zna ten alfabet. Wymowy uczy dźwięk na karcie.
 */
export const en: LangAdapter = {
  code: 'en',
  name: 'angielski',
  tatoeba: 'eng',
  freq: 'en',
  freqSource: 'list',
  // Apostrof jest w angielskim częścią wyrazu (`don't`, `it's`), a nie interpunkcją
  // — ale `\p{P}` i tak go obejmuje, więc regex zostaje taki sam jak w klasie A.
  script: /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u,
  rtl: false,
  hasScriptStage: false,
  needsReading: false,
  needsTranslit: false,
  blocklist: /\b(fuck|shit|cunt|bitch|dick|whore)\w*\b/iu,
  tokenizer: 'space',
  display: { font: 'display', size: 30, lineHeight: 1.55 },
  // `en-US`, nie `en-GB`: to jest wariant, który każdy system ma na pewno, a różnica
  // między nimi nie zmienia niczego w rozpoznawaniu słowa ze słuchu.
  tts: { locale: 'en-US', rate: 0.6 },
  sentence: { minTokens: 4, maxTokens: 18, maxUnknown: 0, clozeSlack: 0 },
  maxBand: 12000,
  quiz: { shape: 'edit', minOptions: 4 },
  production: ['type'],
}
