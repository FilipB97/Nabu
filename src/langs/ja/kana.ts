/**
 * Narzędzia kany — sekcja 9 planu (furigana) i 7.2 (karta `produce-kana`).
 *
 * Analizator morfologiczny podaje czytania katakaną, a furigana nad kanji pisze się
 * hiraganą. Zamiana jest arytmetyczna: bloki Unicode są ułożone równolegle, więc
 * wystarczy przesunięcie o 0x60.
 */

import type { ScriptBatch, ScriptItem } from '../types.ts'

const KATAKANA_START = 0x30a1
const KATAKANA_END = 0x30f6
const TO_HIRAGANA = 0x60

/** Zamienia katakanę na hiraganę, zostawiając wszystko inne bez zmian. */
export function toHiragana(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0)!
    out +=
      code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCodePoint(code - TO_HIRAGANA)
        : char
  }
  return out
}

/** Czy tekst zawiera choć jeden znak kanji. */
export function hasKanji(text: string): boolean {
  return /\p{Script=Han}/u.test(text)
}

/**
 * Czy czytanie warto pokazywać. Furigana ma sens tylko nad kanji — nad samą kaną
 * powtarzałaby to, co użytkownik już widzi, i zabierała miejsce w interlinii.
 */
export function needsFurigana(surface: string, reading: string): boolean {
  return hasKanji(surface) && toHiragana(reading) !== surface
}

/**
 * Inwentarz kany dla etapu 0 — sekcja 2a.
 *
 * Dwa razy po 46 znaków podstawowych, bez dakuten i handakuten: `が` to `か` ze znakiem
 * dźwięczności, więc jest regułą do zrozumienia, a nie osobnym znakiem do zapamiętania.
 * Wprowadzanie ich jako oddzielnych pozycji podwoiłoby etap 0 i uczyło tej samej rzeczy
 * drugi raz.
 *
 * Kolejność jest tradycyjna (gojūon), bo w tej kolejności kana jest uporządkowana
 * we wszystkich materiałach — łamanie jej utrudniłoby korzystanie z czegokolwiek poza
 * tą aplikacją.
 */
const GOJUON: ReadonlyArray<[hiragana: string, katakana: string, romaji: string]> = [
  ['あ', 'ア', 'a'], ['い', 'イ', 'i'], ['う', 'ウ', 'u'], ['え', 'エ', 'e'], ['お', 'オ', 'o'],
  ['か', 'カ', 'ka'], ['き', 'キ', 'ki'], ['く', 'ク', 'ku'], ['け', 'ケ', 'ke'], ['こ', 'コ', 'ko'],
  ['さ', 'サ', 'sa'], ['し', 'シ', 'shi'], ['す', 'ス', 'su'], ['せ', 'セ', 'se'], ['そ', 'ソ', 'so'],
  ['た', 'タ', 'ta'], ['ち', 'チ', 'chi'], ['つ', 'ツ', 'tsu'], ['て', 'テ', 'te'], ['と', 'ト', 'to'],
  ['な', 'ナ', 'na'], ['に', 'ニ', 'ni'], ['ぬ', 'ヌ', 'nu'], ['ね', 'ネ', 'ne'], ['の', 'ノ', 'no'],
  ['は', 'ハ', 'ha'], ['ひ', 'ヒ', 'hi'], ['ふ', 'フ', 'fu'], ['へ', 'ヘ', 'he'], ['ほ', 'ホ', 'ho'],
  ['ま', 'マ', 'ma'], ['み', 'ミ', 'mi'], ['む', 'ム', 'mu'], ['め', 'メ', 'me'], ['も', 'モ', 'mo'],
  ['や', 'ヤ', 'ya'], ['ゆ', 'ユ', 'yu'], ['よ', 'ヨ', 'yo'],
  ['ら', 'ラ', 'ra'], ['り', 'リ', 'ri'], ['る', 'ル', 'ru'], ['れ', 'レ', 're'], ['ろ', 'ロ', 'ro'],
  ['わ', 'ワ', 'wa'], ['を', 'ヲ', 'wo'],
  ['ん', 'ン', 'n'],
]

/** Samogłoska kończąca czytanie — po niej grupujemy dystraktory. */
function vowelOf(romaji: string): string {
  return /[aeiou]$/.test(romaji) ? romaji.slice(-1) : romaji
}

