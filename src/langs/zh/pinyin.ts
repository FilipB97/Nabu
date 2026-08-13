import type { ScriptBatch, ScriptItem } from '../types.ts'

/**
 * Pinyin z zapisu cyfrowego na diakrytyczny.
 *
 * CC-CEDICT zapisuje tony liczbami (`chuan2 tong3`), a użytkownik ma zobaczyć
 * `chuán tǒng`. Zapis cyfrowy jest wygodny w pliku i bezużyteczny na karcie: ton jest
 * w chińskim częścią słowa, nie ozdobą, więc musi być widoczny tam, gdzie pada wzrok.
 *
 * Reguła stawiania znaku, w kolejności: `a` i `e` zawsze wygrywają; w `ou` znak idzie
 * na `o`; poza tym na ostatnią samogłoskę. To jest oficjalna zasada, nie przybliżenie.
 */

const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

/** Samogłoska, która przyjmuje znak tonu. */
function markedVowel(syllable: string): number {
  const lower = syllable.toLowerCase()
  const a = lower.indexOf('a')
  if (a >= 0) return a
  const e = lower.indexOf('e')
  if (e >= 0) return e
  const ou = lower.indexOf('ou')
  if (ou >= 0) return ou
  for (let i = lower.length - 1; i >= 0; i--) {
    if ('aeiouü'.includes(lower[i]!)) return i
  }
  return -1
}

/** Zamienia jedną sylabę z zapisu cyfrowego. `nu:3` → `nǚ`, `ma5` → `ma`. */
export function syllableToDiacritics(raw: string): string {
  const withUmlaut = raw.replace(/u:/g, 'ü').replace(/v/g, 'ü')
  const match = /^([a-zA-Zü]+)([1-5])$/.exec(withUmlaut)
  if (!match) return withUmlaut

  const [, letters, digit] = match
  const tone = Number(digit)
  // Ton neutralny (5) nie ma znaku — i to jest informacja, nie jego brak.
  if (tone === 5) return letters!

  const at = markedVowel(letters!)
  if (at < 0) return letters!

  const vowel = letters![at]!.toLowerCase()
  const marked = MARKS[vowel]?.[tone - 1]
  if (!marked) return letters!

  return letters!.slice(0, at) + marked + letters!.slice(at + 1)
}

/** Zamienia cały zapis CC-CEDICT: `chuan2 tong3` → `chuán tǒng`. */
export function toDiacritics(numbered: string): string {
  return numbered.split(/\s+/).filter(Boolean).map(syllableToDiacritics).join(' ')
}

/* ------------------------------------------------------------------------
   Etap 0 — inwentarz wymowy. Ten sam plik, bo to ta sama wiedza: jak zapis
   pinyinu przekłada się na dźwięk.
   ------------------------------------------------------------------------ */
/**
 * Etap 0 dla chińskiego — pinyin i tony. Sekcja 2a planu.
 *
 * Chiński nie ma alfabetu i to była pierwotna przyczyna, dla której adapter deklarował
 * brak etapu 0. Wniosek był jednak za szybki: **skończony inwentarz do opanowania
 * przed słowami istnieje, tylko nie jest nim pismo, lecz zapis wymowy**. Każda karta
 * w tej aplikacji pokazuje czytanie w pinyinie (`dì fāng`), a użytkownik od zera nie
 * ma jak go odczytać — `q`, `x`, `zh` i `c` znaczą po chińsku coś zupełnie innego niż
 * w polskim czy angielskim, a ton jest częścią słowa, nie ozdobą.
 *
 * Inwentarz: cztery tony plus neutralny, dwadzieścia jeden inicjałów i dwadzieścia
 * finałów — czterdzieści sześć pozycji, dokładnie tyle co jedna kana. Po nich pinyin
 * przestaje być szumem, a znaki można poznawać razem ze słowami, tak jak dotąd.
 *
 * Czego tu NIE ma: znaków. Znak chiński nie jest literą i nie da się go opanować
 * jako zbioru — jest ich kilka tysięcy i uczy się ich razem ze słownictwem.
 */

/** Pozycja inwentarza wraz z zaczepem pamięciowym. */
type Entry = { s: string; r: string; group: string; hint: string }

/**
 * Tony. Ta sama sylaba w pięciu tonach to pięć różnych słów i to jest pierwsza rzecz,
 * którą trzeba usłyszeć — wcześniej niż jakąkolwiek spółgłoskę.
 */
