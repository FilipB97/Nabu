/**
 * Krok 05 — złożenie talii. Sekcje 10.2 i 5.1 planu.
 *
 * Łączy zdania z Tatoeby, polskie tłumaczenia, pasma częstości i glosy w `sentences.json`,
 * odrzucając wszystko, co nie nadaje się na kartę. Raport z odrzutów idzie do
 * `build/report.json` — po pierwszym przebiegu warto go przejrzeć, bo tam widać,
 * który filtr jest za ostry.
 *
 * Tłumaczenia polskie w dwóch warstwach zaufania:
 *   `direct` — zdanie ma w Tatoebie bezpośrednie powiązanie z polskim
 *   `pivot`  — powiązanie przez angielski, ale TYLKO gdy prowadzi do dokładnie
 *              jednego polskiego zdania
 * Łańcuchy z wieloma kandydatami odrzucamy w całości. To 13–15% puli i akurat te
 * przypadki, w których angielski jest wieloznaczny, czyli gdzie dryf znaczenia
 * jest najbardziej prawdopodobny.
 */

import { writeFile } from 'node:fs/promises'
import { adapterFor } from '../src/langs/index.ts'
import type { LangAdapter } from '../src/langs/types.ts'
import { fetchSources } from './01-fetch.ts'
import { tokenize, type Token } from './02-tokenize.ts'
import { loadFrequency, bandOf, type FrequencyMap } from './03-frequency.ts'
import { loadLexicon, lemmaOf, senseInContext, type Lexicon } from './04-glosses.ts'
import { assignDistractors, buildPool } from './06-distractors.ts'
import { dataPath, ensureDir, readTsv, ROOT } from './lib/io.ts'
import { resolve } from 'node:path'

/**
 * Paczka zdań. Sekcja 14 planu przewiduje dzielenie talii, żeby nie przekroczyć limitu
 * cache Safari — przy ~550 bajtach na zdanie paczka waży poniżej 300 kB i da się ją
 * doładować na żądanie.
 */
const PACK_SIZE = 500

/** Części mowy, które nadają się na lukę. Zaimki, spójniki i rodzajniki nie uczą niczego. */
const CLOZE_POS = new Set(['noun', 'verb', 'adj', 'adv'])

/**
 * Poniżej tej rangi luka jest bezwartościowa: zasłonięcie „no" albo „tu" nie stawia
 * przed użytkownikiem żadnego pytania, bo słowo wynika z samej składni zdania.
 */
const CLOZE_MIN_BAND = 50

/**
 * Filtr po stronie polskiej. Zdanie w języku docelowym bywa neutralne, a jego tłumaczenie
 * nie — i odwrotnie. Polski jest zawsze językiem wyjściowym, więc ta lista jest stała
 * dla całego produktu, w odróżnieniu od `adapter.blocklist`.
 */
const POLISH_BLOCKLIST = /kurw|chuj|pizd|jeba|pierdol|dupek|skurwi|zajeb/iu

/**
 * Liczebniki odpadają jako luka. Wikisłownik tagguje je jako przymiotniki, więc trafiały
 * do puli razem z nimi i powstawały karty w rodzaju „El gato tiene ___ días" z opcjami
 * `corriente / celular / encantador`. Taką kartę rozwiązuje się samą składnią, bez
 * znajomości słowa — a to jest dokładnie ta wada, przed którą ostrzega makieta.
 * Rozpoznajemy je po cyfrze w glosie: Wikisłownik podaje „dwadzieścia, 20".
 */
const NUMERAL_GLOSS = /\d/

/** Token w postaci zapisywanej do pliku: pola puste są pomijane (sekcja 5.1). */
export type SlimToken = {
  s: string
  b: number
  r?: string
  pos?: string
  lemma?: string
  /** Glosa polska. Zapisywana tylko przy tokenie luki — reszta jej nie potrzebuje. */
  gloss?: string
}

export type Item = {
  id: string
  text: string
  tokens: SlimToken[]
  pl: string
  /** Skąd wzięło się tłumaczenie — do raportu i ewentualnego przeglądu. */
  src: 'direct' | 'pivot'
  band: number
  /** Indeks tokenu, który zasłaniamy luką. */
  cloze: number
  distractors: string[]
  quiz: boolean
}

type Rejects = Record<string, number>

function readPairs(rows: AsyncGenerator<string[]>): Promise<Map<string, string[]>> {
  return (async () => {
    const map = new Map<string, string[]>()
    for await (const row of rows) {
      const [from, to] = row
      if (!from || !to) continue
      const list = map.get(from)
      if (list) list.push(to)
      else map.set(from, [to])
    }
    return map
  })()
}

