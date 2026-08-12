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
const REDIRECT = /^(lm|lp|lmn|forma|rodzaj|zob\.|zdrobn|stopień|imiesł|czas |tryb |os\. )/i

/**
 * Wikisłownik zapisuje odsyłacze do formy jako „ż lp od: pleno" — kwalifikator gramatyczny
 * z przodu, więc dopasowanie do początku ciągu tego nie łapie. „od:" w środku glosy
 * praktycznie zawsze oznacza odsyłacz.
 */
const FORM_OF = /\bod:\s/i

/** Znaczniki gramatyczne w nawiasach i kwalifikatory na początku glosy. */
const QUALIFIER = /^\([^)]*\)\s*/

function cleanGloss(raw: string): string | null {
  const gloss = raw.replace(QUALIFIER, '').trim()
  if (gloss.length === 0 || gloss.length > 60) return null
  if (REDIRECT.test(gloss) || FORM_OF.test(gloss)) return null
  // Definicje opisowe („taki, który…") nie nadają się na opcję w quizie.
  if (gloss.split(/\s+/).length > 4) return null
  return gloss
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
    if (!line.includes(`"lang_code": "${langCode}"`) && !line.includes(`"lang_code":"${langCode}"`)) {
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
      for (const sense of senses) {
        const glosses = (sense as { glosses?: unknown }).glosses
        if (!Array.isArray(glosses)) continue
        const first = glosses[0]
        if (typeof first !== 'string') continue
        const gloss = cleanGloss(first)
        if (gloss && !collected.includes(gloss)) collected.push(gloss)
        if (collected.length >= MAX_SENSES) break
      }
      if (collected.length > 0) {
        entries.set(key, { pl: collected[0]!, senses: collected, pos })
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

  await writeFile(
    cached,
    JSON.stringify({ entries: [...entries], lemmas: [...lemmas] }),
    'utf8',
  )
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

export function lemmaOf(surface: string, lexicon: Lexicon): string {
  const key = surface.toLocaleLowerCase()
  if (lexicon.entries.has(key)) return key
  return lexicon.lemmas.get(key) ?? key
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