const TONES: Entry[] = [
  {
    s: 'mā',
    r: 'ton 1 — wysoki i równy',
    group: 'ton',
    hint: 'Kreska pozioma nad literą rysuje sam dźwięk: trzymasz jedną wysokość, jak przy przedłużonym „aaa" u lekarza. 妈 mā to „mama".',
  },
  {
    s: 'má',
    r: 'ton 2 — wznoszący',
    group: 'ton',
    hint: 'Kreska w górę: głos idzie w górę jak w polskim pytaniu „tak?". 麻 má to „konopie".',
  },
  {
    s: 'mǎ',
    r: 'ton 3 — opadająco-wznoszący',
    group: 'ton',
    hint: 'Daszek do dołu: głos siada nisko i dopiero potem wraca. 马 mǎ to „koń".',
  },
  {
    s: 'mà',
    r: 'ton 4 — krótki i opadający',
    group: 'ton',
    hint: 'Kreska w dół: ucięte, stanowcze, jak polskie „nie!". 骂 mà to „besztać".',
  },
  {
    s: 'ma',
    r: 'ton neutralny — lekki i krótki',
    group: 'ton',
    hint: 'Brak kreski to brak wysokości: sylabę mówi się mimochodem. 吗 ma na końcu zdania robi z niego pytanie.',
  },
]

/**
 * Inicjały — spółgłoski otwierające sylabę.
 *
 * Grupujemy je tak, jak się mylą, a nie alfabetycznie. Trzy zestawy są dla Polaka
 * pułapką: `j q x` (miękkie), `zh ch sh r` (twarde, język cofnięty) i `z c s` (syczące).
 * Do tego przez cały czas wraca jedna zasada: pary `b/p`, `d/t`, `g/k` NIE różnią się
 * dźwięcznością jak w polskim, tylko przydechem.
 */
const INITIALS: Entry[] = [
  { s: 'b', r: 'p bez przydechu', group: 'inicjał wargowy', hint: 'Polskie „p" ze słowa „spać" — bez podmuchu powietrza. Nie jest to polskie „b".' },
  { s: 'p', r: 'p z przydechem', group: 'inicjał wargowy', hint: 'To samo „p", ale z wyraźnym podmuchem — kartka przed ustami ma drgnąć.' },
  { s: 'm', r: 'm', group: 'inicjał wargowy', hint: 'Jedyny inicjał wargowy bez niespodzianek — czyta się jak polskie „m".' },
  { s: 'f', r: 'f', group: 'inicjał wargowy', hint: 'Czyta się jak polskie „f", zęby na dolnej wardze.' },

  { s: 'd', r: 't bez przydechu', group: 'inicjał zębowy', hint: 'Polskie „t" ze słowa „stać" — bez podmuchu. Nie jest to polskie „d".' },
  { s: 't', r: 't z przydechem', group: 'inicjał zębowy', hint: 'To samo „t", ale z podmuchem, jak w angielskim „top".' },
  { s: 'n', r: 'n', group: 'inicjał zębowy', hint: 'Czyta się jak polskie „n".' },
  { s: 'l', r: 'l', group: 'inicjał zębowy', hint: 'Czyta się jak polskie „l".' },

  { s: 'g', r: 'k bez przydechu', group: 'inicjał tylnojęzykowy', hint: 'Polskie „k" ze słowa „skała" — bez podmuchu. Nie jest to polskie „g".' },
  { s: 'k', r: 'k z przydechem', group: 'inicjał tylnojęzykowy', hint: 'To samo „k", ale z podmuchem.' },
  { s: 'h', r: 'ch', group: 'inicjał tylnojęzykowy', hint: 'Szorstkie „ch" jak w „chleb", drapiące w gardle.' },

  { s: 'j', r: 'dź', group: 'inicjał miękki', hint: 'Nie „dżej"! To miękkie „dź" jak w „dźwig" — język płasko przy przednich zębach.' },
  { s: 'q', r: 'ć', group: 'inicjał miękki', hint: 'Nie „ku"! To „ć" jak w „ćma". Najczęstsza pułapka pinyinu.' },
  { s: 'x', r: 'ś', group: 'inicjał miękki', hint: 'Nie „iks"! To „ś" jak w „śnieg".' },

  { s: 'zh', r: 'dż', group: 'inicjał twardy', hint: 'Twarde „dż" jak w „dżem", z językiem podwiniętym do tyłu.' },
  { s: 'ch', r: 'cz', group: 'inicjał twardy', hint: 'Twarde „cz" jak w „czapka", język podwinięty — para do zh, tyle że z przydechem.' },
  { s: 'sh', r: 'sz', group: 'inicjał twardy', hint: 'Twarde „sz" jak w „szafa", język podwinięty do tyłu.' },
  { s: 'r', r: 'ż', group: 'inicjał twardy', hint: 'Nie polskie „r"! To „ż" jak w „żaba", z językiem podwiniętym jak przy sh.' },

  { s: 'z', r: 'dz', group: 'inicjał syczący', hint: 'Zlepek „dz" jak w „dzwon" — jednym ruchem, nie „z".' },
  { s: 'c', r: 'c', group: 'inicjał syczący', hint: 'Nie „k"! To „c" jak w „cukier", z wyraźnym przydechem.' },
  { s: 's', r: 's', group: 'inicjał syczący', hint: 'Czyta się jak polskie „s", zęby blisko siebie.' },
]

