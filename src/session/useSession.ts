import { useCallback, useEffect, useRef, useState } from 'react'
import { adapterFor } from '@/langs'
import {
  gradeFromProduction,
  gradeFromQuiz,
  measure,
  medianOf,
  type QuizOutcome,
} from '@/srs/grade'
import { review } from '@/srs/sm2'
import {
  AGAIN,
  newCard,
  type CardState,
  type CardType,
  type Grade,
  type LogEntry,
} from '@/srs/types'
import {
  BACKLOG_LIMIT,
  INTENSITY,
  backlogCount,
  db,
  dueCards,
  recordAnswer,
  seenIds,
  settingsFor,
  type LangSettings,
} from '@/store/db'
import {
  loadBand,
  loadByIds,
  loadLexicon,
  loadMeta,
  loadStage,
  type DeckItem,
  type Lexicon,
} from '@/store/decks'
import { hasVoice } from '@/audio/speak'
import { currentStage, type GatedStage } from './stages.ts'
import { checkProduction, productionFor, type Production } from './produce.ts'
import {
  buildConfusions,
  buildOptions,
  type LastShown,
  type Option,
  type OptionSet,
} from './options.ts'
import {
  SessionQueue,
  cardedLemmas,
  knownLemmas,
  selectFresh,
  type QueueEntry,
} from './queue.ts'

/**
 * Spięcie silnika, magazynu i talii w jedną sesję — sekcja 8.4 planu.
 *
 * Cała logika oceniania siedzi w `src/srs/`, cały dobór opcji w `options.ts`,
 * a ten hook tylko je łączy i pilnuje kolejności zapisów. Zapis idzie po KAŻDEJ
 * odpowiedzi, nie na końcu — przerwana sesja ma nie kosztować postępu.
 */

export type SessionCard = {
  entry: QueueEntry
  /** Zestaw opcji albo `null`, gdy pozycja spada na kartę `reveal` (sekcja 7.1). */
  options: OptionSet | null
  /** Zadanie produkcji albo `null`, gdy karta jest quizem. */
  production: Production | null
  mode: CardType
  /**
   * Pierwsze spotkanie z pozycją: pokazujemy znak, czytanie i znaczenie, ZANIM o nie
   * zapytamy. Quiz bez tego kroku każe wybrać jedną z czterech rzeczy, których żadnej
   * użytkownik nie widział — to jest losowanie, nie nauka, a błąd w nim niesie karę
   * w harmonogramie za coś, czego nikt nie pokazał.
   */
  intro: boolean
}

/**
 * Stan odsłonięcia — to, co widać między odpowiedzią a następną kartą.
 *
 * Trzyma wszystko, czego potrzebuje ekran, żeby powiedzieć trzy rzeczy naraz:
 * czy było dobrze, jak brzmi poprawne słowo i co znaczy. Ekran nie sięga po nie
 * do karty, bo w trakcie odsłonięcia karta jest już policzona i odłożona.
 */
export type Reveal = {
  /** Czy odpowiedź była trafna. Przy produkcji nie ma indeksów, więc to jest jedyny nośnik. */
  hit: boolean
  /** Indeks wybranej opcji; `null` przy karcie bez opcji. */
  chosen: number | null
  correct: number | null
  grade: Grade
  /** Poprawna opcja — słowo i glosa, do wypełnienia luki. */
  answer: Option | null
  /** Czytanie: furigana dla japońskiego, pinyin dla chińskiego. */
  reading?: string
  /** Co użytkownik wpisał albo narysował — tylko przy produkcji. */
  given?: string
}

export type SessionSummary = {
  answered: number
  firstTry: number
  missed: number
  fresh: number
  startedAt: number
}

type Phase = 'loading' | 'running' | 'done' | 'empty' | 'error'

/**
 * Etap decyduje o rodzaju karty: `script` pyta o czytanie znaku, `core` o znaczenie
 * słowa, `sentences` o słowo w luce. Trzy różne pytania na tej samej maszynerii.
 *
 * `production` nie ma tu własnego wpisu, bo nie jest etapem, przez który przechodzi
 * język — to tryb pojedynczej dojrzałej karty i wchodzi dopiero w M8.
 *
 * Od `reps >= 3` co druga powtórka zdania idzie ze słuchu (sekcja 7.2): ta sama treść,
 * inny kanał. Co DRUGA, a nie każda — inaczej karta przestaje być czytana i zostaje
 * wyćwiczone rozpoznawanie brzmienia bez zapisu. Parzystość `reps` daje przeplot
 * bez losowania, więc powtórka jest przewidywalna, a nie kapryśna.
 */
