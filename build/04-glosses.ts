/**
 * Krok 04 — glosy polskie i lematyzacja. Sekcja 10.3 planu.
 *
 * ZMIANA WZGLĘDEM PIERWOTNEGO PLANU. Plan zakładał tu model językowy tłumaczący
 * glosy z angielskiego na polski, wsadowo, z walidacją liczby linii i ponowieniami.
 * Okazało się to niepotrzebne: **polski Wikisłownik zawiera hasła obcojęzyczne
 * z polskimi definicjami** — `hund` → `pies`, `agua` → `woda` — i pokrywa wszystkie
 * pięć języków v1 oraz chiński i arabski na później.
 *
 * Co przez to odpada: klucz API, koszt wywołań, walidacja odpowiedzi, ponowienia,
 * ryzyko jakości tłumaczeń z sekcji 14, a przede wszystkim niemożność powtórzenia
 * builda przez kogokolwiek bez własnego klucza. Zostaje tekst pisany przez ludzi.
 *
 * Czego to NIE zastępuje: rdzeń słownictwa (etap 1, ~80 pozycji na język) nadal
 * tłumaczymy ręcznie i commitujemy. Te słowa użytkownik zobaczy setki razy
 * i definicja słownikowa bywa dla nich za szeroka.
 *
 * Licencja: Wikisłownik to CC BY-SA. Dane pochodne dziedziczą SA — tak samo jak
 * te wywodzone z list częstości. Wpis w `data/ATTRIBUTION.md`.
 */

import { writeFile, readFile, stat } from 'node:fs/promises'
import { cachePath, download, readLines } from './lib/io.ts'

const WIKTIONARY = 'https://kaikki.org/plwiktionary/raw-wiktextract-data.jsonl'

export type Entry = {
  /** Glosa domyślna — pierwsze sensowne znaczenie. */
  pl: string
  /**
   * Pozostałe znaczenia. Krok 05 wybiera spośród nich to, które pasuje do polskiego
   * tłumaczenia konkretnego zdania — bez tego `slav` w „Jag är en slav" dostaje glosę
   * „Słowianin" zamiast „niewolnik", a `árabe` przy „língua" wychodzi jako „Arab".
   */
  senses: string[]
  /**
   * Czytania odpowiadające znaczeniom z `senses`, tam gdzie hasło je podaje —
   * `null` na pozycjach bez czytania. Wikisłownik zapisuje je po lewej stronie strzałki
   * (`げつ → miesiąc`), a to jest jedyne miejsce, w którym CZYTANIE I ZNACZENIE pochodzą
   * z jednego źródła. Analizator morfologiczny podaje czytanie z własnego słownika
   * i przy kanji o wielu czytaniach rozjeżdża się z glosą: karta `金 きん „pieniądze"`
   * łączy czytanie „złota" ze znaczeniem „pieniędzy" i uczy pary, która nie istnieje.
   */
  readings: (string | null)[]
  /**
   * Wymowa całego hasła, gdy nie da się jej przypisać do konkretnego znaczenia:
   * transliteracja (`kitāb`), a gdy jej nie ma — zapis IPA (`'jawm`).
   *
   * Dla arabskiego to jedyne źródło wymowy, jakie mamy: zapis nie niesie samogłosek
   * krótkich, więc `كتاب` bez transliteracji jest dla uczącego się ciągiem trzech
   * spółgłosek, którego nie ma jak przeczytać. Plan nazywa wymowę warunkiem sensowności
   * poziomu D i to jest właśnie ten warunek.
   */
  say?: string
  /** Część mowy wg Wikisłownika; potrzebna do doboru dystraktorów (sekcja 10.1b). */
  pos: string
}

/** Ile znaczeń zapamiętujemy. Dalsze są zwykle bardzo rzadkie albo terminologiczne. */
const MAX_SENSES = 6

export type Lexicon = {
  /** Postać hasłowa → glosa i część mowy. */
  entries: Map<string, Entry>
  /** Forma odmieniona → postać hasłowa. Pokrycie częściowe, fallback to sama forma. */
  lemmas: Map<string, string>
}

/**
 * Definicje, które nie są znaczeniem, tylko odsyłaczem do innej formy: „lm od: pie",
 * „forma żeńska od…", „zob. …". Jako glosa w quizie byłyby bezużyteczne, a jako
 * dystraktor wręcz mylące — użytkownik zobaczyłby dwie opcje o tym samym znaczeniu.
 */
const REDIRECT = /^(lm|lp|lmn|zob\.|zdrobn|imiesł|w złożeniach)/i

/**
 * Wikisłownik zapisuje odsyłacze do formy jako „ż lp od: pleno" — kwalifikator gramatyczny
 * z przodu, więc dopasowanie do początku ciągu tego nie łapie. „od:" w środku glosy
 * praktycznie zawsze oznacza odsyłacz.
 *
 * To ono, a nie lista prefiksów, wyłapuje odsyłacze zaczynające się od zwykłych słów:
 * „czas przeszły od: robić". Trzymanie `czas ` na liście prefiksów kosztowało nas glosę
 * `时间 = czas` — chińskie słowo „czas" zostało odrzucone jako forma gramatyczna
 * i karta dostała drugie znaczenie, „godzina".
 */
