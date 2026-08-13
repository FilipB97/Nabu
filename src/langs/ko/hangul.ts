/**
 * Składanie i rozkład sylab hangulu.
 *
 * Jedna implementacja, dwa zastosowania (sekcja 10.1b planu): klawiatura jamo przy
 * karcie `produce-jamo` oraz podobieństwo kształtu przy doborze dystraktorów — para
 * 물 / 불 / 말 różni się jednym jamo i to jest dokładnie ta trudność, którą chcemy
 * postawić przed użytkownikiem.
 *
 * Blok Hangul Syllables jest w Unicode ułożony arytmetycznie:
 *   kod = 0xAC00 + (초성 × 588) + (중성 × 28) + 종성
 * czyli rozkład i złożenie to dzielenie z resztą, bez tablic i bez słownika.
 */

const SYLLABLE_BASE = 0xac00
const SYLLABLE_COUNT = 11172
const MEDIAL_COUNT = 21
const FINAL_COUNT = 28

/** 초성 — 19 spółgłosek nagłosowych, w kolejności unikodowej. */
import type { ScriptBatch, ScriptItem } from '../types.ts'

export const INITIALS = [...'ᄀᄁᄂᄃᄄᄅᄆᄇᄈᄉᄊᄋᄌᄍᄎᄏᄐᄑᄒ']

/** 중성 — 21 samogłosek. */
export const MEDIALS = [...'ᅡᅢᅣᅤᅥᅦᅧᅨᅩᅪᅫᅬᅭᅮᅯᅰᅱᅲᅳᅴᅵ']

/** 종성 — 27 spółgłosek wygłosowych; indeks 0 oznacza brak wygłosu. */
export const FINALS = ['', ...'ᆨᆩᆪᆫᆬᆭᆮᆯᆰᆱᆲᆳᆴᆵᆶᆷᆸᆹᆺᆻᆼᆽᆾᆿᇀᇁᇂ']

export type Jamo = { initial: number; medial: number; final: number }

/** Czy znak jest złożoną sylabą hangulu z bloku Hangul Syllables. */
export function isSyllable(char: string): boolean {
  const code = char.codePointAt(0)
  return code !== undefined && code >= SYLLABLE_BASE && code < SYLLABLE_BASE + SYLLABLE_COUNT
}

/** Rozkłada sylabę na indeksy jamo. Zwraca `null` dla znaku spoza bloku sylab. */
export function decompose(char: string): Jamo | null {
  if (!isSyllable(char)) return null
  const offset = char.codePointAt(0)! - SYLLABLE_BASE
  return {
    initial: Math.floor(offset / (MEDIAL_COUNT * FINAL_COUNT)),
    medial: Math.floor(offset / FINAL_COUNT) % MEDIAL_COUNT,
    final: offset % FINAL_COUNT,
  }
}

/** Składa indeksy jamo z powrotem w sylabę. */
export function compose({ initial, medial, final }: Jamo): string {
  if (initial < 0 || initial >= INITIALS.length)
    throw new RangeError(`초성 poza zakresem: ${initial}`)
  if (medial < 0 || medial >= MEDIAL_COUNT) throw new RangeError(`중성 poza zakresem: ${medial}`)
  if (final < 0 || final >= FINAL_COUNT) throw new RangeError(`종성 poza zakresem: ${final}`)
  return String.fromCodePoint(
    SYLLABLE_BASE + (initial * MEDIAL_COUNT + medial) * FINAL_COUNT + final,
  )
}

/**
 * Rozkłada cały wyraz na ciąg indeksów jamo, po jednym elemencie na jamo.
 * Znaki spoza bloku sylab przechodzą bez zmiany, dzięki czemu porównanie działa
 * także dla tekstu z interpunkcją i spacjami.
 */
export function toJamoSequence(text: string): string[] {
  const out: string[] = []
  for (const char of text) {
    const parts = decompose(char)
    if (!parts) {
      out.push(char)
      continue
    }
    out.push(INITIALS[parts.initial]!, MEDIALS[parts.medial]!)
    if (parts.final > 0) out.push(FINALS[parts.final]!)
  }
  return out
}