/** Finały — samogłoskowa reszta sylaby. */
const FINALS: Entry[] = [
  { s: 'a', r: 'a', group: 'finał prosty', hint: 'Szerokie „a" jak w „las".' },
  { s: 'o', r: 'o', group: 'finał prosty', hint: 'Zaokrąglone „o" jak w „dom", z lekkim „ł" na starcie.' },
  { s: 'e', r: 'y gardłowe', group: 'finał prosty', hint: 'Nie „e"! Dźwięk między „y" a „e", wypowiadany z cofniętym językiem — jak polskie „yyy" przy zastanowieniu.' },
  { s: 'i', r: 'i', group: 'finał prosty', hint: 'Czyste „i" jak w „miś" — ale po z, c, s, zh, ch, sh, r brzmi jak przedłużona spółgłoska.' },
  { s: 'u', r: 'u', group: 'finał prosty', hint: 'Zaokrąglone „u" jak w „kura".' },
  { s: 'ü', r: 'i z zaokrąglonymi ustami', group: 'finał prosty', hint: 'Ustaw usta do „u", a powiedz „i" — jak niemieckie „ü". Po j, q, x pisze się bez kropek, ale czyta tak samo.' },

  { s: 'ai', r: 'aj', group: 'finał złożony', hint: 'Dwie litery, jeden ruch: „aj" jak w „daj".' },
  { s: 'ei', r: 'ej', group: 'finał złożony', hint: 'Jeden ruch: „ej" jak w „hej".' },
  { s: 'ao', r: 'au', group: 'finał złożony', hint: 'Nie „ao"! Czyta się „au" jak w „auto".' },
  { s: 'ou', r: 'ou', group: 'finał złożony', hint: 'Zaczynasz na „o", kończysz na „u", jednym ruchem.' },

  { s: 'an', r: 'an', group: 'finał nosowy', hint: 'Zwykłe „an", język dotyka wałka za zębami na końcu.' },
  { s: 'en', r: 'en', group: 'finał nosowy', hint: 'Krótkie „en", z tym samym gardłowym „e" co w finale e.' },
  { s: 'ang', r: 'ang nosowe', group: 'finał nosowy', hint: 'Końcówka „ng" zostaje w nosie — język NIE dotyka zębów, jak w angielskim „song".' },
  { s: 'eng', r: 'eng nosowe', group: 'finał nosowy', hint: 'To samo nosowe „ng", ale po gardłowym „e".' },
  { s: 'ong', r: 'ung nosowe', group: 'finał nosowy', hint: 'Pisane przez „o", czytane bliżej „ung" — usta zaokrąglone, końcówka w nosie.' },

  { s: 'er', r: 'er z podwiniętym językiem', group: 'finał specjalny', hint: 'Język podwija się do środka ust, jak w amerykańskim „her". Jedyny finał, który tworzy sylabę sam.' },
  { s: 'ia', r: 'ja', group: 'finał specjalny', hint: 'Litera „i" przed samogłoską pracuje jak polskie „j".' },
  { s: 'ie', r: 'je', group: 'finał specjalny', hint: 'Tu „e" jest zwykłe, nie gardłowe: całość brzmi jak „je" w „jest".' },
  { s: 'ua', r: 'ła', group: 'finał specjalny', hint: 'Litera „u" przed samogłoską pracuje jak polskie „ł".' },
  { s: 'uo', r: 'ło', group: 'finał specjalny', hint: 'To samo „u" jako „ł" — całość brzmi jak „ło" w „słowo".' },
]

const ALL: Entry[] = [...TONES, ...INITIALS, ...FINALS]

export function pinyinItems(): ScriptItem[] {
  return ALL.map(({ s, r, group }) => ({ s, r, group }))
}

const HINTS: Record<string, string> = Object.fromEntries(ALL.map((e) => [e.s, e.hint]))

export function pinyinMnemonic(item: ScriptItem): string | undefined {
  return HINTS[item.s]
}

/**
 * Wyjaśnienie pozycji. Mówi, czym jest ta cegiełka w sylabie i jak się ją czyta —
 * zaczep pamięciowy z `pinyinMnemonic` dokłada obraz, ale to zdanie niesie regułę.
 */