export function kanaItems(): ScriptItem[] {
  const items: ScriptItem[] = []
  // Najpierw cała hiragana, potem katakana: to są dwa systemy do opanowania, a nie
  // jeden z dwoma wariantami. Przeplatanie ich dawałoby karty あ / ア obok siebie,
  // czyli dokładnie tę parę, której nie da się rozróżnić po czytaniu.
  for (const [hira, , romaji] of GOJUON) {
    items.push({ s: hira, r: romaji, group: `hiragana-${vowelOf(romaji)}` })
  }
  for (const [, kata, romaji] of GOJUON) {
    items.push({ s: kata, r: romaji, group: `katakana-${vowelOf(romaji)}` })
  }
  return items
}

/**
 * Wyjaśnienie pojedynczego znaku przy pierwszym spotkaniu — sekcja 2a.
 *
 * Kana jest systemem, nie zbiorem obrazków: wiersz `k` to te same pięć samogłosek
 * z jedną spółgłoską z przodu, a każdy znak niesie całą sylabę. Powiedzenie tego przy
 * pierwszym `か` jest warte więcej niż dziesięć powtórek, w których użytkownik zgaduje
 * między `ka`, `ki` i `ku` — bo po tym zdaniu wie, czego szukać w kształcie.
 */
export function kanaNote(item: ScriptItem): string {
  const katakana = item.group.startsWith('katakana')
  const system = katakana
    ? 'Katakana: te same sylaby co w hiraganie, inny zapis. Pisze się nią słowa obce, nazwy i dźwięki.'
    : 'Hiragana: podstawowe pismo sylabiczne. Jeden znak to cała sylaba, zawsze czytana tak samo.'

  if (item.r === 'n') {
    return (
      `${system} To jedyny znak bez samogłoski — samo „n" na końcu sylaby.` +
      (SOUNDS[item.r] ? ` ${SOUNDS[item.r]}` : '')
    )
  }
  if (item.r.length === 1) {
    return `${system} Czysta samogłoska „${item.r}" — od niej zaczyna się cały jej rząd.`
  }

  const vowel = item.r.slice(-1)
  const consonant = item.r.slice(0, -1)
  const sound = SOUNDS[item.r]
  return (
    `${system} Sylaba „${item.r}" to ${consonant} + ${vowel}; ` +
    `wszystkie znaki tego rzędu kończą się na „${vowel}".` +
    (sound ? ` ${sound}` : '')
  )
}

/**
 * Zaczepy pamięciowe — po jednym na znak.
 *
 * Metoda słowa-klucza: kształt bez skojarzenia jest kreską, ze skojarzeniem staje się
 * obrazkiem, który da się przywołać. Wszystkie opisy są po polsku i celowo krótkie —
 * mnemonik dłuższy od znaku przestaje być skrótem.
 *
 * Katakana dostaje opisy podkreślające kanty i pokrewieństwo z hiraganą, bo tam leżą
 * jej realne pułapki: `シ` / `ツ` i `ン` / `ソ` różnią się kierunkiem kresek, a nie
 * kształtem, i to jest jedyna rzecz, którą trzeba przy nich zapamiętać.
 */
