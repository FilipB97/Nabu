import type { ScriptBatch, ScriptItem } from '../types.ts'

/**
 * Alfabet arabski — etap 0, sekcja 2a.
 *
 * Dwadzieścia osiem liter i cztery rzeczy, które trzeba powiedzieć od razu, bo bez nich
 * pismo wygląda na nieczytelne, a jest w pełni regularne:
 *
 * 1. **Pisze się od prawej do lewej.** Cyfry i wtrącenia łacińskie zostają od lewej,
 *    więc jeden wiersz bywa dwukierunkowy — to normalne, nie usterka renderowania.
 * 2. **Litery się łączą** i zmieniają kształt zależnie od pozycji w wyrazie. Rdzeń
 *    zostaje ten sam; zmienia się to, czy litera ma ogonek i z której strony.
 *    Sześć liter — `ا د ذ ر ز و` — nigdy nie łączy się z następną, więc po nich
 *    w środku wyrazu robi się przerwa. To najczęstsze źródło wrażenia, że wyraz
 *    „rozpadł się" na kawałki.
 * 3. **Litery różnią się przede wszystkim KROPKAMI.** `ب ت ث ن ي` mają wspólny szkielet
 *    i różnią się liczbą oraz położeniem kropek. Dlatego uczymy ich rodzinami, a nie
 *    w porządku alfabetycznym: kto zobaczył `ب` i `ت` obok siebie, ma z czym porównywać.
 * 4. **Krótkich samogłosek się nie zapisuje.** `كتب` to trzy spółgłoski i czyta się
 *    „kataba" — samogłoski trzeba znać ze słowa. Dlatego arabski jest językiem, w którym
 *    słownictwo i pismo trzeba budować równolegle, a nie po kolei.
 *
 * Transkrypcja: litery bez odpowiednika w polskim dostają zapis z kropką pod spodem
 * (`ṣ`, `ḍ`, `ṭ`, `ẓ`, `ḥ`) — to jest zapis, który użytkownik znajdzie w każdym słowniku
 * i podręczniku, więc uczenie własnego byłoby wygodą na tydzień i przeszkodą na lata.
 */

type Letter = {
  /** Litera w formie izolowanej. */
  s: string
  /** Transkrypcja — to jest odpowiedź na karcie. */
  r: string
  /** Nazwa litery po arabsku, w transkrypcji. */
  name: string
  /** Rodzina kształtu — z niej biorą się dystraktory. */
  group: string
  /** Czy łączy się z literą następną (czyli w lewo). */
  joins: boolean
  /** Jak brzmi — zdanie dla kogoś, kto nie zna arabskiego. */
  sound: string
  /** Zaczep pamięciowy: co ten kształt przypomina. */
  hint: string
}

