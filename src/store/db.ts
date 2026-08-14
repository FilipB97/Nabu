import Dexie, { type Table } from 'dexie'
import type { CardState, LogEntry } from '@/srs/types'

/**
 * Magazyn lokalny — sekcja 5.3 i 5.5 planu.
 *
 * IndexedDB jest ŹRÓDŁEM PRAWDY, nie pamięcią podręczną chmury. Zapis idzie tu
 * natychmiast po każdej odpowiedzi i sesja nigdy nie czeka na sieć. Firestore
 * (M6) będzie kopią, a nie warunkiem działania.
 */

/** Ustawienia per język — sekcja 8.5. Motyw jest globalny i siedzi poza bazą. */
export type LangSettings = {
  lang: string
  /**
   * Aktywny dostaje nowe pozycje, utrzymywany tylko zaległe powtórki (sekcja 2.4).
   * Bez tego rozróżnienia pięć języków to 100+ kart dziennie i porzucenie aplikacji.
   */
  active: boolean
  intensity: 'short' | 'normal' | 'long'
  /** Poziom wejściowy — sekcja 3.1. Wybierany raz, przy dodaniu języka. */
  level: 'zero' | 'basics' | 'ok' | 'advanced'
  /**
   * Granica pasma, do której zakładamy znajomość słownictwa — wynik kalibracji.
   * Zero znaczy „nic nie zakładamy" i tak startuje konto od zera.
   */
  knownBand: number
  /** Czy kalibracja została przeprowadzona albo świadomie pominięta. */
  calibrated: boolean
  /**
   * Ręcznie wybrany etap — sekcja 2a: „etapy nie blokują sztywno". `null` znaczy,
   * że etap wyznacza brama opanowania, i tak jest domyślnie.
   *
   * To jest PRZYPIĘCIE: dopóki jest ustawione, etap się nie zmienia. Do wskazania
   * miejsca startu służy `startStage` — pomylenie tych dwóch rzeczy było usterką,
   * przez którą poziom „Zaawansowany" zostawał na stu najczęstszych słowach na zawsze.
   */
  stageOverride: 'script' | 'core' | 'sentences' | null
  /**
   * Etap, od którego zaczyna ten użytkownik — z poziomu wejściowego (sekcja 3.1).
   * Wcześniejsze etapy uznajemy za zaliczone i nie wracamy do nich; późniejsze
   * odblokowują się normalnie. `null` znaczy „od początku".
   */
  startStage: 'script' | 'core' | 'sentences' | null
  /** Liczba opcji w quizie: 3, 4 albo 6. */
  quizOptions: number
  /** Przejście dalej po trafieniu, bez dotykania „Dalej". Pudło zawsze czeka. */
  autoAdvance: boolean
  production: 'off' | 'mature' | 'always'
  furigana: 'always' | 'after' | 'never'
  romaji: boolean
  /** Tempo mowy 0.3–1.0. */
  rate: number
  /** Pasmo częstości, z którego dobieramy nowe pozycje (sekcja 3.1). */
  bandFrom: number
  bandTo: number
  addedAt: number
}

/** Ile kart w sesji, wg intensywności — sekcja 3.2. */
export const INTENSITY: Record<LangSettings['intensity'], { due: number; fresh: number }> = {
  short: { due: 10, fresh: 3 },
  normal: { due: 25, fresh: 8 },
  long: { due: 50, fresh: 15 },
}

export type StoredLog = LogEntry & { seq?: number }

class NabuDb extends Dexie {
  cards!: Table<CardState, string>
  log!: Table<StoredLog, number>
  settings!: Table<LangSettings, string>