export function pinyinNote(item: ScriptItem): string {
  if (item.group === 'ton') {
    return (
      `Ton jest częścią słowa, nie ozdobą: ta sama sylaba w innym tonie znaczy co innego. ` +
      `Tutaj czytasz „${item.s}" jako ${item.r}.`
    )
  }
  if (item.group.startsWith('inicjał')) {
    return (
      `Inicjał otwiera sylabę. Pinyin „${item.s}" czyta się jako ${item.r} — ` +
      `zapis jest łaciński, ale wartości liter są chińskie i nie pokrywają się z polskimi.`
    )
  }
  return (
    `Finał to reszta sylaby po inicjale. Pinyin „${item.s}" czyta się jako ${item.r}; ` +
    `finał niesie ton, więc to nad nim stoi kreska.`
  )
}

/** Porcje wprowadzania: najpierw tony, potem inicjały zestawami mylonymi, na końcu finały. */
const BATCHES: ReadonlyArray<{ id: string; label: string; note: string; from: number; to: number }> = [
  {
    id: 'tony',
    label: 'cztery tony',
    note: 'Najpierw tony, bo bez nich nie ma słów: mā, má, mǎ i mà to cztery różne wyrazy zapisane tą samą sylabą. Kreska nad literą rysuje ruch głosu.',
    from: 0,
    to: 5,
  },
  {
    id: 'inicjaly-wargowe',
    label: 'inicjały b p m f',
    note: 'Pierwsza zasada pinyinu: pary b/p, d/t i g/k nie różnią się dźwięcznością jak w polskim, tylko PRZYDECHEM — podmuchem powietrza po spółgłosce.',
    from: 5,
    to: 9,
  },
  {
    id: 'inicjaly-zebowe',
    label: 'inicjały d t n l',
    note: 'Ta sama zasada co przy b i p: d to polskie „t" bez podmuchu, t to „t" z podmuchem. n i l czyta się zwyczajnie.',
    from: 9,
    to: 13,
  },
  {
    id: 'inicjaly-tylne',
    label: 'inicjały g k h',
    note: 'Trzecia para z przydechem plus „h", które jest szorstkie i drapie w gardle — bliżej polskiego „ch" niż angielskiego „h".',
    from: 13,
    to: 16,
  },
  {
    id: 'inicjaly-miekkie',
    label: 'inicjały j q x',
    note: 'Najgorsza pułapka pinyinu dla Europejczyka: te trzy litery znaczą coś zupełnie innego, niż wyglądają. Wszystkie trzy są miękkie i wymawiane przednią częścią języka.',
    from: 16,
    to: 19,
  },
  {
    id: 'inicjaly-twarde',
    label: 'inicjały zh ch sh r',
    note: 'Cztery dźwięki z językiem podwiniętym do tyłu. Są twardymi odpowiednikami j, q, x — różnica między nimi decyduje o znaczeniu słowa.',
    from: 19,
    to: 23,
  },
  {
    id: 'inicjaly-syczace',
    label: 'inicjały z c s',
    note: 'Trzy syczące, wymawiane czubkiem języka przy zębach. „c" nie ma nic wspólnego z „k" — to polskie „c" z przydechem.',
    from: 23,
    to: 26,
  },
  {
    id: 'finaly-proste',
    label: 'finały proste',
    note: 'Sześć samogłosek podstawowych. Dwie są nieoczywiste: „e" jest gardłowe, a „ü" wymaga ust ustawionych do „u" przy wymawianym „i".',
    from: 26,
    to: 32,
  },
  {
    id: 'finaly-zlozone',
    label: 'finały złożone',
    note: 'Dwie samogłoski wymawiane jednym ruchem, bez przerwy między nimi. Uwaga na „ao" — czyta się je „au", nie tak, jak wygląda.',
    from: 32,
    to: 36,
  },
  {
    id: 'finaly-nosowe',
    label: 'finały nosowe',
    note: 'Końcówka „n" kończy się językiem przy zębach, końcówka „ng" zostaje w nosie. Ta różnica rozróżnia słowa, więc nie da się jej pominąć.',
    from: 36,
    to: 41,
  },
  {
    id: 'finaly-specjalne',
    label: 'finały specjalne',
    note: 'Ostatnia porcja: „er" z podwiniętym językiem oraz finały, w których „i" pracuje jak polskie „j", a „u" jak „ł".',
    from: 41,
    to: 46,
  },
]

export function pinyinBatches(): ScriptBatch[] {
  const items = pinyinItems()
  return BATCHES.map((batch) => ({
    id: batch.id,
    label: batch.label,
    note: batch.note,
    items: items.slice(batch.from, batch.to),
  }))
}