const HINTS: Record<string, string> = {
  あ: 'Litera A pochylona w prawo, z zawiniętym ogonkiem.',
  い: 'Dwie kreski obok siebie — dwie igły.',
  う: 'Usta wydęte do „u", z kreską nad nimi.',
  え: 'Ptak z długim dziobem — emu.',
  お: 'Jak あ, ale z haczykiem u góry i kropką z boku.',
  か: 'Kamień przecięty kreską.',
  き: 'Klucz z dwoma ząbkami.',
  く: 'Dziób kukułki otwarty w prawo.',
  け: 'Kij, a obok niego wieszak.',
  こ: 'Dwie kreski jak dwie kopy siana.',
  さ: 'Sierp z kreską u góry.',
  し: 'Haczyk wędki zarzucony w dół.',
  す: 'Supeł zawiązany na sznurku.',
  せ: 'Widelec o dwóch zębach, przecięty poprzeczką.',
  そ: 'Zygzak jak schody.',
  た: 'Krzyżyk i dwie kreski — litera t z ogonkiem.',
  ち: 'Odwrócone さ — to samo, tylko lustrzane.',
  つ: 'Fala — tsunami zaczyna się właśnie od tego znaku.',
  て: 'Zgięta ręka wyciągnięta do przodu.',
  と: 'Gwóźdź z kroplą u góry.',
  な: 'Nóż wbity w deskę, obok zawijas.',
  に: 'Pionowa kreska i dwie poziome — nitka z węzłami.',
  ぬ: 'Makaron zawinięty w pętelkę — nudle.',
  ね: 'Kot z zakręconym ogonem; kot to po japońsku „neko".',
  の: 'Kółko przekreślone ukośnie — znak zakazu.',
  は: 'Litera H, której prawa noga urosła w brzuszek.',
  ひ: 'Szeroki uśmiech — „hi, hi".',
  ふ: 'Góra Fuji ze śniegiem po bokach.',
  へ: 'Wzgórze widziane z daleka.',
  ほ: 'Jak は, ale z dodatkową belką — hotel z anteną.',
  ま: 'Dwie kreski i kokarda — mama z warkoczem.',
  み: 'Cyfra 3 z doklejonym ogonkiem.',
  む: 'Krowa z ogonem — mówi „mu".',
  め: 'Oko z rzęsą; oko to po japońsku „me".',
  も: 'Haczyk przecięty dwiema kreskami.',
  や: 'Proca z rozwidleniem.',
  ゆ: 'Ryba złapana na haczyk.',
  よ: 'Jojo na sznurku.',
  ら: 'Rakieta z ogonem ognia.',
  り: 'Dwie kreski jak rynna.',
  る: 'Kreska zakończona pętelką.',
  れ: 'Jak る, ale zamiast pętelki noga wyrzucona w bok.',
  ろ: 'Jak る, tylko bez pętelki na końcu.',
  わ: 'Jak れ, ale z pętelką — waza z uchem.',
  を: 'Kreska, hak i podpórka pod spodem.',
  ん: 'Jedna kreska jak pisane odręcznie n.',

  ア: 'Kątownik z ukośną nogą — górna połowa あ.',
  イ: 'Dwie kreski, krótka oparta o długą.',
  ウ: 'Daszek z kreską pod spodem.',
  エ: 'Litera I położona na dwóch belkach.',
  オ: 'Krzyżyk z ogonkiem — kanciaste お.',
  カ: 'Kanciaste か, tylko bez kreski z boku.',
  キ: 'Kanciasty klucz: dwa ząbki i trzonek.',
  ク: 'Kanciasty dziób kukułki.',
  ケ: 'Kij pod daszkiem.',
  コ: 'Klamra złożona z dwóch kresek.',
  サ: 'Widły o dwóch zębach.',
  シ: 'Dwie kropki po lewej i kreska Z DOŁU w górę.',
  ス: 'Kanciasty supeł.',
  セ: 'Kanciaste せ — ten sam widelec, tylko o prostych kreskach.',
  ソ: 'Jedna kropka i kreska spadająca Z GÓRY — krótsze niż ン.',
  タ: 'Jak ク, ale z dodatkową kreską w środku.',
  チ: 'Jak キ, tylko górna kreska jest ukośna.',
  ツ: 'Trzy krople spadające Z GÓRY — pionowo, nie z boku.',
  テ: 'Trzy kreski jak antena na dachu.',
  ト: 'Pionowa kreska z kropką — topór.',
  ナ: 'Nóż z rękojeścią.',
  ニ: 'Dwie kreski; „ni" to po japońsku dwa.',
  ヌ: 'Jak ス, ale przekreślone.',
  ネ: 'Krzyż z doklejonym ogonkiem.',
  ノ: 'Jedna ukośna kreska i nic więcej.',
  ハ: 'Dwie rozstawione nogi.',
  ヒ: 'Pionowa kreska z hakiem u dołu.',
  フ: 'Połowa dachu — lewa strona ふ.',
  ヘ: 'To samo wzgórze co w hiraganie: へ i ヘ wyglądają identycznie.',
  ホ: 'Krzyż z czterema kreskami — choinka.',
  マ: 'Daszek z kreską w środku.',
  ミ: 'Trzy kreski; „mi" to po japońsku trzy.',
  ム: 'Kanciasta pętla otwarta w dół.',
  メ: 'Przekreślone oko — po prostu X.',
  モ: 'Kanciaste も — haczyk wyprostowany w pionową kreskę.',
  ヤ: 'Kanciasta proca.',
  ユ: 'Litera U położona na boku.',
  ヨ: 'Trzy kreski jak grzebień.',
  ラ: 'Daszek, a pod nim haczyk.',
  リ: 'Dwie kreski, prawa dłuższa i zagięta.',
  ル: 'Dwie nogi, prawa z zawijasem.',
  レ: 'Jedna kreska z hakiem w prawo.',
  ロ: 'Kwadrat — otwarte usta.',
  ワ: 'Jak フ, ale z dodatkową kreską po lewej.',
  ヲ: 'Jak ワ z kreską w środku.',
  ン: 'Kropka i kreska Z DOŁU w górę — jak シ, tylko krótsze.',
}

export function kanaMnemonic(item: ScriptItem): string | undefined {
  return HINTS[item.s]
}