/**
 * Inwentarz hangulu dla etapu 0 — sekcja 2a.
 *
 * Czterdzieści liter, nie sylaby. Hangul jest alfabetem zapisywanym w blokach sylabowych,
 * więc opanowanie liter plus zasada składania (`compose` wyżej) wystarcza do przeczytania
 * dowolnej sylaby. Uczenie sylab osobno oznaczałoby 11 172 pozycje zamiast czterdziestu.
 *
 * Czytania w romanizacji poprawionej (RR) — tej samej, której używają słowniki, mapy
 * i nazwy własne. Transkrypcja polska („czo" zamiast `jo`) byłaby czytelniejsza na starcie
 * i bezużyteczna wszędzie indziej.
 *
 * `ㅇ` ma dwa czytania zależne od pozycji w sylabie i to jest jedyny znak, w którym
 * czytanie nie jest jednoznaczne. Zapisujemy oba, bo ukrycie tego wyszłoby na jaw
 * przy pierwszym słowie i wyglądałoby jak błąd danych.
 */
const LETTERS: ReadonlyArray<[litera: string, czytanie: string, klasa: string]> = [
  ['ㄱ', 'g / k', 'spółgłoska'], ['ㄴ', 'n', 'spółgłoska'], ['ㄷ', 'd / t', 'spółgłoska'],
  ['ㄹ', 'r / l', 'spółgłoska'], ['ㅁ', 'm', 'spółgłoska'], ['ㅂ', 'b / p', 'spółgłoska'],
  ['ㅅ', 's', 'spółgłoska'], ['ㅇ', 'nieme / ng', 'spółgłoska'], ['ㅈ', 'j', 'spółgłoska'],
  ['ㅊ', 'ch', 'spółgłoska'], ['ㅋ', 'k', 'spółgłoska'], ['ㅌ', 't', 'spółgłoska'],
  ['ㅍ', 'p', 'spółgłoska'], ['ㅎ', 'h', 'spółgłoska'],

  ['ㄲ', 'kk', 'spółgłoska napięta'], ['ㄸ', 'tt', 'spółgłoska napięta'],
  ['ㅃ', 'pp', 'spółgłoska napięta'], ['ㅆ', 'ss', 'spółgłoska napięta'],
  ['ㅉ', 'jj', 'spółgłoska napięta'],

  ['ㅏ', 'a', 'samogłoska'], ['ㅑ', 'ya', 'samogłoska'], ['ㅓ', 'eo', 'samogłoska'],
  ['ㅕ', 'yeo', 'samogłoska'], ['ㅗ', 'o', 'samogłoska'], ['ㅛ', 'yo', 'samogłoska'],
  ['ㅜ', 'u', 'samogłoska'], ['ㅠ', 'yu', 'samogłoska'], ['ㅡ', 'eu', 'samogłoska'],
  ['ㅣ', 'i', 'samogłoska'],

  ['ㅐ', 'ae', 'dwugłoska'], ['ㅒ', 'yae', 'dwugłoska'], ['ㅔ', 'e', 'dwugłoska'],
  ['ㅖ', 'ye', 'dwugłoska'], ['ㅘ', 'wa', 'dwugłoska'], ['ㅙ', 'wae', 'dwugłoska'],
  ['ㅚ', 'oe', 'dwugłoska'], ['ㅝ', 'wo', 'dwugłoska'], ['ㅞ', 'we', 'dwugłoska'],
  ['ㅟ', 'wi', 'dwugłoska'], ['ㅢ', 'ui', 'dwugłoska'],
]

export function jamoItems(): ScriptItem[] {
  return LETTERS.map(([s, r, group]) => ({ s, r, group }))
}

/**
 * Wyjaśnienie pojedynczej litery przy pierwszym spotkaniu — sekcja 2a.
 *
 * Hangul jest alfabetem, w którym kształt litery odpowiada układowi ust, a litery
 * składa się w bloki sylabowe. Użytkownik, który tego nie usłyszy, uczy się czterdziestu
 * kresek bez klucza — a z kluczem czyta dowolną sylabę po dwudziestu minutach.
 */
