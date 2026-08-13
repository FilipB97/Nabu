import { Link, useNavigate } from 'react-router'
import { adapterFor } from '@/langs'
import { useLangs } from '@/app/lang'
import { useWide } from '@/app/AppShell'
import { stageHint, stageLabel } from '@/session/stages'
import { primeSpeech } from '@/audio/speak'
import { BACKLOG_LIMIT, INTENSITY, updateSettings, type LangSettings } from '@/store/db'
import { Button } from '@/ui/Button'
import { Choice } from '@/ui/Choice'
import { Mono } from '@/ui/Mono'
import { StageBar } from '@/ui/StageBar'

/**
 * Ekran główny — sekcja 8.3 planu, po redesignie.
 *
 * Odpowiada na trzy pytania w jednym spojrzeniu: ile jest do zrobienia, ile to potrwa,
 * co dalej. Wszystko poza tym zeszło do ustawień — ekran, na który wchodzi się codziennie,
 * nie może być listą pokręteł.
 *
 * Jedyne mocne miejsce to liczba kart i przycisk startu. Reszta jest cicha.
 */

const INTENSITY_LABEL: Record<LangSettings['intensity'], string> = {
  short: 'krótka',
  normal: 'normalna',
  long: 'długa',
}

export function Start() {
  const navigate = useNavigate()
  const wide = useWide()
  const { rows, current, selected, select, refresh } = useLangs()

  if (!rows) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Mono tone="normal">wczytuję…</Mono>
      </div>
    )
  }

  if (rows.length === 0 || !current) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <h1 className="font-display text-[clamp(30px,7vw,44px)] leading-[1.15] text-text">
          Czego chcesz się uczyć?
        </h1>
        <p className="font-ui max-w-[520px] text-[15.5px] leading-[1.6] text-text-2">
          Możesz dodać kolejny język później. Dwa aktywne naraz to rozsądny sufit — pięć
          języków to sto kart dziennie i porzucenie aplikacji w drugim tygodniu.
        </p>
        <Link to="/dodaj" className="nabu-press nabu-accent-fill font-ui flex min-h-[58px]
          max-w-[280px] items-center justify-center text-[16px]">
          Wybierz język
        </Link>
      </div>
    )
  }

  const adapter = adapterFor(current.settings.lang)
  const fresh =
    current.backlog >= BACKLOG_LIMIT ? 0 : INTENSITY[current.settings.intensity].fresh
  const canStart = current.due > 0 || fresh > 0

  return (
    <div className="flex flex-col gap-[22px]">
      {/*
        Przełącznik języka wraca na górę tylko na telefonie — na desktopie jest w szynie.
        Rysujemy go także przy JEDNYM języku, bo mieszka w nim jedyne na telefonie wejście
        do dodawania kolejnego. Bez tego użytkownik z jednym językiem nie miał stąd żadnego
        wyjścia poza naukę tego, co już ma.
      */}
      {!wide && (
        <div className="flex flex-wrap gap-2">
          {rows.map((row) => (
            <button
              key={row.settings.lang}
              type="button"
              onClick={() => select(row.settings.lang)}
              aria-pressed={row.settings.lang === selected}
              className={`nabu-press font-ui flex min-h-[40px] items-center gap-2 rounded-full
                px-4 text-[14px] ${
                  row.settings.lang === selected
                    ? 'nabu-accent-fill'
                    : 'border border-border-quiet text-text-2'
                }`}
            >
              {adapterFor(row.settings.lang).name}
              {row.due > 0 && <span className="font-mono text-[12px] opacity-80">{row.due}</span>}
            </button>
          ))}
          <Link
            to="/dodaj"
            aria-label="Dodaj język"
            className="nabu-press font-ui flex min-h-[40px] items-center rounded-full border
              border-dashed border-border-quiet px-4 text-[14px] text-text-3"
          >
            + język
          </Link>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-[clamp(30px,5vw,40px)] leading-none text-text">
          {adapter.name}
        </h1>
        <Mono tone="accent">etap · {stageLabel(adapter, current.stage)}</Mono>
      </div>

      <section className="nabu-card flex flex-col gap-[26px] px-[clamp(20px,5vw,32px)] py-[clamp(22px,5vw,30px)]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-[clamp(54px,9vw,68px)] leading-none text-text">
              {current.due}
            </span>
            <span className="font-ui text-[15px] text-text-2">do powtórki</span>
          </div>
          {fresh > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[24px] leading-none text-accent">+{fresh}</span>
              <span className="font-ui text-[13.5px] text-text-2">nowych</span>
            </div>
          )}
        </div>

        <StageBar
          solid={current.progress.solid}
          needed={current.progress.needed}
          hint={stageHint(adapter, current.stage)}
          done={current.stage === 'sentences'}
        />

        {/* Jak działa ten system — przez cały etap 0, w jednym miejscu i bez powtarzania
            na każdej karcie. Quiz uczy rozpoznawania pojedynczej pozycji; tego, że kana
            jest tabelą pięciu samogłosek, hangul składa się w bloki, a chiński ton zmienia
            znaczenie słowa, nie nauczy nigdy. */}
        {current.stage === 'script' && adapter.scriptAbout && (
          <div className="flex flex-col gap-2 rounded-[14px] border border-border-quiet bg-surface-2 px-5 py-4">
            <Mono>jak działa {stageLabel(adapter, 'script')}</Mono>
            <p className="font-ui text-[13.5px] leading-[1.65] text-text-2">
              {adapter.scriptAbout}
            </p>
          </div>
        )}

        {current.backlog >= BACKLOG_LIMIT && (
          <p className="font-ui text-[13px] leading-[1.6] text-text-2">
            Czeka {current.backlog} rozpoczętych pozycji. Nie dokładamy kolejnych, dopóki nie
            zejdziesz poniżej {BACKLOG_LIMIT} — inaczej zaległość rośnie szybciej, niż da się
            ją nadrobić.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-5">
          <div className="min-w-[230px] flex-1">
            <Button
              variant="primary"
              full
              disabled={!canStart}
              className="min-h-[58px]"
              onClick={() => {
                // Pierwsze `speak()` musi wyjść z gestu użytkownika (ADR-001).
                primeSpeech()
                navigate(`/sesja/${current.settings.lang}`)
              }}
            >
              {canStart ? 'Zacznij naukę' : 'Na dziś gotowe'}
            </Button>
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
            <Mono>długość sesji</Mono>
            <Choice
              value={current.settings.intensity}
              options={(['short', 'normal', 'long'] as const).map((level) => ({
                value: level,
                label: INTENSITY_LABEL[level],
              }))}
              onChange={(intensity) =>
                void updateSettings(current.settings.lang, { intensity }).then(refresh)
              }
            />
          </div>
        </div>
      </section>

      <div className="grid gap-[14px] md:grid-cols-2">
        <Link
          to={`/postep/${current.settings.lang}`}
          className="nabu-press nabu-card flex flex-col gap-4 px-6 py-6"
        >
          <Mono>postęp</Mono>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-[38px] leading-none text-text">
              {current.progress.solid}
            </span>
            <span className="font-ui text-[13.5px] text-text-2">słów utrwalonych</span>
          </div>
          <p className="font-ui text-[12.5px] leading-[1.5] text-text-3">
            Mylone pary, prognoza powtórek i to, ile z talii jest już za Tobą.
          </p>
        </Link>

        <div className="nabu-card flex flex-col gap-4 px-6 py-6">
          <Mono>talia</Mono>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-[38px] leading-none text-text">
              {current.meta.sentences.toLocaleString('pl-PL')}
            </span>
            <span className="font-ui text-[13.5px] text-text-2">zdań w zapasie</span>
          </div>
          <p className="font-ui text-[12.5px] leading-[1.5] text-text-3">
            Materiał pochodzi z Tatoeby, glosy z Wikisłownika. Nic nie jest napisane maszynowo.
          </p>
        </div>
      </div>
    </div>
  )
}