/**
 * Czytania, które w zapisie łacińskim mylą Polaka.
 *
 * Romanizacja Hepburna jest napisana pod angielski: `shi` to „szi", `chi` to „czi",
 * a `tsu` to „cu". Zostawienie tego bez komentarza uczy błędnej wymowy od pierwszego
 * dnia — a błędna wymowa utrwalona przez miesiąc kosztuje potem znacznie więcej niż
 * jedno zdanie tutaj.
 */
const SOUNDS: Record<string, string> = {
  shi: 'Czytaj „szi".',
  chi: 'Czytaj „czi".',
  tsu: 'Czytaj „cu".',
  fu: 'Coś między „f" a „h" — dmuchnięcie przez zaokrąglone usta.',
  ra: 'Japońskie r jest jednym uderzeniem języka, słychać je między r a l.',
  ri: 'Japońskie r jest jednym uderzeniem języka, słychać je między r a l.',
  ru: 'Japońskie r jest jednym uderzeniem języka, słychać je między r a l.',
  re: 'Japońskie r jest jednym uderzeniem języka, słychać je między r a l.',
  ro: 'Japońskie r jest jednym uderzeniem języka, słychać je między r a l.',
  wo: 'Zapisywane „wo", czytane po prostu „o" — służy wyłącznie jako partykuła.',
  n: 'Nosowe n; jako jedyne stoi w sylabie samo.',
}

/**
 * Rzędy tabeli gojūon — porcje, w których wprowadzamy kanę.
 *
 * Rząd to jedna spółgłoska i te same pięć samogłosek. Pokazany w całości uczy zasady;
 * rozdzielony na pięć sesji uczy pięciu niepowiązanych obrazków.
 */
const ROWS: ReadonlyArray<{ id: string; label: string; note: string; from: number; to: number }> = [
  {
    id: 'a',
    label: 'rząd A',
    note: 'Pięć samogłosek, na których stoi cały japoński: a, i, u, e, o. Każdy kolejny rząd to te same pięć z jedną spółgłoską z przodu.',
    from: 0,
    to: 5,
  },
  { id: 'ka', label: 'rząd K', note: 'Te same samogłoski z „k" z przodu: ka, ki, ku, ke, ko.', from: 5, to: 10 },
  { id: 'sa', label: 'rząd S', note: 'sa, shi, su, se, so. Uwaga na drugi znak: nie „si", tylko „szi".', from: 10, to: 15 },
  { id: 'ta', label: 'rząd T', note: 'ta, chi, tsu, te, to. Dwa środkowe wyłamują się z wzoru: „czi" i „cu".', from: 15, to: 20 },
  {
    id: 'na',
    label: 'rząd N',
    note: 'na, ni, nu, ne, no — cały rząd trzyma się wzoru, żadnej pułapki w wymowie.',
    from: 20,
    to: 25,
  },
  { id: 'ha', label: 'rząd H', note: 'ha, hi, fu, he, ho. Środkowy jest bliżej „f" niż „h".', from: 25, to: 30 },
  {
    id: 'ma',
    label: 'rząd M',
    note: 'ma, mi, mu, me, mo — znowu bez wyjątków; „me" znaczy oko, a „mimi" ucho.',
    from: 30,
    to: 35,
  },
  { id: 'ya', label: 'rząd Y', note: 'Tylko trzy znaki: ya, yu, yo. Sylab „yi" i „ye" japoński nie ma.', from: 35, to: 38 },
  { id: 'ra', label: 'rząd R', note: 'ra, ri, ru, re, ro. To r jest jednym uderzeniem języka — brzmi między r a l.', from: 38, to: 43 },
  { id: 'wa', label: 'rząd W', note: 'Zostały dwa: wa i wo. Drugi czyta się „o" i służy wyłącznie jako partykuła.', from: 43, to: 45 },
  { id: 'n', label: 'znak N', note: 'Jedyna sylaba bez samogłoski. Nigdy nie zaczyna słowa.', from: 45, to: 46 },
]

export function kanaBatches(): ScriptBatch[] {
  const items = kanaItems()
  const batches: ScriptBatch[] = []

  // Kolejność musi być identyczna z `kanaItems()`: najpierw cała hiragana, potem cała
  // katakana. Identyfikatory pozycji w talii są indeksami tej listy, więc przestawienie
  // porcji przestawiłoby znaczenie kart, które użytkownik ma już w bazie.
  const systems = [
    { id: 'hiragana', label: 'hiragana', offset: 0 },
    { id: 'katakana', label: 'katakana', offset: 46 },
  ]

  for (const system of systems) {
    for (const row of ROWS) {
      batches.push({
        id: `${system.id}-${row.id}`,
        label: `${system.label} · ${row.label}`,
        note: row.note,
        items: items.slice(system.offset + row.from, system.offset + row.to),
      })
    }
  }

  return batches
}
