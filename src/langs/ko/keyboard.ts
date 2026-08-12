import { compose, FINALS, INITIALS, MEDIALS } from './hangul.ts'

/**
 * Klawiatura jamo i składanie sylab — sekcja 7.2 planu, karta `produce-jamo`.
 *
 * Systemowa klawiatura hangul istnieje, ale wymaga, żeby użytkownik sam ją zainstalował
 * i przełączał. Własna kosztuje kilkadziesiąt linii, bo hangul składa się arytmetycznie
 * — i daje pełną kontrolę nad tym, czego test dotyczy: użytkownik ma odtworzyć zapis
 * litera po literze, bez listy kandydatów.
 *
 * Klawisze są w bloku „jamo zgodnościowe" (`ㄱ`, U+3131), a `compose` z `hangul.ts`
 * pracuje na blokach łączących (`ᄀ`, U+1100). Mapowanie między nimi to indeksy
 * w standardowej kolejności — dlatego trzy poniższe napisy MUSZĄ być zgodne co do
 * kolejności z tablicami w `hangul.ts`.
 */

/** Spółgłoski w kolejności nagłosu — te same 19 pozycji co `INITIALS`. */
const INITIAL_KEYS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ']

/** Samogłoski w kolejności śródgłosu — te same 21 pozycji co `MEDIALS`. */
const MEDIAL_KEYS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ']

/** Wygłos: pozycja 0 to brak, reszta w kolejności `FINALS`. */
const FINAL_KEYS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ']

if (
  INITIAL_KEYS.length !== INITIALS.length ||
  MEDIAL_KEYS.length !== MEDIALS.length ||
  FINAL_KEYS.length !== FINALS.length
) {
  throw new Error('Klawisze jamo rozjechały się z tablicami składania w hangul.ts')
}

const isVowel = (key: string) => MEDIAL_KEYS.includes(key)

type Syllable = { initial: number; medial: number; final: number }

/**
 * Składa ciąg naciśniętych jamo w tekst hangulu.
 *
 * Zasada jest ta sama, co w każdej klawiaturze koreańskiej: spółgłoska zaczyna sylabę,
 * samogłoska ją domyka, kolejna spółgłoska staje się wygłosem — a jeśli po wygłosie
 * przyjdzie samogłoska, wygłos PRZECHODZI do następnej sylaby jako jej nagłos.
 * Bez tej ostatniej reguły `무` + `ㄹ` + `ㅏ` dałoby `물아` zamiast `무라`, czyli
 * dokładnie ten rodzaj błędu, który uczący się zobaczy natychmiast.
 */
export function composeJamo(keys: readonly string[]): string {
  let out = ''
  let cur: Syllable | null = null

  const flush = () => {
    if (!cur) return
    // Sylaba bez samogłoski nie istnieje — zostawiamy samo jamo, żeby użytkownik
    // widział, co nacisnął, zamiast patrzeć na znikające klawisze.
    out += cur.medial < 0 ? (INITIAL_KEYS[cur.initial] ?? '') : compose(cur)
    cur = null
  }

  for (const key of keys) {
    if (isVowel(key)) {
      const medial = MEDIAL_KEYS.indexOf(key)
      if (cur && cur.medial < 0) {
        cur.medial = medial
      } else if (cur && cur.final > 0) {
        // Wygłos okazał się nagłosem następnej sylaby.
        const moved: string = FINAL_KEYS[cur.final] ?? ''
        cur.final = 0
        flush()
        cur = { initial: Math.max(0, INITIAL_KEYS.indexOf(moved)), medial, final: 0 }
      } else {
        flush()
        out += key
      }
      continue
    }

    const asInitial = INITIAL_KEYS.indexOf(key)
    const asFinal = FINAL_KEYS.indexOf(key)

    if (cur && cur.medial >= 0 && cur.final === 0 && asFinal > 0) {
      cur.final = asFinal
      continue
    }

    flush()
    if (asInitial >= 0) cur = { initial: asInitial, medial: -1, final: 0 }
    else out += key
  }

  flush()
  return out
}

/**
 * Układ klawiatury: spółgłoski, samogłoski proste, dwugłoski. Nie jest to układ 2-Set
 * ze sprzętowej klawiatury koreańskiej — ten uczy pozycji palców, a nie liter.
 * Tutaj chodzi o odtworzenie zapisu, więc litery są ułożone tak, jak się ich uczymy.
 */
export const JAMO_ROWS: readonly (readonly string[])[] = [
  [...'ㄱㄴㄷㄹㅁㅂㅅ'],
  [...'ㅇㅈㅊㅋㅌㅍㅎ'],
  [...'ㄲㄸㅃㅆㅉ'],
  [...'ㅏㅑㅓㅕㅗㅛ'],
  [...'ㅜㅠㅡㅣㅐㅔ'],
  [...'ㅘㅙㅚㅝㅞㅟㅢ'],
]