export function jamoNote(item: ScriptItem): string {
  if (item.group === 'samogłoska') {
    return (
      `Samogłoska „${item.r}". Kreska pionowa albo pozioma z kropką decyduje o brzmieniu; ` +
      'samogłoski stoją w bloku po prawej albo pod spółgłoską.'
    )
  }
  if (item.group === 'dwugłoska') {
    return `Dwugłoska „${item.r}" — złożenie dwóch samogłosek zapisane jako jeden znak.`
  }
  if (item.group === 'spółgłoska napięta') {
    return (
      `Spółgłoska napięta „${item.r}": ta sama litera podwojona, wymawiana mocniej ` +
      'i bez przydechu. Podwojenie zawsze znaczy napięcie.'
    )
  }
  return (
    `Spółgłoska „${item.r}". Sylaba zaczyna się od spółgłoski, więc ta litera stanie ` +
    'w bloku jako pierwsza.'
  )
}

/**
 * Zaczepy pamięciowe dla hangulu.
 *
 * W odróżnieniu od kany nie są umowne: kształty podstawowych spółgłosek RYSUJĄ układ
 * narządów mowy (ㄱ to podniesiony tył języka, ㅁ to zamknięte usta), a każda kreska
 * dołożona do kształtu podstawowego dokłada przydech. Hangul został tak zaprojektowany
 * w 1443 roku i powiedzenie tego wprost zamienia czterdzieści kresek w pięć kształtów
 * plus dwie reguły.
 */
const HINTS: Record<string, string> = {
  ㄱ: 'Tył języka podniesiony do podniebienia — dokładnie ten kształt.',
  ㄴ: 'Czubek języka oparty o wałek za zębami.',
  ㄷ: 'To ㄴ z dachem: ten sam język, mocniejsze zwarcie.',
  ㄹ: 'Zygzak — język podwija się i wraca; stąd dźwięk między r a l.',
  ㅁ: 'Zamknięte usta widziane z przodu — kwadrat.',
  ㅂ: 'Usta z ㅁ, które otwierają się do góry.',
  ㅅ: 'Powietrze przeciskane przez szczelinę — strzałka w dół.',
  ㅇ: 'Otwarte gardło. Na początku sylaby nieme, na końcu „ng".',
  ㅈ: 'To ㅅ z daszkiem — szczelina zaczyna się od zwarcia.',
  ㅊ: 'To ㅈ z dodatkową kreską: kreska zawsze znaczy przydech.',
  ㅋ: 'To ㄱ z dodatkową kreską — przydechowe k.',
  ㅌ: 'To ㄷ z dodatkową kreską — przydechowe t.',
  ㅍ: 'To ㅂ położone i uproszczone — przydechowe p.',
  ㅎ: 'Kapelusz nad otwartym gardłem — samo tchnienie.',

  ㄲ: 'Podwojone ㄱ. Podwojenie zawsze znaczy napięcie, nigdy przydech.',
  ㄸ: 'Podwojone ㄷ — mocniej i krócej, bez wydmuchu powietrza.',
  ㅃ: 'Podwojone ㅂ — mocniej i krócej, bez wydmuchu powietrza.',
  ㅆ: 'Podwojone ㅅ — syczące i napięte.',
  ㅉ: 'Podwojone ㅈ — mocniej i krócej, bez wydmuchu powietrza.',

  ㅏ: 'Pionowa kreska z kreseczką po prawej — usta otwarte szeroko.',
  ㅑ: 'To ㅏ z drugą kreseczką: druga kreska zawsze dokłada „j" z przodu.',
  ㅓ: 'Kreseczka po lewej zamiast po prawej — dźwięk cofnięty, jak „o" w słowie „sok".',
  ㅕ: 'To ㅓ z drugą kreseczką, czyli „jo" cofnięte.',
  ㅗ: 'Kreseczka nad poziomą kreską — usta zaokrąglone do „o".',
  ㅛ: 'To ㅗ z drugą kreseczką — „jo".',
  ㅜ: 'Kreseczka pod poziomą kreską — usta ściągnięte do „u".',
  ㅠ: 'To ㅜ z drugą kreseczką — „ju".',
  ㅡ: 'Sama pozioma kreska — usta rozciągnięte, dźwięk między y a u.',
  ㅣ: 'Sama pionowa kreska — proste „i".',

  ㅐ: 'Złożenie ㅏ i ㅣ — jedno „e", szersze niż ㅔ.',
  ㅒ: 'Złożenie ㅑ i ㅣ — „je".',
  ㅔ: 'Złożenie ㅓ i ㅣ — „e" węższe niż ㅐ; dziś różnica prawie zanikła.',
  ㅖ: 'Złożenie ㅕ i ㅣ — „je".',
  ㅘ: 'Złożenie ㅗ i ㅏ — „ła".',
  ㅙ: 'Złożenie ㅗ i ㅐ — „łe".',
  ㅚ: 'Złożenie ㅗ i ㅣ — dziś czytane jak „łe".',
  ㅝ: 'Złożenie ㅜ i ㅓ — „ło".',
  ㅞ: 'Złożenie ㅜ i ㅔ — „łe".',
  ㅟ: 'Złożenie ㅜ i ㅣ — „łi".',
  ㅢ: 'Złożenie ㅡ i ㅣ — wymawiane jednym ruchem, „yi".',
}

