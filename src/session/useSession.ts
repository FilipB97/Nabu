import { useCallback, useEffect, useRef, useState } from 'react'
import { gradeFromQuiz, measure, medianOf, type QuizOutcome } from '@/srs/grade'
import { review } from '@/srs/sm2'
import { AGAIN, newCard, type CardState, type CardType, type Grade } from '@/srs/types'
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
import { loadBand, loadByIds, loadLexicon, type Lexicon } from '@/store/decks'
import { buildConfusions, buildOptions, type LastShown, type OptionSet } from './options.ts'
import { SessionQueue, knownLemmas, selectFresh, type QueueEntry } from './queue.ts'

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
  mode: CardType
}

export type SessionSummary = {
  answered: number
  firstTry: number
  missed: number
  fresh: number
  startedAt: number
}

type Phase = 'loading' | 'running' | 'done' | 'empty'

export function useSession(lang: string) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [current, setCurrent] = useState<SessionCard | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0, lapses: [] as number[] })
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [settings, setSettings] = useState<LangSettings | null>(null)

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

  const prepare = useCallback((entry: QueueEntry, options: number): SessionCard => {
    const built = buildOptions(
      entry.item,
      lexicon.current,
      options,
      lastShown.current.get(entry.card.id) ?? null,
      confusions.current,
    )
    if (built) {
      lastShown.current.set(entry.card.id, {
        correctAt: built.correct,
        distractorIds: built.options.filter((_, i) => i !== built.correct).map((o) => o.id),
      })
    }
    shownAt.current = Date.now()
    return { entry, options: built, mode: built ? 'quiz-cloze' : 'reveal' }
  }, [])

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
      lexicon.current = await loadLexicon(lang)

      const due = await dueCards(lang, now, limits.due)
      const dueItems = await loadByIds(
        lang,
        due.map((card) => card.id),
      )

      // Zaległości: powyżej progu nie dokładamy nowych i mówimy o tym na ekranie startu.
      const backlog = await backlogCount(lang)
      const freshLimit = config.active && backlog < BACKLOG_LIMIT ? limits.fresh : 0

      const pool = freshLimit > 0 ? await loadBand(lang, config.bandFrom, config.bandTo) : []
      const seen = await seenIds(lang)
      const allCards = await db.cards.where('lang').equals(lang).toArray()
      const known = knownLemmas(allCards, dueItems)
      const freshItems = selectFresh(pool, known, seen, freshLimit)

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
        ...freshItems.map((item) => ({
          card: newCard(item.id, lang, 'sentences', now),
          item,
          fresh: true,
        })),
      ]

      if (cancelled) return
      if (entries.length === 0) {
        setPhase('empty')
        return
      }

      queue.current = new SessionQueue(entries)
      stats.current = { answered: 0, firstTry: 0, missed: 0, fresh: 0, startedAt: now }
      setProgress({ done: 0, total: entries.length, lapses: [] })

      const first = queue.current.peek()
      setCurrent(first ? prepare(first, config.quizOptions) : null)
      setPhase('running')
    }

    void build()
    return () => {
      cancelled = true
    }
  }, [lang, prepare])

  // ---- odpowiedź -------------------------------------------------------------
  const answer = useCallback(
    async (chosen: number | null, markedHard = false, revealGrade?: Grade) => {
      const active = queue.current
      const card = current
      if (!active || !card || !settings) return

      const now = Date.now()
      const { ms } = measure(now - shownAt.current)
      const correct = card.options ? chosen === card.options.correct : revealGrade !== AGAIN

      const outcome: QuizOutcome = { correct, ms, markedHard }
      const grade =
        card.options === null && revealGrade !== undefined
          ? revealGrade
          : gradeFromQuiz(card.entry.card, outcome, { medianMs: tempo.current })

      const result = review(card.entry.card, grade, now)
      const chosenOption =
        card.options && chosen !== null ? card.options.options[chosen] : undefined

      await recordAnswer(result.card, {
        ts: now,
        id: card.entry.card.id,
        lang,
        grade,
        ms,
        mode: card.mode,
        ...(chosenOption ? { chosen: chosenOption.id } : {}),
        ...(card.options ? { options: card.options.options.map((o) => o.id) } : {}),
      })

      undo.current = { before: card.entry.card, entry: card.entry }

      stats.current.answered += 1
      if (card.entry.fresh) stats.current.fresh += 1
      if (grade === AGAIN) stats.current.missed += 1
      else stats.current.firstTry += 1

      const index = active.done
      active.take()
      if (result.inSession) active.reinsert({ ...card.entry, card: result.card })

      setProgress((prev) => ({
        done: active.done,
        total: active.total,
        lapses: grade === AGAIN ? [...prev.lapses, index] : prev.lapses,
      }))

      const next = active.peek()
      if (!next) {
        setSummary({ ...stats.current })
        setCurrent(null)
        setPhase('done')
        return
      }
      setCurrent(prepare(next, settings.quizOptions))
    },
    [current, lang, prepare, settings],
  )

  /**
   * Cofnięcie ostatniej odpowiedzi. Jeden poziom wystarczy: nietrafione dotknięcie
   * jest normalne, ale bez cofania psuje harmonogram i frustruje (sekcja 8.4).
   */
  const undoLast = useCallback(async () => {
    const previous = undo.current
    if (!previous || !settings) return
    undo.current = null

    await db.cards.put(previous.before)
    const last = await db.log.orderBy('seq').last()
    if (last?.seq !== undefined && last.id === previous.before.id) await db.log.delete(last.seq)

    setCurrent(prepare({ ...previous.entry, card: previous.before }, settings.quizOptions))
    setPhase('running')
  }, [prepare, settings])

  return {
    phase,
    current,
    progress,
    summary,
    settings,
    answer,
    undoLast,
    canUndo: undo.current !== null,
  }
}