/**
 * Buduje mapę `id zdania w języku docelowym` → `polski tekst`, w dwóch warstwach zaufania.
 */
async function buildTranslations(
  sources: Awaited<ReturnType<typeof fetchSources>>,
): Promise<Map<string, { pl: string; src: 'direct' | 'pivot' }>> {
  const polish = new Map<string, string>()
  for await (const [id, , text] of readTsv(sources.polish)) {
    if (id && text) polish.set(id, text)
  }

  const out = new Map<string, { pl: string; src: 'direct' | 'pivot' }>()

  for await (const [from, to] of readTsv(sources.directLinks)) {
    if (!from || !to) continue
    const text = polish.get(to)
    if (text && !out.has(from)) out.set(from, { pl: text, src: 'direct' })
  }

  const engToPol = await readPairs(readTsv(sources.pivotToPolish))
  for (const [from, engs] of await readPairs(readTsv(sources.pivotLinks))) {
    if (out.has(from)) continue
    const candidates = new Set<string>()
    for (const eng of engs) for (const pol of engToPol.get(eng) ?? []) candidates.add(pol)
    // Wieloznaczny łańcuch → odrzucamy. Patrz komentarz na górze pliku.
    if (candidates.size !== 1) continue
    const text = polish.get([...candidates][0]!)
    if (text) out.set(from, { pl: text, src: 'pivot' })
  }

  return out
}

/** Nazwa własna: wielka litera nie na początku zdania i brak hasła w słowniku. */
function looksLikeProperNoun(token: Token, index: number, lexicon: Lexicon): boolean {
  if (index === 0) return false
  const first = token.s[0]
  if (!first || first !== first.toLocaleUpperCase() || first === first.toLocaleLowerCase()) {
    return false
  }
  return !lexicon.entries.has(token.s.toLocaleLowerCase())
}

function annotate(
  tokens: Token[],
  ranks: FrequencyMap,
  lexicon: Lexicon,
  adapter: LangAdapter,
): Token[] {
  return tokens.map((token) => {
    const lemma = lemmaOf(token.s, lexicon, adapter.lemmaCandidates)
    const entry = lexicon.entries.get(lemma)
    return {
      ...token,
      lemma,
      b: bandOf(token.s, ranks) ?? bandOf(lemma, ranks),
      // Część mowy nadana przez tokenizer (partykuły) ma pierwszeństwo przed słownikową.
      pos: token.pos ?? entry?.pos ?? null,
    }
  })
}

/**
 * Wybiera token do zasłonięcia. Preferujemy najrzadszy token, który ma glosę —
 * bez glosy nie da się pokazać opcji z tłumaczeniem, a to psuje kartę.
 */
function pickCloze(
  tokens: Token[],
  lexicon: Lexicon,
  sentenceBand: number,
  slack: number,
  allowed: Set<string>,
): number {
  if (sentenceBand < CLOZE_MIN_BAND) return -1

  let best = -1
  let bestBand = -1
  tokens.forEach((token, i) => {
    if (!token.pos || !allowed.has(token.pos)) return
    const entry = lexicon.entries.get(token.lemma)
    if (!entry || NUMERAL_GLOSS.test(entry.pl)) return
    const band = token.b ?? 0
    if (band > bestBand) {
      bestBand = band
      best = i
    }
  })

  if (best < 0) return -1

  // Zasada i+1 z sekcji 3.1: zdanie ma zawierać jedno nowe słowo i to o nie pytamy.
  // `clozeSlack` mówi, ilu tokenom wolno być rzadszymi od luki — dla klasy A zero,
  // czyli luka jest najrzadszym słowem. Powód poluzowania przy koreańskim: adapter.
  const rarer = tokens.filter((t) => (t.b ?? 0) > bestBand).length
  if (rarer > slack) return -1
  return best
}

/** Zrzuca token do postaci zapisywanej, pomijając pola puste. */
function slim(token: Token): SlimToken {
  const out: SlimToken = { s: token.s, b: token.b ?? 0 }
  if (token.r !== null) out.r = token.r
  if (token.pos !== null) out.pos = token.pos
  if (token.lemma !== token.s.toLocaleLowerCase()) out.lemma = token.lemma
  return out
}

