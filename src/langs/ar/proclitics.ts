/**
 * Rozdzielanie przedrostków zrośniętych z wyrazem — sekcja 10.1a, ten sam problem
 * co koreańskie partykuły, tylko z drugiej strony wyrazu.
 *
 * Arabski dokleja do rzeczownika od PRZODU: rodzajnik `ال` („ten"), spójnik `و` („i"),
 * przyimki `ب` („w"), `ل` („dla"), `ك` („jak") i partykułę `ف` („więc"). `والمدرسة`
 * to jeden wyraz i trzy cząstki: „i ta szkoła".
 *
 * Bez rozdzielenia luka wypada na całej zbitce, a cztery opcje quizu pokazują formy
 * słownikowe — czyli poprawna odpowiedź jest jedyną z rodzajnikiem i wybiera się ją
 * po kształcie, nie po znaczeniu. Po rozdzieleniu rodzajnik zostaje widoczny w zdaniu,
 * a luka obejmuje sam rzeczownik. To jest ta sama korzyść co przy koreańskim: cząstka
 * gramatyczna zostaje na oczach, bo uczący się ma umieć ją czytać.
 *
 * Reguła jest CELOWO WĄSKA. Jednoliterowe przedrostki tniemy wyłącznie wtedy, gdy stoją
 * przed rodzajnikiem — czyli gdy widać `وال`, `بال`, `كال`, `فال`. Inaczej `ولد`
 * („chłopiec") rozpadłoby się na `و` + `لد`, a `بيت` („dom") na `ب` + `يت`: pierwsza
 * litera wyrazu wygląda wtedy dokładnie jak przedrostek i nic w zapisie ich nie odróżnia.
 */

/** Najkrótszy rdzeń, jaki zostawiamy. Arabski rzeczownik ma zwykle trzy spółgłoski. */
const MIN_STEM = 3

/** Rodzajnik określony. Jedyna cząstka, którą wolno odciąć samodzielnie. */
const ARTICLE = 'ال'

/** Przedrostki jednoliterowe — tylko w towarzystwie rodzajnika. */
const BEFORE_ARTICLE = ['و', 'ف', 'ب', 'ك']

/** `لل` to `ل` + `ال` po ściągnięciu alifu: „dla tego". Zapisane razem, znaczy dwie rzeczy. */
const TO_THE = 'لل'

const ARABIC = /^[\p{Script=Arabic}]+$/u

export function splitProclitics(surface: string): Array<{ s: string; pos?: string }> {
  if (!ARABIC.test(surface)) return [{ s: surface }]

  // Cząstki dostają część mowy `particle`, przez co nie mogą zostać luką. Bez tego
  // powstawałyby karty z luką na samym rodzajniku.
  const particle = (s: string) => ({ s, pos: 'particle' })

  for (const prefix of BEFORE_ARTICLE) {
    const combined = prefix + ARTICLE
    if (surface.startsWith(combined) && surface.length - combined.length >= MIN_STEM) {
      return [particle(prefix), particle(ARTICLE), { s: surface.slice(combined.length) }]
    }
  }

  if (surface.startsWith(TO_THE) && surface.length - TO_THE.length >= MIN_STEM) {
    return [particle(TO_THE), { s: surface.slice(TO_THE.length) }]
  }

  if (surface.startsWith(ARTICLE) && surface.length - ARTICLE.length >= MIN_STEM) {
    return [particle(ARTICLE), { s: surface.slice(ARTICLE.length) }]
  }

  return [{ s: surface }]
}