const LETTERS: readonly Letter[] = [
  {
    s: 'ا', r: 'a', name: 'alif', group: 'alif', joins: false,
    sound: 'Długie „a"; bywa też samą podpórką dla innych dźwięków.',
    hint: 'Pionowa kreska bez żadnych ozdób — najprostsza litera alfabetu.',
  },
  {
    s: 'ب', r: 'b', name: 'bā’', group: 'ząbek', joins: true,
    sound: 'Polskie „b".',
    hint: 'Miska z jedną kropką POD spodem.',
  },
  {
    s: 'ت', r: 't', name: 'tā’', group: 'ząbek', joins: true,
    sound: 'Polskie „t".',
    hint: 'Ta sama miska, ale z dwiema kropkami NAD nią.',
  },
  {
    s: 'ث', r: 'th', name: 'ṯā’', group: 'ząbek', joins: true,
    sound: 'Bezdźwięczne „th" jak w angielskim think — język między zębami.',
    hint: 'Ta sama miska z trzema kropkami nad nią.',
  },
  {
    s: 'ج', r: 'dż', name: 'ǧīm', group: 'brzuszek', joins: true,
    sound: 'Polskie „dż"; w Egipcie czytane jak „g".',
    hint: 'Brzuszek z kropką w środku.',
  },
  {
    s: 'ح', r: 'ḥ', name: 'ḥā’', group: 'brzuszek', joins: true,
    sound: 'Mocne „h" z głębi gardła, jakbyś chuchał na szybę.',
    hint: 'Ten sam brzuszek, tylko pusty.',
  },
  {
    s: 'خ', r: 'ch', name: 'ḫā’', group: 'brzuszek', joins: true,
    sound: 'Polskie „ch" jak w „chleb".',
    hint: 'Ten sam brzuszek z kropką nad nim.',
  },
  {
    s: 'د', r: 'd', name: 'dāl', group: 'dal', joins: false,
    sound: 'Polskie „d".',
    hint: 'Półkole otwarte w lewo — jak ucho.',
  },
  {
    s: 'ذ', r: 'dh', name: 'ḏāl', group: 'dal', joins: false,
    sound: 'Dźwięczne „th" jak w angielskim this.',
    hint: 'To samo ucho z kropką nad nim.',
  },
  {
    s: 'ر', r: 'r', name: 'rā’', group: 'ra', joins: false,
    sound: 'Polskie „r", wibrujące.',
    hint: 'Haczyk opadający pod linię pisma.',
  },
  {
    s: 'ز', r: 'z', name: 'zāy', group: 'ra', joins: false,
    sound: 'Polskie „z".',
    hint: 'Ten sam haczyk z kropką nad nim.',
  },
  {
    s: 'س', r: 's', name: 'sīn', group: 'sin', joins: true,
    sound: 'Polskie „s".',
    hint: 'Trzy ząbki zakończone wanną — jak fala.',
  },
  {
    s: 'ش', r: 'sz', name: 'šīn', group: 'sin', joins: true,
    sound: 'Polskie „sz".',
    hint: 'Ta sama fala z trzema kropkami nad ząbkami.',
  },
  {
    s: 'ص', r: 'ṣ', name: 'ṣād', group: 'sad', joins: true,
    sound: 'Emfatyczne „s" — to samo „s", ale z językiem cofniętym i całą jamą ustną szerzej.',
    hint: 'Pętla z wanną — jak oko z ogonem.',
  },
  {
    s: 'ض', r: 'ḍ', name: 'ḍād', group: 'sad', joins: true,
    sound: 'Emfatyczne „d". Arabowie nazywają swój język „językiem ḍād" — nikt inny go nie ma.',
    hint: 'Ta sama pętla z kropką nad nią.',
  },
  {
    s: 'ط', r: 'ṭ', name: 'ṭā’', group: 'ta', joins: true,
    sound: 'Emfatyczne „t" — mocniejsze i „ciemniejsze" niż ت.',
    hint: 'Pętla z pionową kreską — jak żaglówka.',
  },
  {
    s: 'ظ', r: 'ẓ', name: 'ẓā’', group: 'ta', joins: true,
    sound: 'Emfatyczne „z" albo „dh" — zależnie od kraju.',
    hint: 'Ta sama żaglówka z kropką nad nią.',
  },
  {
    s: 'ع', r: 'ʿ', name: 'ʿayn', group: 'ajn', joins: true,
    sound: 'Dźwięk ściśniętego gardła — nie ma go w żadnym języku europejskim. Ćwiczy się osobno.',
    hint: 'Otwarte oko zwrócone w prawo.',
  },
  {
    s: 'غ', r: 'gh', name: 'ġayn', group: 'ajn', joins: true,
    sound: 'Jak francuskie „r" — dźwięczne charczenie z tyłu podniebienia.',
    hint: 'To samo oko z kropką nad nim.',
  },
  {
    s: 'ف', r: 'f', name: 'fā’', group: 'fa', joins: true,
    sound: 'Polskie „f".',
    hint: 'Kółko z ogonkiem i jedną kropką nad nim.',
  },
  {
    s: 'ق', r: 'q', name: 'qāf', group: 'fa', joins: true,
    sound: 'Głębokie „k" z samego tyłu gardła, jakbyś połykał literę.',
    hint: 'Kółko z wanną i dwiema kropkami nad nim.',
  },
  {
    s: 'ك', r: 'k', name: 'kāf', group: 'kaf', joins: true,
    sound: 'Polskie „k".',
    hint: 'Zawinięty daszek — jak zgięte kolano.',
  },
  {
    s: 'ل', r: 'l', name: 'lām', group: 'kaf', joins: true,
    sound: 'Polskie „l".',
    hint: 'Wysoka laska zakręcona w dół.',
  },
  {
    s: 'م', r: 'm', name: 'mīm', group: 'mim', joins: true,
    sound: 'Polskie „m".',
    hint: 'Kółko z ogonkiem opadającym w dół — jak nutka.',
  },
  {
    s: 'ن', r: 'n', name: 'nūn', group: 'ząbek', joins: true,
    sound: 'Polskie „n".',
    hint: 'Miska z jedną kropką NAD nią — odwrotnie niż ب.',
  },
  {
    s: 'ه', r: 'h', name: 'hā’', group: 'mim', joins: true,
    sound: 'Zwykłe „h", lżejsze niż ح.',
    hint: 'Oczko; ze wszystkich liter zmienia kształt najbardziej.',
  },
  {
    s: 'و', r: 'w', name: 'wāw', group: 'waw', joins: false,
    sound: 'Angielskie „w" albo długie „u".',
    hint: 'Kółko z ogonkiem w lewo — jak cyfra sześć.',
  },
  {
    s: 'ي', r: 'j', name: 'yā’', group: 'ząbek', joins: true,
    sound: 'Polskie „j" albo długie „i".',
    hint: 'Miska z dwiema kropkami POD spodem.',
  },
]