export function modeFor(card: CardState, canListen: boolean): CardType {
  if (card.stage === 'script') return 'script'
  if (card.stage === 'core') return 'quiz-word'
  if (canListen && card.reps >= LISTEN_FROM_REPS && card.reps % 2 === 1) return 'quiz-listen'
  return 'quiz-cloze'
}

/** Od ilu powtórek karta zdania bywa zadawana ze słuchu — sekcja 7.2. */
const LISTEN_FROM_REPS = 3

/**
 * Karty do powtórki mogą pochodzić z różnych etapów naraz, a każdy etap leży w innym
 * pliku. Grupujemy po etapie i wczytujemy tylko to, co potrzebne.
 */
async function resolveItems(
  lang: string,
  cards: readonly CardState[],
): Promise<Map<string, DeckItem>> {
  const found = new Map<string, DeckItem>()

  for (const stage of ['script', 'core'] as const) {
    const ids = new Set(cards.filter((card) => card.stage === stage).map((card) => card.id))
    if (ids.size === 0) continue
    const deck = await loadStage(lang, stage)
    for (const item of deck.items) if (ids.has(item.id)) found.set(item.id, item)
  }

  const sentences = cards.filter((card) => card.stage === 'sentences').map((card) => card.id)
  for (const [id, item] of await loadByIds(lang, sentences)) found.set(id, item)

  return found
}

/** Pula, z której biorą się nowe pozycje na bieżącym etapie. */
async function poolFor(
  lang: string,
  stage: GatedStage,
  config: LangSettings,
  freshLimit: number,
): Promise<DeckItem[]> {
  if (freshLimit <= 0) return []
  if (stage === 'sentences') return loadBand(lang, config.bandFrom, config.bandTo)
  return (await loadStage(lang, stage)).items
}

/**
 * Słownik opcji. Scalamy etapy, których dotyczy ta sesja: identyfikatory są rozłączne
 * (`ja-w-*`, `ja-c-*`, lematy zdań), więc scalenie nie może niczego przesłonić.
 */
async function lexiconFor(
  lang: string,
  stage: GatedStage,
  due: readonly CardState[],
): Promise<Lexicon> {
  const needed = new Set<GatedStage>([stage, ...due.map((card) => card.stage as GatedStage)])
  let merged: Lexicon = {}

  for (const each of needed) {
    const part = each === 'sentences' ? await loadLexicon(lang) : (await loadStage(lang, each)).lexicon
    merged = { ...merged, ...part }
  }
  return merged
}