  constructor() {
    super('nabu')
    this.version(1).stores({
      // `[lang+due]` obsługuje jedyne zapytanie gorące w sesji: „co jest do powtórki
      // w tym języku". Bez indeksu złożonego trzeba by przeglądać całą tabelę.
      cards: 'id, lang, due, stage, [lang+due], [lang+stage]',
      log: '++seq, ts, id, lang, [lang+ts]',
      settings: 'lang',
    })

    // Wersja 2 nie zmienia schematu, tylko wartość ustawienia. `autoAdvance` startowało
    // jako `true` w czasach, gdy ekran sesji w ogóle nie miał odsłonięcia — trafienie
    // przewijało kartę natychmiast i nie dało się zobaczyć, czy było dobrze. Ustawienia
    // nigdy nie było jak zmienić, więc `true` w bazie nie jest wyborem użytkownika,
    // tylko śladem po tamtym błędzie.
    this.version(2).upgrade((tx) =>
      tx
        .table<LangSettings>('settings')
        .toCollection()
        .modify((row) => {
          row.autoAdvance = false
        }),
    )

    /**
     * Wersja 3 rozdziela „od czego zaczynam" od „na czym stoję na stałe".
     *
     * Poziomy „Znam podstawy", „Radzę sobie" i „Zaawansowany" zapisywały
     * `stageOverride: 'core'`, czyli twarde przypięcie do stu najczęstszych słów.
     * Użytkownik, który zadeklarował, że szuka słów rzadkich, dostawał w kółko
     * pytania o słowa, które zna, i nie miał jak z tego wyjść inaczej niż przez
     * ustawienia. Przenosimy tę wartość tam, gdzie jej miejsce, i zdejmujemy przypięcie.
     */
    this.version(3).upgrade((tx) =>
      tx
        .table<LangSettings>('settings')
        .toCollection()
        .modify((row) => {
          if (row.startStage === undefined) row.startStage = null
          if (row.stageOverride !== 'core' || row.level === 'zero') return
          row.startStage = row.level === 'basics' ? 'core' : 'sentences'
          row.stageOverride = null
        }),
    )
  }
}

export const db = new NabuDb()

const DEFAULTS: Omit<LangSettings, 'lang' | 'addedAt'> = {
  active: true,
  intensity: 'normal',
  level: 'zero',
  knownBand: 0,
  calibrated: false,
  stageOverride: null,
  startStage: null,
  quizOptions: 4,
  // Domyślnie czekamy na dotknięcie. Odsłonięcie niesie treść do nauczenia się —
  // poprawne słowo, jego czytanie i glosę — więc nie może znikać samo.
  autoAdvance: false,
  production: 'mature',
  furigana: 'after',
  romaji: true,
  rate: 0.6,
  bandFrom: 1,
  bandTo: 500,
  addedAt: 0,
} as Omit<LangSettings, 'lang' | 'addedAt'>

export async function settingsFor(lang: string): Promise<LangSettings> {
  const stored = await db.settings.get(lang)
  if (stored) return stored
  const fresh: LangSettings = { ...DEFAULTS, lang, addedAt: Date.now() }
  await db.settings.put(fresh)
  return fresh
}

export async function updateSettings(
  lang: string,
  patch: Partial<Omit<LangSettings, 'lang'>>,
): Promise<LangSettings> {
  const current = await settingsFor(lang)
  const next = { ...current, ...patch }
  await db.settings.put(next)
  return next
}

/** Języki dodane przez użytkownika, w kolejności dodania. */
export async function addedLanguages(): Promise<LangSettings[]> {
  const all = await db.settings.toArray()
  return all.sort((a, b) => a.addedAt - b.addedAt)
}

/**
 * Zapisuje wynik odpowiedzi: stan karty i wpis w logu, w jednej transakcji.
 * Rozdzielenie ich groziłoby stanem, w którym karta ma nowy interwał, a log nie wie,
 * skąd się wziął — a to jest dokładnie ten materiał, na którym stanie kiedyś FSRS.
 */
export async function recordAnswer(card: CardState, entry: LogEntry): Promise<void> {
  await db.transaction('rw', db.cards, db.log, async () => {
    await db.cards.put(card)
    await db.log.add(entry)
  })
}

/** Karty do powtórki w danym języku, na teraz. */
export async function dueCards(lang: string, now: number, limit: number): Promise<CardState[]> {
  const cards = await db.cards
    .where('[lang+due]')
    .between([lang, Dexie.minKey], [lang, new Date(now).toISOString()])
    .limit(limit * 2)
    .toArray()
  return cards.filter((card) => !card.suspended).slice(0, limit)
}

/** Ile kart czeka w danym języku — do ekranu startu. */
export async function dueCount(lang: string, now: number): Promise<number> {
  return db.cards
    .where('[lang+due]')
    .between([lang, Dexie.minKey], [lang, new Date(now).toISOString()])
    .count()
}

/**
 * Liczba pozycji rozpoczętych, ale jeszcze nieutrwalonych. Powyżej progu przestajemy
 * dokładać nowe i mówimy o tym wprost na ekranie startu (sekcja 6, limit zaległości).
 */
export const BACKLOG_LIMIT = 20

export async function backlogCount(lang: string): Promise<number> {
  return db.cards.where('[lang+stage]').between([lang, ''], [lang, '￿']).filter(
    (card) => card.interval === 0 && card.reps > 0 && !card.suspended,
  ).count()
}

/** Identyfikatory pozycji, które użytkownik już widział — do doboru nowych. */
export async function seenIds(lang: string): Promise<Set<string>> {
  const ids = await db.cards.where('lang').equals(lang).primaryKeys()
  return new Set(ids)
}
