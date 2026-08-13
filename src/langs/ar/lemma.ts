/**
 * Kandydaci na postać hasłową dla arabskiego — sekcja 10.1.
 *
 * Arabski przykleja do rzeczownika to, co polski zapisuje osobno: rodzajnik `ال`,
 * spójnik `و` („i"), przyimki `ب` („w, przez") i `ل` („dla"). `وبالمدرسة` to jeden
 * wyraz i cztery cząstki: „i w szkole". Dla listy częstości i dla słownika taka forma
 * jest nowym słowem, więc bez zdejmowania przedrostków połowa rzeczowników pospolitych
 * wypada poza pasmo tylko dlatego, że stoi z rodzajnikiem.
 *
 * Zdejmujemy WYŁĄCZNIE przedrostki i tylko wtedy, gdy zostaje sensownej długości rdzeń.
 * Wywołujący bierze pierwszego kandydata obecnego w słowniku, więc nadgorliwość kosztuje
 * niewiele — ale `ولد` („chłopiec") nie może zostać obcięte do `لد`, bo `و` jest tu
 * częścią słowa, a nie spójnikiem.
 */

/** Najkrótszy rdzeń, jaki zostawiamy. Arabskie słowo ma zwykle trzy spółgłoski. */
const MIN_STEM = 3

/** Przedrostki od najdłuższego, żeby `وال` zdjąć w całości, zanim spróbujemy `و`. */
const PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ف', 'ب', 'ك', 'ل']

/** Końcówki, które najczęściej doklejają się do rzeczownika: liczba mnoga i zaimki. */
const SUFFIXES = ['ات', 'ان', 'ون', 'ين', 'ها', 'هم', 'نا', 'كم', 'ه', 'ي', 'ك']

export function lemmaCandidates(surface: string): string[] {
  const out: string[] = [surface]

  const withoutPrefix = (word: string): string | null => {
    for (const prefix of PREFIXES) {
      if (word.startsWith(prefix) && word.length - prefix.length >= MIN_STEM) {
        return word.slice(prefix.length)
      }
    }
    return null
  }

  const stem = withoutPrefix(surface)
  if (stem) out.push(stem)

  // Sufiks zdejmujemy zarówno z formy pełnej, jak i z tej bez przedrostka: `والكتب`
  // („i książki") wymaga obu cięć naraz, żeby dojść do `كتاب`.
  for (const base of stem ? [surface, stem] : [surface]) {
    for (const suffix of SUFFIXES) {
      if (base.endsWith(suffix) && base.length - suffix.length >= MIN_STEM) {
        out.push(base.slice(0, -suffix.length))
      }
    }
  }

  return [...new Set(out)]
}
