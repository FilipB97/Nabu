import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LangAdapter } from '@/langs'
import { QuizOption, type OptionState } from '@/ui/QuizOption'
import { Button } from '@/ui/Button'
import { Mono } from '@/ui/Mono'
import { Progress } from '@/ui/Ticks'
import { fontClassFor } from '@/ui/script'

/**
 * Karta `quiz-cloze` — sekcja 7 i 8.4 planu.
 *
 * Jedno dotknięcie kończy odpowiedź, po czym karta przechodzi w ODSŁONIĘCIE: luka
 * wypełnia się poprawnym słowem, opcje ujawniają glosy, a dalej idzie się dotknięciem.
 *
 * W M0 to jest demonstracja układu na prawdziwej treści w trzech systemach pisma —
 * silnik SRS, kolejka i dobór dystraktorów wchodzą w M2. Wszystko, co dotyczy oceny,
 * jest tu celowo nieobecne: mapowanie wyniku na ocenę SM-2 (sekcja 6.2) należy
 * do `src/srs/`, nie do komponentu.
 */

export type QuizContent = {
  adapter: LangAdapter
  /** Nagłówek karty, np. „japoński · cloze". */
  kind: string
  /** Zdanie przed luką. */
  before: string
  /** Zdanie po luce. */
  after: string
  /** Wyraz w luce — pokazywany po odpowiedzi. */
  answer: string
  /** Czytanie wyrazu w luce; renderowane jako `<rt>`, gdy adapter go wymaga. */
  reading?: string
  /** Tłumaczenie całego zdania na polski. */
  pl: string
  /** Glosa wyrazu z luki, ujawniana po odpowiedzi. */
  gloss: string
  /** Ranga częstości — pokazywana przy nowym słowie. */
  band?: number
  /** Szerokość luki, żeby układ nie skakał przy ujawnieniu odpowiedzi. */
  gapWidth: string
  correct: number
  options: ReadonlyArray<{ term: string; gloss: string }>
}


type QuizCardProps = {
  content: QuizContent
  /** Postęp sesji — pasek u góry. */
  progress?: { total: number; done: number; lapses?: readonly number[] }
  /** Wymuszony stan, do statycznych podglądów w demie. */
  initialPick?: number | null
  /** Czy karta reaguje na klawiaturę. W demie tylko jedna karta może słuchać naraz. */
  keyboard?: boolean
  onNext?: () => void
}

export function QuizCard({
  content,
  progress,
  initialPick = null,
  keyboard = false,
  onNext,
}: QuizCardProps) {
  const [pick, setPick] = useState<number | null>(initialPick)

  const answered = pick !== null
  const right = answered && pick === content.correct
  const { adapter } = content
  const fontClass = fontClassFor(adapter.display.font)

  const choose = useCallback((index: number) => {
    setPick((current) => (current === null ? index : current))
  }, [])

  const next = useCallback(() => {
    setPick(null)
    onNext?.()
  }, [onNext])

  // Klawiatura jest na desktopie podstawowym sposobem obsługi, nie udogodnieniem
  // (sekcja 8.4). Sięganie myszą do opcji jest wolniejsze niż dotknięcie na telefonie.
  useEffect(() => {
    if (!keyboard) return

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const digit = Number.parseInt(event.key, 10)
      if (!Number.isNaN(digit) && digit >= 1 && digit <= content.options.length) {
        event.preventDefault()
        choose(digit - 1)
        return
      }
      if ((event.key === 'Enter' || event.key === ' ') && answered) {
        event.preventDefault()
        next()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard, answered, choose, next, content.options.length])

  const stateOf = (index: number): OptionState => {
    if (!answered) return 'idle'
    if (index === content.correct) return 'correct'
    if (index === pick) return 'chosen-wrong'
    return 'dimmed'
  }

  const gap = useMemo(() => {
    if (!answered) {
      return (
        <span
          className="inline-block border-b-2 border-accent align-[-0.1em]"
          style={{ width: content.gapWidth }}
          aria-label="luka"
        />
      )
    }
    if (adapter.needsReading && content.reading) {
      return (
        <ruby className="text-accent">
          {content.answer}
          <rt className="text-[0.42em] text-accent">{content.reading}</rt>
        </ruby>
      )
    }
    return <span className="text-accent">{content.answer}</span>
  }, [answered, adapter.needsReading, content.answer, content.reading, content.gapWidth])

  return (
    <div className="flex h-full w-full flex-col bg-bg">
      {progress && (
        <div className="px-6 pt-[22px]">
          <Progress
            total={progress.total}
            done={progress.done}
            {...(progress.lapses ? { lapses: progress.lapses } : {})}
            label={`karta ${progress.done + 1} z ${progress.total}`}
          />
          <div className="mt-[11px] flex justify-between">
            <Mono tone="normal">{content.kind}</Mono>
            <Mono tone="normal">
              {progress.done + 1} / {progress.total}
            </Mono>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center px-[30px]">
        <p
          className={`${fontClass} text-text ${answered ? 'nabu-reveal' : ''}`}
          style={{
            fontSize: `${adapter.display.size}px`,
            lineHeight: adapter.display.lineHeight,
          }}
        >
          {content.before}
          {gap}
          {content.after}
        </p>

        <p className="font-ui mt-[26px] text-[15px] leading-[1.5] text-text-2">{content.pl}</p>

        {answered && (
          <div className="nabu-reveal mt-[30px] flex flex-col gap-[7px] border-t border-border-quiet pt-5">
            <Mono tone={right ? 'accent' : 'normal'}>
              {right ? 'dobrze · 1 dzień' : 'nie pamiętam · 1 min'}
              {content.band !== undefined && ` · ranga ${content.band}`}
            </Mono>
            <p className={`${fontClass} text-[20px] leading-[1.4] text-text`}>
              {content.answer}
              {content.reading && (
                <span className="font-ui ml-2 text-[15px] text-text-2">{content.reading}</span>
              )}
              <span className="font-ui text-[15px] text-text-2"> — {content.gloss}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[10px] px-5 pb-[34px]">
        {content.options.map((option, index) => (
          <QuizOption
            key={option.term}
            term={option.term}
            gloss={option.gloss}
            state={stateOf(index)}
            chosen={pick === index}
            font={adapter.display.font}
            {...(keyboard ? { shortcut: index + 1 } : {})}
            onSelect={() => choose(index)}
          />
        ))}

        {answered && (
          <Button variant="primary" full onClick={next} className="mt-3">
            Dalej
          </Button>
        )}
      </div>
    </div>
  )
}
