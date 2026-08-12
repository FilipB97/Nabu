import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { adapterFor } from '@/langs'
import { AGAIN, GOOD } from '@/srs/types'
import { useSession } from '@/session/useSession'
import { QuizOption } from '@/ui/QuizOption'
import { Mono } from '@/ui/Mono'
import { Ticks } from '@/ui/Ticks'

/**
 * Ekran sesji — sekcja 8.4 planu.
 *
 * Jedno dotknięcie kończy odpowiedź. Trafienie może przejść dalej samo, pudło zawsze
 * czeka na „Dalej" i pokazuje, czym wybrane słowo różniło się od poprawnego.
 */

export function Session() {
  const { lang = '' } = useParams()
  const navigate = useNavigate()
  const adapter = adapterFor(lang)
  const { phase, current, progress, summary, settings, answer, undoLast } = useSession(lang)

  // Klawiatura jest na desktopie podstawowym sposobem obsługi (sekcja 8.4).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
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
  }, [answer, undoLast, current])

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
  const before = entry.item.tokens
    .slice(0, entry.item.cloze)
    .map((t) => t.s)
    .join(adapter.tokenizer === 'space' ? ' ' : '')
  const after = entry.item.tokens
    .slice(entry.item.cloze + 1)
    .map((t) => t.s)
    .join(adapter.tokenizer === 'space' ? ' ' : '')

  const fontClass = { ui: 'font-ui', display: 'font-display', ja: 'font-ja', ko: 'font-ko' }[
    adapter.display.font
  ]

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-bg">
      <div className="px-6 pt-[22px]">
        <Ticks
          total={progress.total}
          done={progress.done}
          lapses={progress.lapses}
          label={`karta ${progress.done + 1} z ${progress.total}`}
        />
        <div className="mt-[11px] flex justify-between">
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
          <span
            className="mx-1 inline-block border-b-2 border-accent align-[-0.1em]"
            style={{ width: `${Math.max(2, (target?.s.length ?? 2) * 0.9)}em` }}
            aria-label="luka"
          />
          {after}
        </p>
        <p className="font-ui mt-[26px] text-[15px] leading-[1.5] text-text-2">{entry.item.pl}</p>
      </div>

      <div className="flex flex-col gap-2 px-6 pb-[34px]">
        {options ? (
          options.options.map((option, index) => (
            <QuizOption
              key={option.id}
              term={option.term}
              gloss={option.gloss}
              state="idle"
              font={adapter.display.font}
              shortcut={index + 1}
              onSelect={() => void answer(index)}
            />
          ))
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
                onClick={() => void answer(null, false, AGAIN)}
                className="min-h-[62px] flex-1 border border-border text-text"
              >
                Nie pamiętam
              </button>
              <button
                type="button"
                onClick={() => void answer(null, false, GOOD)}
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