export function arabicLetters(): ScriptItem[] {
  return LETTERS.map(({ s, r, group }) => ({ s, r, group }))
}

const BY_CHAR = new Map(LETTERS.map((letter) => [letter.s, letter]))

/** Litery, które nie łączą się z następną — to one robią przerwy w środku wyrazu. */
const NO_JOIN = LETTERS.filter((letter) => !letter.joins)
  .map((letter) => letter.s)
  .join(' ')

export function arabicNote(item: ScriptItem): string {
  const letter = BY_CHAR.get(item.s)
  if (!letter) return ''

  const join = letter.joins
    ? 'Łączy się w obie strony, więc w środku wyrazu traci ogonek.'
    : `Nie łączy się z następną literą — po niej zostaje przerwa. ` +
      `Takich liter jest sześć: ${NO_JOIN}.`

  // Transkrypcja stoi w zdaniu, a nie tylko na opcji quizu: użytkownik ma zobaczyć,
  // JAK TO ZAPISUJEMY, zanim zacznie wybierać spośród czterech podobnych zapisów.
  return `${letter.name}, zapisywana „${item.r}" — ${letter.sound} ${join}`
}

export function arabicMnemonic(item: ScriptItem): string | undefined {
  return BY_CHAR.get(item.s)?.hint
}

/**
 * Porcje wprowadzania — rodzinami kształtu, nie alfabetycznie.
 *
 * Litery arabskie różnią się głównie kropkami, więc `ب` pokazane obok `ت` i `ث` uczy
 * zasady („ta sama miska, inne kropki"), a rozrzucone po trzech sesjach uczy trzech
 * niezależnych obrazków, które potem zlewają się w jeden.
 *
 * Kolejność porcji jest identyczna z `arabicLetters()`, bo identyfikatory pozycji w talii
 * są indeksami tamtej listy.
 */
const BATCHES: ReadonlyArray<{ id: string; label: string; note: string; from: number; to: number }> =
  [
    {
      id: 'alif-zabek',
      label: 'alif i rodzina ząbka',
      note: 'Alif to podpórka, a trzy kolejne litery mają wspólną miskę i różnią się wyłącznie kropkami: jedna pod spodem, dwie nad, trzy nad.',
      from: 0,
      to: 4,
    },
    {
      id: 'brzuszek',
      label: 'rodzina brzuszka',
      note: 'Jeden kształt, trzy dźwięki. Kropka w środku, brak kropki, kropka nad — i tyle je różni.',
      from: 4,
      to: 7,
    },
    {
      id: 'bez-polaczenia',
      label: 'litery bez połączenia',
      note: 'Cztery z sześciu liter, które nie łączą się z następną. Po nich w środku wyrazu widać przerwę — to nie jest koniec wyrazu.',
      from: 7,
      to: 11,
    },
    {
      id: 'sin-sad',
      label: 'fale i pętle',
      note: 'Ząbkowana fala i pętla z wanną. Kropki nad falą dają „sz", kropka nad pętlą — emfatyczne „ḍ".',
      from: 11,
      to: 15,
    },
    {
      id: 'emfatyczne',
      label: 'emfatyczne i gardłowe',
      note: 'Najtrudniejsza porcja: dwie emfatyczne i dwa dźwięki z gardła, których polski nie ma. Kropka pod literą w transkrypcji zawsze znaczy emfazę.',
      from: 15,
      to: 19,
    },
    {
      id: 'kolka',
      label: 'kółka i laski',
      note: 'Cztery litery zbudowane z kółka albo laski. `ف` i `ق` różnią się kropkami i głębokością dźwięku.',
      from: 19,
      to: 23,
    },
    {
      id: 'domkniecie',
      label: 'ostatnia piątka',
      note: 'Domknięcie alfabetu. `ن` ma kropkę NAD miską, `ي` dwie POD — to jedyna różnica między nimi a `ب` i `ت`.',
      from: 23,
      to: 28,
    },
  ]

export function arabicBatches(): ScriptBatch[] {
  const items = arabicLetters()
  return BATCHES.map((batch) => ({
    id: batch.id,
    label: batch.label,
    note: batch.note,
    items: items.slice(batch.from, batch.to),
  }))
}
