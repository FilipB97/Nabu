import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { adapterFor } from '@/langs'
import { AGAIN, GOOD } from '@/srs/types'
import { useSession } from '@/session/useSession'
import { splitAroundCloze } from '@/session/cloze'
import { QuizOption, type OptionState } from '@/ui/QuizOption'
import { Mono } from '@/ui/Mono'
import { Ticks } from '@/ui/Ticks'

/**
 * Ekran sesji — sekcja 8.4 planu.
 *
 * Karta ma dwa stany i to jest cała mechanika: pytanie i ODSŁONIĘCIE. Po dotknięciu
 * opcji nie przechodzimy dalej — pokazujemy, która była poprawna, czym różniła się
 * od wybranej i co znaczą oba słowa. Quiz bez tej przerwy nie uczy niczego: użytkownik
 * dostaje wynik, którego nie ma jak sprawdzić, i przewija zdania na oślep.
 *
 * Pudło zawsze czeka na „Dalej". Trafienie może przejść samo, jeśli użytkownik tak
 * ustawi — ale nie jest to domyślne, bo to właśnie na odsłonięciu jest treść do nauki.
 */

/** Ile trwa automatyczne przejście po trafieniu, gdy jest włączone. */
const AUTO_ADVANCE_MS = 1400

export function Session() {
  const { lang = '' } = useParams()
  const navigate = useNavigate()
  const adapter = adapterFor(lang)
  const { phase, current, reveal, progress, summary, settings, answer, next, markHard, undoLast } =
    useSession(lang)

  const hit = reveal !== null && reveal.chosen === reveal.correct

  // Klawiatura jest na desktopie podstawowym sposobem obsługi (sekcja 8.4).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'Escape') {
        event.preventDefault()
        navigate('/start')
        return
      }

      // Po odpowiedzi cyfry są martwe, a Enter i spacja przechodzą dalej. Odwrotnie
      // przed odpowiedzią — inaczej spacja odklikiwałaby kartę bez wyboru.
      if (reveal) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          next()
        }
        return
      }

      const options = current?.options?.options.length ?? 0
      const digit = Number.parseInt(event.key, 10)
      if (options > 0 && digit >= 1 && digit <= options) {
        event.preventDefault()
        void answer(digit - 1)
      }
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        void undoLast()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer, undoLast, next, navigate, current, reveal])

  // Automatyczne przejście tylko po trafieniu i tylko wtedy, gdy użytkownik niczego
  // na odsłonięciu nie dotknął.
  useEffect(() => {
    if (!reveal || !settings?.autoAdvance || !hit || reveal.held) return
    const timer = setTimeout(next, AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [reveal, settings, hit, next])

  useEffect(() => {
    if (phase === 'done' && summary) {
      navigate(`/koniec/${lang}`, { state: summary, replace: true })
    }
    if (phase === 'empty') navigate(`/start`, { replace: true })
  }, [phase, summary, lang, navigate])

  if (phase !== 'running' || !current || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Mono tone="normal">wczytuję talię…</Mono>
      </div>
    )
  }

  const { entry, options } = current
  const target = entry.item.tokens[entry.item.cloze]
  const { before, after } = splitAroundCloze(entry.item, adapter.tokenizer === 'space' ? ' ' : '')

  const fontClass = { ui: 'font-ui', display: 'font-display', ja: 'font-ja', ko: 'font-ko' }[
    adapter.display.font
  ]

  const stateOf = (index: number): OptionState => {
    if (!reveal) return 'idle'
    if (index === reveal.correct) return 'correct'
    if (index === reveal.chosen) return 'chosen-wrong'
    return 'dimmed'
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-bg">
      <div className="px-6 pt-[22px]">
        <Ticks
          total={progress.total}
          done={progress.done}
          lapses={progress.lapses}
          label={`karta ${progress.done + 1} z ${progress.total}`}
        />
        <div className="mt-[11px] flex items-center justify-between gap-3">
          {/* Wyjście z sesji. Bez potwierdzenia: każda odpowiedź jest już zapisana,
              więc przerwanie nic nie kosztuje (sekcja 5.3). */}
          <button
            type="button"
            onClick={() => navigate('/start')}
            aria-label="Zakończ sesję i wróć"
            className="-m-3 p-3"
          >
            <Mono tone="normal">← wyjdź</Mono>
          </button>
          <Mono tone="normal">
            {adapter.name} · {options ? 'cloze' : 'odsłonięcie'}
          </Mono>
          <Mono tone="normal">
            {progress.done + 1} / {progress.total}
          </Mono>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-[30px]">
        <p
          className={`${fontClass} text-text`}
          style={{ fontSize: `${adapter.display.size}px`, lineHeight: adapter.display.lineHeight }}
        >
          {before}
          {reveal?.answer ? (
            // Po odsłonięciu luka wypełnia się poprawnym słowem. To jest moment, w którym
            // zdanie po raz pierwszy da się przeczytać w całości — i po to jest cała karta.
            <span className="mx-1 border-b-2 border-accent text-accent">{reveal.answer.term}</span>
          ) : (
            <span
              className="mx-1 inline-block border-b-2 border-accent align-[-0.1em]"
              style={{ width: `${Math.max(2, (target?.s.length ?? 2) * 0.9)}em` }}
              aria-label="luka"
            />
          )}
          {after}
        </p>
        <p className="font-ui mt-[26px] text-[15px] leading-[1.5] text-text-2">{entry.item.pl}</p>

        {reveal?.answer && (
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
            <Mono tone={hit ? 'accent' : 'normal'}>{hit ? 'dobrze' : 'źle'}</Mono>
            {reveal.reading && (
              <span className="font-mono text-[13px] text-text-2">{reveal.reading}</span>
            )}
            <span className="font-ui text-[14px] text-text">{reveal.answer.gloss}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 px-6 pb-[34px]">
        {options ? (
          <>
            {options.options.map((option, index) => (
              <QuizOption
                key={option.id}
                term={option.term}
                gloss={option.gloss}
                state={stateOf(index)}
                chosen={reveal?.chosen === index}
                font={adapter.display.font}
                shortcut={index + 1}
                onSelect={() => void answer(index)}
              />
            ))}

            {reveal && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={next}
                  autoFocus
                  className="min-h-[62px] flex-1 border border-accent text-[15px] text-accent"
                >
                  Dalej
                </button>
                {reveal.canMarkHard && (
                  <button
                    type="button"
                    onClick={() => void markHard()}
                    className="font-ui min-h-[62px] px-4 text-[13px] text-text-2"
                  >
                    było trudne
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          // Fallback z sekcji 7.1: pozycja bez sensownych dystraktorów. Bez komunikatu —
          // użytkownik widzi po prostu kartę z odsłonięciem.
          <div className="flex flex-col gap-2">
            <p className={`${fontClass} text-[24px] text-text`}>
              {target?.s} <span className="font-ui text-[15px] text-text-2">{target?.gloss}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void answer(null, AGAIN)}
                className="min-h-[62px] flex-1 border border-border text-text"
              >
                Nie pamiętam
              </button>
              <button
                type="button"
                onClick={() => void answer(null, GOOD)}
                className="min-h-[62px] flex-1 border border-accent text-accent"
              >
                Dobrze
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
