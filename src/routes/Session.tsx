import { useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { adapterFor } from '@/langs'
import { AGAIN, GOOD } from '@/srs/types'
import { useSession } from '@/session/useSession'
import { layoutAroundCloze, type Piece } from '@/session/cloze'
import { speak, stopSpeaking } from '@/audio/speak'
import { ProduceCard } from '@/session/ProduceCard'
import { QuizOption, type OptionState } from '@/ui/QuizOption'
import { Button } from '@/ui/Button'
import { Mono } from '@/ui/Mono'
import { Progress } from '@/ui/Ticks'

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
 *
 * Układ jest jednokolumnowy i zbudowany od dołu: zdanie zajmuje środek, opcje siedzą
 * w zasięgu kciuka, a wszystko, co nie jest kartą, jest ciche.
 */

/** Ile trwa automatyczne przejście po trafieniu, gdy jest włączone. */
const AUTO_ADVANCE_MS = 1400

/** Nazwa etapu w nagłówku — użytkownik ma wiedzieć, czego się w tej sesji uczy. */
const STAGE_LABEL: Record<'script' | 'core' | 'sentences', string> = {
  script: 'pismo',
  core: 'rdzeń',
  sentences: 'zdania',
}

export function Session() {
  const { lang = '' } = useParams()
  const navigate = useNavigate()
  const adapter = adapterFor(lang)
  const {
    phase,
    current,
    stage,
    reveal,
    progress,
    summary,
    settings,
    answer,
    answerProduction,
    next,
    restartClock,
    undoLast,
  } = useSession(lang)

  const hit = reveal?.hit ?? false
  const listening = current?.mode === 'quiz-listen'
  const sentence = current?.entry.item.text ?? ''

  const say = useCallback(
    () => void speak(sentence, { locale: adapter.tts.locale, rate: settings?.rate ?? 0.6 }),
    [sentence, adapter, settings],
  )

  // Karta ze słuchu odtwarza zdanie sama, zaraz po pokazaniu, i dopiero wtedy rusza zegar
  // odpowiedzi. Pozostałe karty milczą, dopóki użytkownik nie dotknie głośnika.
  useEffect(() => {
    if (!listening || reveal) return
    let cancelled = false
    void speak(sentence, { locale: adapter.tts.locale, rate: settings?.rate ?? 0.6 }).then(() => {
      if (!cancelled) restartClock()
    })
    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [listening, reveal, sentence, adapter, settings, restartClock])

  // Wyjście z ekranu nie może zostawić mówiącej przeglądarki.
  useEffect(() => stopSpeaking, [])

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

      if (current?.production) return
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
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        say()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer, undoLast, next, navigate, current, reveal, say])

  // Automatyczne przejście wyłącznie po trafieniu — pudło zawsze czeka na dotknięcie,
  // bo to przy pudle jest najwięcej do przeczytania.
  useEffect(() => {
    if (!reveal || !settings?.autoAdvance || !hit) return
    const timer = setTimeout(next, AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [reveal, settings, hit, next])

  useEffect(() => {
    if (phase === 'done' && summary) {
      navigate(`/koniec/${lang}`, { state: summary, replace: true })
    }
    if (phase === 'empty') navigate(`/start`, { replace: true })
  }, [phase, summary, lang, navigate])

  if (phase === 'error') {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center gap-6 bg-bg px-7">
        <Mono tone="normal">talia niepobrana</Mono>
        <p className="font-ui text-[15px] leading-[1.6] text-text">
          Nie udało się wczytać materiału dla tego języka. Talia pobiera się przy pierwszym
          użyciu i zostaje na urządzeniu — jeśli jesteś offline, wróć tu z zasięgiem.
        </p>
        <Button variant="primary" full onClick={() => navigate('/start')}>
          Wróć
        </Button>
      </div>
    )
  }

  if (phase !== 'running' || !current || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Mono tone="normal">wczytuję talię…</Mono>
      </div>
    )
  }

  const { entry, options } = current
  const target = entry.item.tokens[entry.item.cloze]
  const layout = layoutAroundCloze(entry.item, adapter.tokenizer === 'space' ? ' ' : '')

  /**
   * Czytania nad wyrazami — sekcja 9 i M4. Ustawienie `furigana` decyduje KIEDY:
   * `always` od razu, `after` dopiero po odpowiedzi (żeby czytanie nie było podpowiedzią
   * przy karcie ze słuchu ani ściągą przy cloze), `never` wcale.
   *
   * `showReading` jest wtyczką adaptera: japoński pokazuje czytanie tylko nad kanji,
   * chiński nad wszystkim, języki łacińskie nie mają czego pokazywać.
   */
  const rubyVisible =
    settings.furigana === 'always' || (settings.furigana === 'after' && reveal !== null)

  const withRuby = (piece: Piece, key: number) => {
    const { glue, token } = piece
    const show = rubyVisible && token.r && (adapter.showReading?.(token.s, token.r) ?? true)
    return (
      <span key={key}>
        {glue}
        {show ? (
          <ruby>
            {token.s}
            <rt>{token.r}</rt>
          </ruby>
        ) : (
          token.s
        )}
      </span>
    )
  }

  const fontClass = { ui: 'font-ui', display: 'font-display', ja: 'font-ja', ko: 'font-ko' }[
    adapter.display.font
  ]

  // Etapy 0 i 1 pytają o pojedynczy znak albo pojedyncze słowo, a odpowiedzią jest
  // etykieta łacińska: czytanie albo polska glosa. Zdanie, tłumaczenie i luka nie mają
  // się wtedy z czego wziąć, więc karta jest jednoelementowa.
  //
  // Patrzymy na ETAP karty, nie na jej tryb: pozycja bez dystraktorów spada na `reveal`,
  // a wtedy tryb przestaje mówić cokolwiek o kształcie treści. Bez tego karta rdzenia
  // bez opcji rysowała pustą lukę w nieistniejącym zdaniu.
  const stageOfCard = entry.card.stage
  const jednoelementowa = stageOfCard === 'script' || stageOfCard === 'core'

  const stateOf = (index: number): OptionState => {
    if (!reveal) return 'idle'
    if (index === reveal.correct) return 'correct'
    if (index === reveal.chosen) return 'chosen-wrong'
    return 'dimmed'
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-bg">
      <header className="px-6 pt-[calc(env(safe-area-inset-top)+18px)]">
        <Progress
          total={progress.total}
          done={progress.done}
          lapses={progress.lapses}
          label={`karta ${progress.done + 1} z ${progress.total}`}
        />
        <div className="mt-[14px] flex items-center justify-between gap-3">
          {/* Wyjście z sesji. Bez potwierdzenia: każda odpowiedź jest już zapisana,
              więc przerwanie nic nie kosztuje (sekcja 5.3). */}
          <button
            type="button"
            onClick={() => navigate('/start')}
            aria-label="Zakończ sesję i wróć"
            className="nabu-press -m-3 rounded-full p-3"
          >
            <Mono tone="normal">← wyjdź</Mono>
          </button>
          <Mono>
            {adapter.name} · {STAGE_LABEL[stage]}
          </Mono>
          <Mono tone="normal">
            {progress.done + 1} / {progress.total}
          </Mono>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-7 px-7 py-10">
        {current.production && !reveal ? (
          <ProduceCard
            production={current.production}
            adapter={adapter}
            fontClass={fontClass}
            onAnswer={(given, hints) => void answerProduction(given, hints)}
          />
        ) : listening && !reveal ? (
          // Karta ze słuchu — sekcja 7.2. Nie ma tu nic do przeczytania i to jest cała
          // jej treść: ten sam materiał, inny kanał. Zdanie pokazujemy dopiero przy
          // odsłonięciu, żeby dało się sprawdzić, co się usłyszało.
          <div className="flex flex-col items-center gap-6">
            <button
              type="button"
              onClick={say}
              aria-label="Odtwórz zdanie ponownie"
              className="nabu-press nabu-accent-fill flex h-[104px] w-[104px] items-center
                justify-center rounded-full text-[38px]"
            >
              ►
            </button>
            <Mono tone="normal">posłuchaj i wybierz brakujące słowo</Mono>
          </div>
        ) : jednoelementowa ? (
          <p
            className={`${fontClass} text-center text-text`}
            style={{
              // Znak pisma jest całą treścią karty, więc dostaje całą uwagę. Słowo rdzenia
              // jest dłuższe, więc nieco mniejsze — ale nadal większe niż w zdaniu.
              fontSize: stageOfCard === 'script' ? '96px' : '54px',
              lineHeight: 1.25,
            }}
          >
            {entry.item.text}
          </p>
        ) : (
          <>
            <p
              className={`${fontClass} text-text`}
              style={{
                fontSize: `${adapter.display.size}px`,
                lineHeight: adapter.display.lineHeight,
              }}
            >
              {layout.before.map(withRuby)}
              {reveal?.answer ? (
                // Po odsłonięciu luka wypełnia się poprawnym słowem. To jest moment, w którym
                // zdanie po raz pierwszy da się przeczytać w całości — i po to jest cała karta.
                <span className="nabu-accent-tint nabu-reveal mx-[2px] rounded-[6px] px-[6px] text-accent">
                  {rubyVisible && reveal.reading ? (
                    <ruby>
                      {reveal.answer.term}
                      <rt>{reveal.reading}</rt>
                    </ruby>
                  ) : (
                    reveal.answer.term
                  )}
                </span>
              ) : (
                <span
                  className="mx-1 inline-block rounded-full border-b-[3px] border-accent align-[-0.15em]"
                  style={{ width: `${Math.max(2, (target?.s.length ?? 2) * 0.9)}em` }}
                  aria-label="luka"
                />
              )}
              {layout.after.map(withRuby)}
              {layout.tail}
            </p>

            <div className="flex items-start justify-between gap-4">
              <p className="font-ui text-[15px] leading-[1.55] text-text-2">{entry.item.pl}</p>
              <button
                type="button"
                onClick={say}
                aria-label="Przeczytaj zdanie"
                className="nabu-press -m-2 shrink-0 rounded-full p-2 text-[17px] text-text-3"
              >
                ♪
              </button>
            </div>
          </>
        )}

        {reveal?.answer && (
          <p
            className={`nabu-reveal flex flex-wrap items-baseline gap-x-3 gap-y-1
              ${jednoelementowa ? 'justify-center' : ''}`}
            aria-live="polite"
          >
            <Mono tone={hit ? 'accent' : 'normal'}>{hit ? 'dobrze' : 'źle'}</Mono>
            {reveal.given !== undefined && !hit && (
              <span className={`${fontClass} text-[15px] text-wrong-text`}>{reveal.given}</span>
            )}
            {reveal.reading && !rubyVisible && reveal.reading !== reveal.answer.gloss && (
              <span className="font-mono text-[13px] text-text-2">{reveal.reading}</span>
            )}
            <span className="font-ui text-[14px] text-text">{reveal.answer.gloss}</span>
          </p>
        )}
      </main>

      <div className="flex flex-col gap-[10px] px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {current.production ? (
          reveal && (
            <Button variant="primary" full onClick={next}>
              Dalej
            </Button>
          )
        ) : options ? (
          <>
            {options.options.map((option, index) => (
              <QuizOption
                key={option.id}
                // Przy etapach 0 i 1 odpowiedzią jest etykieta łacińska, a rzecz w piśmie
                // docelowym stoi już na przodzie karty. Pokazywanie jej drugi raz w opcji
                // zamieniłoby wybór w dopasowywanie dwóch identycznych napisów.
                term={jednoelementowa ? option.gloss : option.term}
                gloss={jednoelementowa ? '' : option.gloss}
                state={stateOf(index)}
                chosen={reveal?.chosen === index}
                font={jednoelementowa ? 'ui' : adapter.display.font}
                shortcut={index + 1}
                onSelect={() => void answer(index)}
              />
            ))}

            {/* Bez `autoFocus`: Enter i spacja i tak przechodzą dalej (obsługa klawiatury
                wyżej), a wymuszony fokus rysuje obwódkę wokół przycisku przy każdej
                odpowiedzi — na telefonie wygląda jak usterka. */}
            {reveal && (
              <div className="mt-3 flex items-center gap-3">
                <Button variant="primary" full onClick={next}>
                  Dalej
                </Button>
                {/* Cofnięcie było dotąd wyłącznie pod klawiszem `Z`, czyli na telefonie
                    nie istniało — a nietrafione dotknięcie zdarza się właśnie tam. */}
                <Button variant="ghost" onClick={() => void undoLast()}>
                  cofnij
                </Button>
              </div>
            )}
          </>
        ) : (
          // Fallback z sekcji 7.1: pozycja bez sensownych dystraktorów. Bez komunikatu —
          // użytkownik widzi po prostu kartę z odsłonięciem.
          <div className="flex flex-col gap-[10px]">
            <div className="nabu-card flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4">
              <span className={`${fontClass} text-[25px] text-text`}>{target?.s}</span>
              <span className="font-ui text-[13px] text-text-2">{target?.gloss}</span>
            </div>
            <div className="flex gap-[10px]">
              <Button full onClick={() => void answer(null, AGAIN)}>
                Nie pamiętam
              </Button>
              <Button variant="primary" full onClick={() => void answer(null, GOOD)}>
                Dobrze
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
