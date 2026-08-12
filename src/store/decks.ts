/**
 * Ładowanie talii — paczki na żądanie, nie wszystko naraz.
 *
 * `meta.json` trzyma indeks paczek z zakresem pasm, więc żeby dobrać zdania dla
 * użytkownika w paśmie 500–4000 nie trzeba ściągać całej talii — wystarczą paczki,
 * których zakres się z nim przecina. Przy japońskim to różnica między 6 MB a 300 kB
 * na pierwsze uruchomienie.
 */

export type DeckToken = {
  s: string
  b: number
  r?: string
  pos?: string
  lemma?: string
  gloss?: string
}

export type DeckItem = {
  id: string
  text: string
  tokens: DeckToken[]
  pl: string
  src: 'direct' | 'pivot'
  band: number
  /** Indeks tokenu zasłanianego luką. */
  cloze: number
  distractors: string[]
  quiz: boolean
}

export type DeckMeta = {
  lang: string
  version: string
  license: string
  sentences: number
  lexicon: number
  /** Liczebność etapu 0. Brak oznacza język bez obcego pisma. */
  script?: number
  /** Liczebność etapu 1 — mianownik bramy „opanowany" (sekcja 2a). */
  core?: number
  packs: { file: string; from: number; to: number; count: number }[]
}

export type LexiconEntry = { s: string; pl: string; pos: string; b: number }
export type Lexicon = Record<string, LexiconEntry>

/** Baza adresowa talii. Ta sama, pod którą Vite kopiuje `data/` obok builda. */
const BASE = `${import.meta.env.BASE_URL}data`

const metaCache = new Map<string, Promise<DeckMeta>>()
const lexiconCache = new Map<string, Promise<Lexicon>>()
const packCache = new Map<string, Promise<DeckItem[]>>()

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} przy pobieraniu ${url}`)
  return (await response.json()) as T
}

export function loadMeta(lang: string): Promise<DeckMeta> {
  const cached = metaCache.get(lang)
  if (cached) return cached
  const promise = fetchJson<DeckMeta>(`${BASE}/${lang}/meta.json`)
  metaCache.set(lang, promise)
  return promise
}

export function loadLexicon(lang: string): Promise<Lexicon> {
  const cached = lexiconCache.get(lang)
  if (cached) return cached
  const promise = fetchJson<Lexicon>(`${BASE}/${lang}/lexicon.json`)
  lexiconCache.set(lang, promise)
  return promise
}

function loadPack(lang: string, file: string): Promise<DeckItem[]> {
  const key = `${lang}/${file}`
  const cached = packCache.get(key)
  if (cached) return cached
  const promise = fetchJson<{ items: DeckItem[] }>(`${BASE}/${key}`).then((data) => data.items)
  packCache.set(key, promise)
  return promise
}

/**
 * Zdania z pasma przecinającego się z podanym zakresem. Paczki są posortowane po paśmie,
 * więc wystarczy wziąć te, których przedział zachodzi na żądany.
 */
export async function loadBand(lang: string, from: number, to: number): Promise<DeckItem[]> {
  const meta = await loadMeta(lang)
  const wanted = meta.packs.filter((pack) => pack.to >= from && pack.from <= to)
  const packs = await Promise.all(wanted.map((pack) => loadPack(lang, pack.file)))
  return packs.flat().filter((item) => item.band >= from && item.band <= to)
}

/** Pojedyncze zdania po identyfikatorach — do odtworzenia kart, które już są w bazie. */
export async function loadByIds(lang: string, ids: readonly string[]): Promise<Map<string, DeckItem>> {
  if (ids.length === 0) return new Map()

  const meta = await loadMeta(lang)
  const wanted = new Set(ids)
  const found = new Map<string, DeckItem>()

  // Bez indeksu id → paczka trzeba przejrzeć paczki po kolei. Przerywamy, gdy komplet
  // się znajdzie — karty do powtórki skupiają się w paśmie, które użytkownik przerabia.
  for (const pack of meta.packs) {
    if (found.size === wanted.size) break
    const items = await loadPack(lang, pack.file)
    for (const item of items) if (wanted.has(item.id)) found.set(item.id, item)
  }

  return found
}

/**
 * Etapy 0 i 1 — sekcja 2a.
 *
 * Oba pliki mają własny kształt w `data/`, bo pozycja etapu to znak albo słowo, a nie
 * zdanie z luką. Do sesji wchodzą jednak jako `DeckItem`: cała maszyneria — kolejka,
 * dobór opcji, ocena — działa na jednym typie i nie ma powodu jej rozdwajać. Zamiana
 * jest tutaj, na granicy wczytywania, i to jest jedyne miejsce, które zna oba kształty.
 *
 * Umowa jest ta sama co przy zdaniach: `tokens[0].s` to rzecz w piśmie docelowym,
 * `tokens[0].gloss` to etykieta odpowiedzi — czytanie przy etapie 0, polska glosa
 * przy etapie 1.
 */
type ScriptEntry = { id: string; s: string; r: string; distractors: string[]; quiz: boolean }
type CoreEntry = {
  id: string
  s: string
  r?: string
  pl: string
  band: number
  distractors: string[]
  quiz: boolean
}

export type StageDeck = { items: DeckItem[]; lexicon: Lexicon }

const stageCache = new Map<string, Promise<StageDeck>>()

export function loadStage(lang: string, stage: 'script' | 'core'): Promise<StageDeck> {
  const key = `${lang}/${stage}`
  const cached = stageCache.get(key)
  if (cached) return cached

  const promise = fetchJson<{ items: (ScriptEntry | CoreEntry)[]; lexicon: Lexicon }>(
    `${BASE}/${lang}/${stage}.json`,
  ).then(({ items, lexicon }) => ({
    lexicon,
    items: items.map((entry, index): DeckItem => {
      const label = 'pl' in entry ? entry.pl : entry.r
      const band = 'band' in entry ? entry.band : index + 1
      return {
        id: entry.id,
        text: entry.s,
        tokens: [{ s: entry.s, b: band, gloss: label, ...(entry.r ? { r: entry.r } : {}) }],
        // Pozycja etapu nie ma zdania, więc nie ma czego tłumaczyć. Ekran nie rysuje
        // wtedy wiersza tłumaczenia — nie pokazuje pustego.
        pl: '',
        src: 'direct',
        band,
        cloze: 0,
        distractors: entry.distractors,
        quiz: entry.quiz,
      }
    }),
  }))

  stageCache.set(key, promise)
  return promise
}

/** Czy talia jest już w pamięci podręcznej przeglądarki — do stanu „talia niepobrana". */
export async function isDownloaded(lang: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  const match = await caches.match(`${BASE}/${lang}/meta.json`)
  return match !== undefined
}