const FORM_OF = /\bod:\s/i

/**
 * Doprecyzowanie w nawiasie na końcu: „ryż (łuskane ziarno, do gotowania)".
 * Zwykle jest cenne, ale przy limicie czterech słów potrafi wyrzucić całą glosę —
 * a wtedy zostaje znaczenie dalsze i mniej trafne („米 = metr" zamiast „ryż").
 */
const CLARIFIER = /\s*\([^)]*\)\s*$/

/** Znaczniki gramatyczne w nawiasach i kwalifikatory na początku glosy. */
const QUALIFIER = /^\([^)]*\)\s*/

/**
 * Hasła japońskie Wikisłownik zapisuje jako „czytanie → znaczenie" (`かいぎ → spotkanie,
 * konferencja`). Czytanie stoi po lewej stronie strzałki i nie jest częścią znaczenia:
 * na opcji quizu byłoby podpowiedzią wymowy, przy dystraktorze samym szumem, a w liczeniu
 * długości glosy zjadało jedno z czterech dozwolonych słów. Dotyczy 642 z 1 321 haseł
 * japońskich; w pozostałych językach strzałka nie występuje ani razu.
 */
const READING_ARROW = '→'

function cleanGloss(raw: string): { gloss: string; reading: string | null } | null {
  const withoutQualifier = raw.replace(QUALIFIER, '').trim()
  const arrow = withoutQualifier.lastIndexOf(READING_ARROW)
  const gloss = arrow >= 0 ? withoutQualifier.slice(arrow + 1).trim() : withoutQualifier
  // Czytanie zostaje po lewej stronie strzałki. Nie wyrzucamy go, tylko zapamiętujemy
  // osobno: na karcie rdzenia jest jedynym czytaniem, o którym wiemy, że opisuje TO
  // znaczenie, a nie inne znaczenie tego samego znaku.
  const left = arrow >= 0 ? withoutQualifier.slice(0, arrow).trim() : ''
  const reading = left.length > 0 && left.length <= 12 ? left : null
  if (gloss.length === 0 || gloss.length > 60) return null
  if (REDIRECT.test(gloss) || FORM_OF.test(gloss)) return null

  // Definicje opisowe („taki, który…") nie nadają się na opcję w quizie. Zanim jednak
  // odrzucimy glosę za długość, próbujemy zdjąć z niej doprecyzowanie w nawiasie —
  // lepsza jest krótka glosa trafna niż dłuższa z dalszego znaczenia.
  const short =
    gloss.split(/\s+/).length > 4 ? gloss.replace(CLARIFIER, '').trim() || gloss : gloss
  if (short.split(/\s+/).length > 4) return null
  return { gloss: short, reading }
}

/**
 * Wymowa hasła — WYŁĄCZNIE transliteracja, nigdy IPA.
 *
 * IPA jest w zrzucie częstsza, ale na karcie jest gorsza niż nic: `夜` dostawało
 * `joɽu͍` zamiast `よる`, czyli zapis wymagający znajomości alfabetu fonetycznego
 * postawiony obok słowa, którego użytkownik dopiero się uczy. Transliteracja (`kitāb`,
 * `tambae`, `go`) czyta się bez żadnego przygotowania i to jest cały jej sens.
 *
 * Wikisłownik zapisuje ją z etykietą systemu (`ISO: yawm`) i czasem z wariantami
 * po ukośniku (`ghórfa / ḡórfa`) — zdejmujemy etykietę i bierzemy pierwszy wariant.
 * Puste `ISO:` bez wartości zdarza się i musi wypaść, bo inaczej karta pokazuje
 * samą nazwę systemu transliteracji.
 */
function pronunciationOf(record: Record<string, unknown>): string | null {
  const forms = Array.isArray(record['forms']) ? record['forms'] : []

  for (const entry of forms) {
    const item = entry as { form?: unknown; tags?: unknown }
    const tags = Array.isArray(item.tags) ? item.tags.map(String) : []
    if (!tags.some((tag) => /transliteration|romanization/i.test(tag))) continue
    if (typeof item.form !== 'string') continue

    const cleaned = (item.form.split('/')[0] ?? '')
      .replace(/^\s*[A-Za-z-]{2,10}\s*:\s*/, '')
      .trim()
    if (cleaned.length > 0 && cleaned.length <= 24) return cleaned
  }

  return null
}

/**
 * Buduje leksykon dla jednego języka, strumieniowo po zrzucie Wikisłownika.
 * Zrzut ma prawie gigabajt i 1,3 mln haseł, więc wynik cache'ujemy per język —
 * drugi przebieg czyta kilka megabajtów zamiast przemielać całość.
 */