export function useSession(lang: string) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [current, setCurrent] = useState<SessionCard | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0, lapses: [] as number[] })
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [settings, setSettings] = useState<LangSettings | null>(null)
  const [stage, setStage] = useState<GatedStage>('sentences')

  const queue = useRef<SessionQueue | null>(null)
  const lexicon = useRef<Lexicon>({})
  const lastShown = useRef(new Map<string, LastShown>())
  const confusions = useRef(new Map<string, Map<string, number>>())
  const tempo = useRef<number | null>(null)
  const shownAt = useRef(0)
  const stats = useRef<SessionSummary>({
    answered: 0,
    firstTry: 0,
    missed: 0,
    fresh: 0,
    startedAt: 0,
  })
  /** Jeden poziom cofnięcia — sekcja 8.4. */
  const undo = useRef<{ before: CardState; entry: QueueEntry } | null>(null)
  /** Pozycje, które w tej sesji przeszły już przez wprowadzenie. */
  const introduced = useRef(new Set<string>())
  /**
   * Pozycje, które użytkownik kiedykolwiek widział — z bazy i z tej sesji. Steruje
   * doborem dystraktorów: na starcie etapu 0 opcje mają być z poznanych znaków,
   * a nie z całego inwentarza.
   */
  const met = useRef(new Set<string>())
  /** Czy system ma głos dla tego języka. Bez niego karta ze słuchu jest pustym ekranem. */
  const canListen = useRef(false)
  /** Odpowiedź zapisana, karta jeszcze na ekranie — czeka na „Dalej". */
  const pending = useRef<{ result: ReturnType<typeof review>; log: LogEntry; entry: QueueEntry } | null>(
    null,
  )

  const prepare = useCallback(
    (entry: QueueEntry, config: LangSettings): SessionCard => {
      // Pozycja widziana pierwszy raz idzie przez wprowadzenie. Opcji wtedy nie budujemy:
      // zestaw dystraktorów ma powstać dla PYTANIA, które padnie za chwilę, a nie dla
      // ekranu, na którym nie ma czego wybierać.
      if (entry.fresh && !introduced.current.has(entry.card.id)) {
        shownAt.current = Date.now()
        return {
          entry,
          options: null,
          production: null,
          mode: modeFor(entry.card, canListen.current),
          intro: true,
        }
      }

      // Produkcja ma pierwszeństwo przed quizem: karta dojrzała sprawdza wiedzę czynną,
      // a rozpoznanie jednej z czterech opcji da się wyćwiczyć, nie znając słowa (6.4).
      const production = productionFor(
        adapterFor(lang),
        entry.card,
        entry.item,
        config.production,
      )
      if (production) {
        shownAt.current = Date.now()
        const mode = `produce-${production.mode}` as CardType
        return { entry, options: null, production, mode, intro: false }
      }

      const built = buildOptions(
        entry.item,
        lexicon.current,
        config.quizOptions,
        lastShown.current.get(entry.card.id) ?? null,
        confusions.current,
        Math.random,
        met.current,
      )
      if (built) {
        lastShown.current.set(entry.card.id, {
          correctAt: built.correct,
          distractorIds: built.options.filter((_, i) => i !== built.correct).map((o) => o.id),
        })
      }
      shownAt.current = Date.now()
      return {
        entry,
        options: built,
        production: null,
        mode: built ? modeFor(entry.card, canListen.current) : 'reveal',
        intro: false,
      }
    },
    [lang],
  )

  /**
   * Zamyka wprowadzenie i zadaje pytanie o tę samą pozycję.
   *
   * Pytanie pada od razu, a nie za pięć kart: pierwsze przypomnienie tuż po pokazaniu
   * jest najtańsze i najskuteczniejsze, a karta i tak wróci w tej sesji przez kroki
   * nauki. Nic tu nie zapisujemy — wprowadzenie nie jest odpowiedzią i nie ma prawa
   * ruszyć harmonogramu.
   */
  const learned = useCallback(() => {
    const card = current
    if (!card || !settings) return
    introduced.current.add(card.entry.card.id)
    met.current.add(card.entry.card.id)
    setCurrent(prepare(card.entry, settings))
  }, [current, prepare, settings])

  // ---- budowa sesji ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function build() {
      setPhase('loading')
      const now = Date.now()
      const config = await settingsFor(lang)
      if (cancelled) return
      setSettings(config)

      const limits = INTENSITY[config.intensity]
      const adapter = adapterFor(lang)
      const meta = await loadMeta(lang)
      const allCards = await db.cards.where('lang').equals(lang).toArray()

      // Etap decyduje, skąd biorą się NOWE pozycje. Powtórki przychodzą ze wszystkich
      // etapów naraz — kana opanowana miesiąc temu ma wracać także wtedy, gdy użytkownik
      // jest już przy zdaniach (sekcja 2a).
      const stage = currentStage(adapter, allCards, meta, config.stageOverride)
      setStage(stage)
      canListen.current = hasVoice(adapter.tts.locale)

      const due = await dueCards(lang, now, limits.due)
      const dueItems = await resolveItems(lang, due)

      // Zaległości: powyżej progu nie dokładamy nowych i mówimy o tym na ekranie startu.
      const backlog = await backlogCount(lang)
      const freshLimit = config.active && backlog < BACKLOG_LIMIT ? limits.fresh : 0

      const pool = await poolFor(lang, stage, config, freshLimit)
      lexicon.current = await lexiconFor(lang, stage, due)
      const seen = await seenIds(lang)
      const known = knownLemmas(allCards, dueItems)
      const freshItems = selectFresh(
        pool,
        known,
        seen,
        freshLimit,
        cardedLemmas(allCards, dueItems),
        config.knownBand,
      )

      const log = await db.log.where('lang').equals(lang).reverse().limit(400).toArray()
      const samples = log.filter((e) => e.mode.startsWith('quiz')).map((e) => e.ms)
      tempo.current = medianOf(samples)
      confusions.current = buildConfusions(log.reverse(), (id) => {
        const item = dueItems.get(id)
        const token = item?.tokens[item.cloze]
        return token ? (token.lemma ?? token.s.toLocaleLowerCase()) : undefined
      })

      const entries: QueueEntry[] = [
        ...due.flatMap((card) => {
          const item = dueItems.get(card.id)
          return item ? [{ card, item, fresh: false }] : []
        }),
        ...freshItems.map((item) => {
          const target = item.tokens[item.cloze]
          const lemma = target ? (target.lemma ?? target.s.toLocaleLowerCase()) : undefined
          return { card: newCard(item.id, lang, stage, now, lemma), item, fresh: true }
        }),
      ]

      if (cancelled) return
      if (entries.length === 0) {
        setPhase('empty')
        return
      }

      queue.current = new SessionQueue(entries)
      stats.current = { answered: 0, firstTry: 0, missed: 0, fresh: 0, startedAt: now }
      introduced.current = new Set()
      met.current = new Set(seen)
      undo.current = null
      pending.current = null
      setReveal(null)
      setProgress({ done: 0, total: entries.length, lapses: [] })

      const first = queue.current.peek()
      setCurrent(first ? prepare(first, config) : null)
      setPhase('running')
    }

    // Talia jest wczytywana z sieci przy pierwszym użyciu języka. Bez tego bloku
    // pierwsze otwarcie w samolocie kończy się napisem „wczytuję talię…" bez końca,
    // a użytkownik nie ma jak się dowiedzieć, że po prostu nie ma jej jeszcze na dysku.
    void build().catch(() => {
      if (!cancelled) setPhase('error')
    })
    return () => {
      cancelled = true
    }
  }, [lang, prepare])

  // ---- przejście do następnej karty ------------------------------------------
  /**
   * Zdejmuje odpowiedzianą kartę i pokazuje kolejną. Osobno od `answer`, bo między
   * odpowiedzią a następną kartą jest teraz ODSŁONIĘCIE: użytkownik musi zobaczyć,
   * czy trafił, co znaczyło słowo i czym różniło się od tego, które wybrał. Bez tej
   * przerwy quiz nie uczy — daje tylko wynik, którego nie ma jak sprawdzić.
   */
  const next = useCallback(() => {
    const active = queue.current
    const done = pending.current
    if (!active || !done || !settings) return

    pending.current = null
    setReveal(null)

    const index = active.done
    active.take()
    if (done.result.inSession) active.reinsert({ ...done.entry, card: done.result.card })

    setProgress((prev) => ({
      done: active.done,
      total: active.total,
      lapses: done.log.grade === AGAIN ? [...prev.lapses, index] : prev.lapses,
    }))

    const upcoming = active.peek()
    if (!upcoming) {
      setSummary({ ...stats.current })
      setCurrent(null)
      setPhase('done')
      return
    }
    setCurrent(prepare(upcoming, settings))
  }, [prepare, settings])

  // ---- odpowiedź -------------------------------------------------------------
  const answer = useCallback(
    async (chosen: number | null, revealGrade?: Grade) => {
      const active = queue.current
      const card = current
      // `pending` niepuste znaczy, że karta jest już odpowiedziana i czeka na „Dalej".
      // Drugie dotknięcie w tym stanie nie może przestawić oceny.
      if (!active || !card || !settings || pending.current) return

      const now = Date.now()
      const { ms } = measure(now - shownAt.current)
      const correct = card.options ? chosen === card.options.correct : revealGrade !== AGAIN

      const outcome: QuizOutcome = { correct, ms }
      const grade =
        card.options === null && revealGrade !== undefined
          ? revealGrade
          : gradeFromQuiz(card.entry.card, outcome, { medianMs: tempo.current })

      const result = review(card.entry.card, grade, now)
      const chosenOption =
        card.options && chosen !== null ? card.options.options[chosen] : undefined

      const log: LogEntry = {
        ts: now,
        id: card.entry.card.id,
        lang,
        grade,
        ms,
        mode: card.mode,
        ...(chosenOption ? { chosen: chosenOption.id } : {}),
        ...(card.options ? { options: card.options.options.map((o) => o.id) } : {}),
      }
      await recordAnswer(result.card, log)

      undo.current = { before: card.entry.card, entry: card.entry }
      pending.current = { result, log, entry: card.entry }

      stats.current.answered += 1
      if (card.entry.fresh) stats.current.fresh += 1
      if (grade === AGAIN) stats.current.missed += 1
      else stats.current.firstTry += 1

      // Karta `reveal` nie ma czego odsłaniać — użytkownik sam przed chwilą ocenił
      // odpowiedź, którą widział. Odsłonięcie dotyczy wyłącznie quizu.
      if (!card.options) {
        next()
        return
      }

      const reading = card.entry.item.tokens[card.entry.item.cloze]?.r
      setReveal({
        hit: correct,
        chosen,
        correct: card.options.correct,
        grade,
        answer: card.options.options[card.options.correct] ?? null,
        ...(reading ? { reading } : {}),
      })
    },
    [current, lang, next, settings],
  )

  /**
   * Odpowiedź na karcie produkcji — sekcja 6.4.
   *
   * Ocena nie pyta użytkownika o nic: bierze fakt (trafił albo nie), liczbę podpowiedzi
   * i to, czy pomyłka dotyczyła wyłącznie znaków diakrytycznych. `café` zamiast `cafe`
   * jest inną pomyłką niż `mesa` zamiast `casa` i harmonogram ma to widzieć.
   */
  const answerProduction = useCallback(
    async (given: string, hints: number) => {
      const active = queue.current
      const card = current
      if (!active || !card?.production || !settings || pending.current) return

      const now = Date.now()
      const { ms } = measure(now - shownAt.current)
      const check = checkProduction(given, card.production.expected)

      const grade = gradeFromProduction(card.entry.card, {
        correct: check.correct,
        ms,
        hints,
        retries: 0,
        ...(check.nearMiss ? { nearMiss: true } : {}),
      })

      const result = review(card.entry.card, grade, now)
      const log: LogEntry = {
        ts: now,
        id: card.entry.card.id,
        lang,
        grade,
        ms,
        mode: card.mode,
      }
      await recordAnswer(result.card, log)

      undo.current = { before: card.entry.card, entry: card.entry }
      pending.current = { result, log, entry: card.entry }

      stats.current.answered += 1
      if (card.entry.fresh) stats.current.fresh += 1
      if (grade === AGAIN) stats.current.missed += 1
      else stats.current.firstTry += 1

      const target = card.entry.item.tokens[card.entry.item.cloze]
      setReveal({
        hit: check.correct,
        chosen: null,
        correct: null,
        grade,
        answer: {
          id: card.entry.card.id,
          term: card.production.expected,
          gloss: target?.gloss ?? '',
        },
        ...(target?.r ? { reading: target.r } : {}),
        given,
      })
    },
    [current, lang, settings],
  )

  /**
   * Cofnięcie ostatniej odpowiedzi. Jeden poziom wystarczy: nietrafione dotknięcie
   * jest normalne, ale bez cofania psuje harmonogram i frustruje (sekcja 8.4).
   */
  const undoLast = useCallback(async () => {
    const previous = undo.current
    if (!previous || !settings) return
    undo.current = null
    pending.current = null
    setReveal(null)

    await db.cards.put(previous.before)
    const last = await db.log.orderBy('seq').last()
    if (last?.seq !== undefined && last.id === previous.before.id) await db.log.delete(last.seq)

    setCurrent(prepare({ ...previous.entry, card: previous.before }, settings))
    setPhase('running')
  }, [prepare, settings])

  /**
   * Zeruje zegar odpowiedzi. Karta ze słuchu odtwarza zdanie zaraz po pokazaniu, więc
   * bez tego do czasu odpowiedzi wliczałoby się kilka sekund czytania — a `ms` jest
   * w tej aplikacji wielkością nośną, nie statystyką (sekcja 6.2).
   */
  const restartClock = useCallback(() => {
    shownAt.current = Date.now()
  }, [])

  return {
    phase,
    current,
    stage,
    reveal,
    progress,
    summary,
    settings,
    answer,
    answerProduction,
    learned,
    next,
    restartClock,
    undoLast,
    canUndo: undo.current !== null,
  }
}