export async function assemble(lang: string): Promise<{ items: Item[]; rejects: Rejects }> {
  const adapter: LangAdapter = adapterFor(lang)
  const sources = await fetchSources(lang)

  console.log(`\n[05-assemble] ${adapter.name}`)
  const ranks = await loadFrequency(sources.frequency)
  const lexicon = await loadLexicon(adapter.code)
  const translations = await buildTranslations(sources)
  console.log(`  tłumaczeń polskich: ${translations.size}`)

  const clozePos = new Set(adapter.quiz.clozePos ?? CLOZE_POS)

  const rejects: Rejects = {}
  const bump = (reason: string) => {
    rejects[reason] = (rejects[reason] ?? 0) + 1
  }

  const items: Item[] = []

  for await (const [id, , text] of readTsv(sources.sentences)) {
    if (!id || !text) continue

    const translation = translations.get(id)
    if (!translation) {
      bump('brak tłumaczenia polskiego')
      continue
    }
    if (!adapter.script.test(text)) {
      bump('znaki spoza zestawu języka')
      continue
    }
    if (adapter.blocklist.test(text) || POLISH_BLOCKLIST.test(translation.pl)) {
      bump('wulgaryzm')
      continue
    }

    const raw = tokenize(text, adapter)
    if (raw.length < adapter.sentence.minTokens) {
      bump('za krótkie')
      continue
    }
    if (raw.length > adapter.sentence.maxTokens) {
      bump('za długie')
      continue
    }

    const tokens = annotate(raw, ranks, lexicon, adapter)

    if (tokens.some((t, i) => looksLikeProperNoun(t, i, lexicon))) {
      bump('nazwa własna')
      continue
    }
    const unknown = tokens.filter((t) => t.b === null).length
    if (unknown > adapter.sentence.maxUnknown) {
      bump('za dużo tokenów spoza listy częstości')
      continue
    }

    // Tokeny nieznane nie wchodzą do pasma: nie wiemy, czy są rzadkie, czy tylko
    // odmienione. Nie mogą też być luką, bo ta wymaga i pasma, i glosy.
    const known = tokens.map((t) => t.b).filter((b): b is number => b !== null)
    if (known.length === 0) {
      bump('za dużo tokenów spoza listy częstości')
      continue
    }
    const band = Math.max(...known)
    if (band > adapter.maxBand) {
      bump('pasmo powyżej progu języka')
      continue
    }

    const cloze = pickCloze(tokens, lexicon, band, adapter.sentence.clozeSlack, clozePos)
    if (cloze < 0) {
      bump('brak tokenu nadającego się na lukę')
      continue
    }

    const slimmed = tokens.map(slim)
    const target = slimmed[cloze]!
    const entry = lexicon.entries.get(tokens[cloze]!.lemma)
    if (entry) target.gloss = senseInContext(entry, translation.pl)

    items.push({
      id: `${adapter.code}-s-${id}`,
      text,
      tokens: slimmed,
      pl: translation.pl,
      src: translation.src,
      band,
      cloze,
      distractors: [],
      quiz: false,
    })
  }

  // Sortowanie po paśmie: najłatwiejsze zdania na początku talii (sekcja 10.1).
  // Nie obcinamy listy — obcięcie do najłatwiejszych dałoby talię, w której wszystkie
  // zdania mieszczą się w kilkuset najczęstszych słowach i dobór i+1 nie ma z czego wybierać.
  items.sort((a, b) => a.band - b.band)

  console.log(`  przyjętych ${items.length}`)
  return { items, rejects }
}