export function jamoMnemonic(item: ScriptItem): string | undefined {
  return HINTS[item.s]
}

/**
 * Porcje wprowadzania. Kolejność jest identyczna z `jamoItems()` — identyfikatory
 * pozycji w talii są indeksami tamtej listy, więc przestawienie porcji przestawiłoby
 * znaczenie kart, które użytkownik ma już w bazie.
 */
const BATCHES: ReadonlyArray<{ id: string; label: string; note: string; from: number; to: number }> = [
  {
    id: 'podstawowe-1',
    label: 'spółgłoski podstawowe',
    note: 'Pięć kształtów, z których zbudowany jest cały hangul. Każdy rysuje układ języka i ust przy wymowie.',
    from: 0,
    to: 5,
  },
  {
    id: 'podstawowe-2',
    label: 'spółgłoski dźwięczne',
    note: 'Cztery kolejne kształty. ㅇ jest wyjątkiem: na początku sylaby nie znaczy nic, na końcu czyta się „ng".',
    from: 5,
    to: 9,
  },
  {
    id: 'przydechowe',
    label: 'spółgłoski z przydechem',
    note: 'Wszystkie powstały przez dołożenie kreski do kształtu podstawowego. Kreska = wydmuch powietrza.',
    from: 9,
    to: 14,
  },
  {
    id: 'napiete',
    label: 'spółgłoski napięte',
    note: 'Litera podwojona: mocniej, krócej i BEZ wydmuchu. To jedyna reguła, jakiej trzeba do całej piątki.',
    from: 14,
    to: 19,
  },
  {
    id: 'samogloski-pionowe',
    label: 'samogłoski pionowe',
    note: 'Kreska pionowa z kreseczką po prawej albo po lewej. Druga kreseczka zawsze dokłada „j" z przodu.',
    from: 19,
    to: 23,
  },
  {
    id: 'samogloski-poziome',
    label: 'samogłoski poziome',
    note: 'Kreska pozioma z kreseczką nad albo pod. Ta sama reguła: druga kreseczka to „j".',
    from: 23,
    to: 29,
  },
  {
    id: 'dwugloski-1',
    label: 'dwugłoski',
    note: 'Od tej porcji nie ma nowych kształtów — są wyłącznie złożenia tego, co już znasz.',
    from: 29,
    to: 35,
  },
  {
    id: 'dwugloski-2',
    label: 'dwugłoski z ㅜ',
    note: 'Złożenia zaczynające się od ㅗ i ㅜ brzmią z „ł" na początku.',
    from: 35,
    to: 40,
  },
]

export function jamoBatches(): ScriptBatch[] {
  const items = jamoItems()
  return BATCHES.map((batch) => ({
    id: batch.id,
    label: batch.label,
    note: batch.note,
    items: items.slice(batch.from, batch.to),
  }))
}