export async function loadLexicon(langCode: string): Promise<Lexicon> {
  const cached = cachePath(`lexicon-${langCode}.json`)

  try {
    if ((await stat(cached)).size > 0) {
      const raw = JSON.parse(await readFile(cached, 'utf8')) as {
        entries: [string, Entry][]
        lemmas: [string, string][]
      }
      return { entries: new Map(raw.entries), lemmas: new Map(raw.lemmas) }
    }
  } catch {
    // brak cache — budujemy poniżej
  }

  const dump = await download(WIKTIONARY, 'plwiktionary.jsonl')
  process.stdout.write(`  buduję leksykon ${langCode} … `)

  const entries = new Map<string, Entry>()
  const lemmas = new Map<string, string>()

  for await (const line of readLines(dump)) {
    // Filtr po surowym tekście przed parsowaniem JSON-a: parsowanie 1,3 mln obiektów
    // trwa minuty, a interesuje nas kilka procent z nich.
    if (
      !line.includes(`"lang_code": "${langCode}"`) &&
      !line.includes(`"lang_code":"${langCode}"`)
    ) {
      continue
    }

    let record: Record<string, unknown>
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    if (record['lang_code'] !== langCode) continue

    const word = record['word']
    const pos = record['pos']
    if (typeof word !== 'string' || typeof pos !== 'string') continue

    const key = word.toLocaleLowerCase()
    const senses = Array.isArray(record['senses']) ? record['senses'] : []

    if (!entries.has(key)) {
      const collected: string[] = []
      const readings: (string | null)[] = []
      for (const sense of senses) {
        const glosses = (sense as { glosses?: unknown }).glosses
        if (!Array.isArray(glosses)) continue
        const first = glosses[0]
        if (typeof first !== 'string') continue
        const parsed = cleanGloss(first)
        if (parsed && !collected.includes(parsed.gloss)) {
          collected.push(parsed.gloss)
          readings.push(parsed.reading)
        }
        if (collected.length >= MAX_SENSES) break
      }
      if (collected.length > 0) {
        const say = pronunciationOf(record)
        entries.set(key, {
          pl: collected[0]!,
          senses: collected,
          readings,
          ...(say ? { say } : {}),
          pos,
        })
      }
    }

    const forms = Array.isArray(record['forms']) ? record['forms'] : []
    for (const entry of forms) {
      const form = (entry as { form?: unknown }).form
      if (typeof form !== 'string' || form.length === 0) continue
      const formKey = form.toLocaleLowerCase()
      if (formKey !== key && !lemmas.has(formKey)) lemmas.set(formKey, key)
    }
  }

  await writeFile(cached, JSON.stringify({ entries: [...entries], lemmas: [...lemmas] }), 'utf8')
  console.log(`${entries.size} haseł, ${lemmas.size} form odmienionych`)

  return { entries, lemmas }
}

/**
 * Sprowadza formę powierzchniową do postaci hasłowej. Fallback na samą formę jest
 * zgodny z sekcją 10.1: przy braku danych morfologicznych forma powierzchniowa
 * wystarcza do dopasowania do listy częstości.
 */
/**
 * Wybiera znaczenie pasujące do polskiego tłumaczenia zdania.
 *
 * Heurystyka jest prosta i celowo ostrożna: jeśli któreś ze znaczeń pojawia się
 * w tłumaczeniu (porównanie po rdzeniu, bo polski odmienia), bierzemy je. Jeśli żadne
 * albo kilka naraz — zostajemy przy pierwszym. Nie próbujemy ujednoznaczniać na siłę,
 * bo błędny wybór jest gorszy od domyślnego.
 */
export function senseInContext(entry: Entry, polishSentence: string): string {
  if (entry.senses.length <= 1) return entry.pl
  const haystack = polishSentence.toLocaleLowerCase()

  const matches = entry.senses.filter((sense) => {
    const head = sense.split(/[\s,;(/]+/)[0]
    if (!head || head.length < 4) return false
    // Rdzeń bez końcówki fleksyjnej: „niewolnik" → „niewolni", złapie „niewolnikiem".
    return haystack.includes(head.slice(0, Math.max(4, head.length - 2)))
  })

  return matches.length === 1 ? matches[0]! : entry.pl
}

export function lemmaOf(
  surface: string,
  lexicon: Lexicon,
  candidates?: (s: string) => string[],
): string {
  const key = surface.toLocaleLowerCase()
  if (lexicon.entries.has(key)) return key

  const known = lexicon.lemmas.get(key)
  if (known) return known

  // Hak adaptera: języki, w których forma powierzchniowa nie trafia w słownik,
  // podają własnych kandydatów na postać hasłową (sekcja 2.1).
  for (const candidate of candidates?.(surface) ?? []) {
    const lower = candidate.toLocaleLowerCase()
    if (lexicon.entries.has(lower)) return lower
  }
  return key
}

if (import.meta.filename === process.argv[1]) {
  const lang = process.argv[2]
  if (!lang) throw new Error('Użycie: node build/04-glosses.ts <kod-języka>')
  const lexicon = await loadLexicon(lang)
  console.log(`\nleksykon ${lang}: ${lexicon.entries.size} haseł`)
  for (const probe of ['agua', 'hund', 'casa', 'pan', 'leche', 'slav', 'árabe']) {
    const found = lexicon.entries.get(probe)
    if (found) console.log(`  ${probe} → ${found.senses.join(' / ')} (${found.pos})`)
  }
}