export async function writeReport(lang: string, items: Item[], rejects: Rejects): Promise<void> {
  const adapter = adapterFor(lang)
  const bands = items.map((i) => i.band).sort((a, b) => a - b)
  const percentile = (p: number) => bands[Math.floor((bands.length - 1) * p)] ?? 0

  // Odrzuty dzielą się na trzy rodzaje i mieszanie ich czyni bramkę bezużyteczną:
  //
  //   poza zasięgiem — korpus nie ma polskiego tłumaczenia. To nie jest wada zdania,
  //     tylko granica źródła. Wliczone do odsetka dałoby 100% przy każdym języku.
  //   jakość — zdanie jest wadliwe: obce znaki, nazwa własna, wulgaryzm, zbyt rzadkie
  //     słowo. To mierzy bramka z sekcji 12.
  //   przydatność — zdanie jest poprawne, ale nie nadaje się na TĘ kartę: za krótkie,
  //     za długie, brak słowa nadającego się na lukę. To jest świadomy wybór, nie awaria,
  //     i dlatego liczymy je osobno.
  const QUALITY = new Set([
    'znaki spoza zestawu języka',
    'nazwa własna',
    'wulgaryzm',
    'pasmo powyżej progu języka',
    'za dużo tokenów spoza listy częstości',
  ])

  const { 'brak tłumaczenia polskiego': outOfReach = 0, ...rest } = rejects
  const quality = Object.entries(rest).filter(([k]) => QUALITY.has(k))
  const usefulness = Object.entries(rest).filter(([k]) => !QUALITY.has(k))
  const sum = (xs: [string, number][]) => xs.reduce((a, [, v]) => a + v, 0)
  const rejected = sum(quality)
  const candidates = rejected + sum(usefulness) + items.length

  const report = {
    lang: adapter.code,
    zdań: items.length,
    kandydatów: candidates,
    odrzuconychNaJakości: rejected,
    /** To jest liczba, którą mierzy bramka M1 — próg 30%. */
    odsetekOdrzutówJakościowych: candidates > 0 ? Math.round((rejected / candidates) * 100) : 0,
    odsetekNieprzydatnychNaKartę:
      candidates > 0 ? Math.round((sum(usefulness) / candidates) * 100) : 0,
    pozaZasięgiem: outOfReach,
    powodyJakość: Object.fromEntries(quality.sort((a, b) => b[1] - a[1])),
    powodyPrzydatność: Object.fromEntries(usefulness.sort((a, b) => b[1] - a[1])),
    tłumaczenia: {
      bezpośrednie: items.filter((i) => i.src === 'direct').length,
      przezAngielski: items.filter((i) => i.src === 'pivot').length,
    },
    pasma: {
      min: bands[0] ?? 0,
      mediana: percentile(0.5),
      p90: percentile(0.9),
      max: bands.at(-1) ?? 0,
    },
    quizNiedostępny: items.filter((i) => !i.quiz).length,
    /** Rozłożona po całym paśmie, nie z początku — patrz bramka M1. */
    próbka: Array.from({ length: 12 }, (_, n) => {
      const item = items[Math.floor((items.length - 1) * (n / 11))]
      if (!item) return null
      return {
        text: item.text,
        pl: item.pl,
        luka: item.tokens[item.cloze]?.s,
        band: item.band,
        src: item.src,
        dystraktory: item.distractors,
      }
    }).filter(Boolean),
  }

  await writeFile(
    resolve(ROOT, `build/report-${adapter.code}.json`),
    JSON.stringify(report, null, 2),
    'utf8',
  )
}

/**
 * Zapisuje talię w paczkach po `PACK_SIZE`, plus `meta.json` z indeksem.
 * Aplikacja ładuje paczkę wtedy, gdy pasmo użytkownika do niej dojdzie — dzięki temu
 * pierwsze uruchomienie ściąga kilkaset kilobajtów, a nie kilkanaście megabajtów.
 */
export async function writeDeck(lang: string, items: Item[]): Promise<void> {
  const adapter = adapterFor(lang)
  await ensureDir(dataPath(adapter.code, ''))

  const packs: { file: string; from: number; to: number; count: number }[] = []

  for (let start = 0; start < items.length; start += PACK_SIZE) {
    const slice = items.slice(start, start + PACK_SIZE)
    const index = packs.length
    const file = `sentences-${String(index).padStart(3, '0')}.json`
    await writeFile(dataPath(adapter.code, file), JSON.stringify({ items: slice }), 'utf8')
    packs.push({
      file,
      from: slice[0]?.band ?? 0,
      to: slice.at(-1)?.band ?? 0,
      count: slice.length,
    })
  }

  const lexicon = Object.fromEntries(
    [...buildPool(items)].map(([lemma, c]) => [
      lemma,
      { s: c.surface, pl: c.pl, pos: c.pos, b: c.band },
    ]),
  )
  await writeFile(dataPath(adapter.code, 'lexicon.json'), JSON.stringify(lexicon), 'utf8')

  const meta = {
    lang: adapter.code,
    version: new Date().toISOString().slice(0, 10),
    license:
      'Tatoeba CC BY 2.0 FR; FrequencyWords CC BY-SA 3.0; Wikisłownik (plwiktionary) CC BY-SA 3.0',
    sentences: items.length,
    lexicon: Object.keys(lexicon).length,
    packs,
  }
  await writeFile(dataPath(adapter.code, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
}

if (import.meta.filename === process.argv[1]) {
  const lang = process.argv[2]
  if (!lang) throw new Error('Użycie: node build/05-assemble.ts <kod-języka>')
  const { items, rejects } = await assemble(lang)
  assignDistractors(items, lang)
  await writeReport(lang, items, rejects)
  await writeDeck(lang, items)
  console.log('\nGotowe. Przejrzyj build/report-*.json.')
}
