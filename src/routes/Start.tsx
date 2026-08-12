import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LANG_CODES, adapterFor, interferesWith } from '@/langs'
import { currentStage, gatedStages, stageProgress, type GatedStage } from '@/session/stages'
import { LEVELS, levelById, type Level } from '@/session/calibration'
import { loadMeta, type DeckMeta } from '@/store/decks'
import {
  BACKLOG_LIMIT,
  INTENSITY,
  addedLanguages,
  backlogCount,
  db,
  dueCount,
  settingsFor,
  updateSettings,
  type LangSettings,
} from '@/store/db'
import { hasVoice, onVoicesChanged, primeSpeech } from '@/audio/speak'
import { Mark } from '@/ui/Ticks'
import { Mono } from '@/ui/Mono'
import { Choice } from '@/ui/Choice'
import { Button } from '@/ui/Button'

/**
 * Ekran startu sesji — sekcja 8.3 planu.
 *
 * Ma odpowiadać na trzy pytania w jednym spojrzeniu: ile jest do zrobienia, ile to
 * potrwa, co się dzieje dalej. Przełącznik języka jest na wierzchu, nie w ustawieniach,
 * a języki aktywne są oddzielone od utrzymywanych (sekcja 2.4).
 *
 * Liczba do powtórki jest największym elementem na ekranie i stoi na karcie razem
 * z przyciskiem startu — to jest jedyna rzecz, po którą użytkownik tu przychodzi.
 */

type Row = {
  settings: LangSettings
  due: number
  backlog: number
  stage: GatedStage
  progress: { solid: number; needed: number }
  meta: DeckMeta
}

const STAGE_LABEL: Record<GatedStage, string> = {
  script: 'pismo',
  core: 'rdzeń',
  sentences: 'zdania',
}

const STAGE_HINT: Record<GatedStage, string> = {
  script: 'Najpierw znaki. Bez nich zdanie jest obrazkiem.',
  core: 'Sto najczęstszych słów. Potem zdania mają się o co oprzeć.',
  sentences: 'Zdania z korpusu, po jednym nowym słowie na raz.',
}

const INTENSITY_LABEL: Record<LangSettings['intensity'], string> = {
  short: 'krótka',
  normal: 'normalna',
  long: 'długa',
}

export function Start() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  /**
   * Głosy systemowe pojawiają się asynchronicznie, a na iOS także po pobraniu przez
   * użytkownika w trakcie działania aplikacji — stąd nasłuch, a nie jednorazowy odczyt.
   * To jest domknięcie ryzyka „brak głosu TTS" z sekcji 14 (ADR-001).
   */
  const [voiceTick, setVoiceTick] = useState(0)
  /** Język wybrany do dodania, czekający na poziom wejściowy (sekcja 3.1). */
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => onVoicesChanged(() => setVoiceTick((n) => n + 1)), [])

  const refresh = useCallback(async () => {
    const now = Date.now()
    const langs = await addedLanguages()
    const loaded = await Promise.all(
      langs.map(async (settings) => {
        const meta = await loadMeta(settings.lang)
        const cards = await db.cards.where('lang').equals(settings.lang).toArray()
        const stage = currentStage(adapterFor(settings.lang), cards, meta, settings.stageOverride)
        return {
          settings,
          meta,
          stage,
          progress: stageProgress(cards, meta, stage),
          due: await dueCount(settings.lang, now),
          backlog: await backlogCount(settings.lang),
        }
      }),
    )
    setRows(loaded)
    setSelected(
      (current) => current ?? loaded.find((r) => r.settings.active)?.settings.lang ?? null,
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const change = useCallback(
    async (patch: Partial<Omit<LangSettings, 'lang'>>) => {
      if (!selected) return
      await updateSettings(selected, patch)
      await refresh()
    },
    [refresh, selected],
  )

  /** Krok pierwszy: pytamy o interferencję, potem o poziom wejściowy. */
  const beginAdd = useCallback(
    (code: string) => {
      const clash = interferesWith(code).find((other) =>
        rows?.some((r) => r.settings.lang === other),
      )
      if (clash) {
        // Sekcja 2.4: mówimy o interferencji raz, nie blokujemy.
        const other = adapterFor(clash).name
        const ok = window.confirm(
          `Uczysz się już ${other}. Te dwa języki mieszają się łatwiej niż inne — ` +
            'możesz dodać teraz albo odłożyć, aż tamten będzie w utrzymaniu. Dodać mimo to?',
        )
        if (!ok) return
      }
      setPending(code)
    },
    [rows],
  )

  /**
   * Krok drugi: poziom ustawia pasmo doboru i to, czy zaczynamy od pisma. Kalibracja
   * rusza od razu — jej sens jest w tym, żeby PIERWSZA sesja miała właściwy materiał,
   * więc odłożenie jej na później czyni ją bezużyteczną.
   */
  const addLanguage = useCallback(
    async (code: string, level: Level) => {
      const spec = levelById(level)
      await settingsFor(code)
      await updateSettings(code, {
        addedAt: Date.now(),
        level,
        bandFrom: spec.bandFrom,
        bandTo: spec.bandTo,
        ...(spec.skipScript ? { stageOverride: 'core' as const } : {}),
        calibrated: !spec.calibrate,
      })
      setPending(null)
      setSelected(code)
      if (spec.calibrate) navigate(`/kalibracja/${code}`)
      else await refresh()
    },
    [navigate, refresh],
  )

  if (!rows) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Mono tone="normal">wczytuję…</Mono>
      </div>
    )
  }

  const active = rows.filter((r) => r.settings.active)
  const maintained = rows.filter((r) => !r.settings.active)
  const chosen = rows.find((r) => r.settings.lang === selected) ?? null
  const missing = LANG_CODES.filter((code) => !rows.some((r) => r.settings.lang === code))
  // `voiceTick` jest tu po to, żeby odczyt powtórzył się po dosłaniu głosów.
  const voiceMissing =
    chosen !== null && voiceTick >= 0 && !hasVoice(adapterFor(chosen.settings.lang).tts.locale)
  const fresh = chosen && chosen.backlog >= BACKLOG_LIMIT
    ? 0
    : chosen
      ? INTENSITY[chosen.settings.intensity].fresh
      : 0

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col gap-8 bg-bg px-6
        pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+32px)]"
    >
      <Mark height={18} />

      {rows.length === 0 ? (
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-[30px] leading-[1.25] text-text">
            Czego chcesz się uczyć?
          </h1>
          <p className="font-ui text-[14px] leading-[1.6] text-text-2">
            Możesz dodać kolejny język później. Dwa aktywne naraz to rozsądny sufit.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {active.map((row) => {
                const isSelected = selected === row.settings.lang
                return (
                  <button
                    key={row.settings.lang}
                    type="button"
                    onClick={() => setSelected(row.settings.lang)}
                    aria-pressed={isSelected}
                    className={`nabu-press font-ui flex min-h-[44px] items-center gap-2 rounded-full
                      px-5 text-[15px] ${
                        isSelected
                          ? 'nabu-accent-fill'
                          : 'nabu-card text-text-2'
                      }`}
                  >
                    {adapterFor(row.settings.lang).name}
                    {row.due > 0 && (
                      <span className="font-mono text-[12px] opacity-80">{row.due}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {maintained.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <Mono>utrzymywane</Mono>
                {maintained.map((row) => (
                  <button
                    key={row.settings.lang}
                    type="button"
                    onClick={() => setSelected(row.settings.lang)}
                    aria-pressed={selected === row.settings.lang}
                    className="nabu-press font-ui rounded-full text-[13px] text-text-3"
                  >
                    {adapterFor(row.settings.lang).name} {row.due}
                  </button>
                ))}
              </div>
            )}
          </div>

          {chosen && (
            <div className="flex flex-col gap-6">
              <div className="nabu-card flex flex-col gap-5 px-6 py-7">
                <div className="flex items-end justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-[56px] leading-none text-text">
                      {chosen.due}
                    </span>
                    <span className="font-ui text-[14px] text-text-2">do powtórki</span>
                  </div>
                  {fresh > 0 && (
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[22px] leading-none text-accent">
                        +{fresh}
                      </span>
                      <span className="font-ui text-[13px] text-text-2">nowych</span>
                    </div>
                  )}
                </div>

                {chosen.backlog >= BACKLOG_LIMIT && (
                  <p className="font-ui text-[13px] leading-[1.6] text-text-2">
                    Czeka {chosen.backlog} rozpoczętych pozycji. Nie dokładamy kolejnych, dopóki
                    nie zejdziesz poniżej {BACKLOG_LIMIT} — inaczej zaległość rośnie szybciej,
                    niż da się ją nadrobić.
                  </p>
                )}

                <div className="flex flex-col gap-2 border-t border-border-quiet pt-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Mono tone="accent">etap · {STAGE_LABEL[chosen.stage]}</Mono>
                    {chosen.stage !== 'sentences' && (
                      <Mono tone="normal">
                        {chosen.progress.solid} / {chosen.progress.needed}
                      </Mono>
                    )}
                  </div>
                  <p className="font-ui text-[13px] leading-[1.5] text-text-2">
                    {STAGE_HINT[chosen.stage]}
                  </p>
                  {voiceMissing && (
                    <p className="font-ui text-[12.5px] leading-[1.5] text-text-3">
                      System nie ma głosu dla tego języka, więc karty ze słuchu są pomijane.
                      Na iPhonie: Ustawienia → Dostępność → Zawartość mówiona → Głosy.
                    </p>
                  )}
                </div>

                <Button
                  variant="primary"
                  full
                  disabled={chosen.due === 0 && fresh === 0}
                  onClick={() => {
                    // Pierwsze `speak()` musi wyjść z gestu użytkownika, inaczej iOS
                    // zignoruje wszystkie kolejne — po cichu (ADR-001).
                    primeSpeech()
                    navigate(`/sesja/${chosen.settings.lang}`)
                  }}
                >
                  Zacznij
                </Button>
              </div>

              <Choice
                label="sesja"
                value={chosen.settings.intensity}
                options={(['short', 'normal', 'long'] as const).map((level) => ({
                  value: level,
                  label: `${INTENSITY_LABEL[level]} · ${INTENSITY[level].due}`,
                }))}
                onChange={(intensity) => void change({ intensity })}
              />

              {/* Pełny ekran ustawień jest w M9. Tutaj są trzy rzeczy, które zmienia się
                  w trakcie nauki, a nie raz na zawsze — reszta może poczekać. */}
              <details className="group">
                <summary className="nabu-press flex cursor-pointer list-none items-center gap-2 py-2">
                  <Mono>ustawienia języka</Mono>
                  <span className="font-mono text-[11px] text-text-3 group-open:hidden">+</span>
                  <span className="font-mono hidden text-[11px] text-text-3 group-open:inline">
                    −
                  </span>
                </summary>

                <div className="mt-5 flex flex-col gap-6">
                  <Choice
                    label="opcji w quizie"
                    value={chosen.settings.quizOptions}
                    options={[
                      { value: 3, label: '3' },
                      { value: 4, label: '4' },
                      { value: 6, label: '6' },
                    ]}
                    onChange={(quizOptions) => void change({ quizOptions })}
                    hint="Więcej opcji to mniejsza szansa trafienia strzałem, ale dłuższe czytanie."
                  />

                  <Choice
                    label="po trafieniu"
                    value={chosen.settings.autoAdvance}
                    options={[
                      { value: false, label: 'czekaj' },
                      { value: true, label: 'dalej sam' },
                    ]}
                    onChange={(autoAdvance) => void change({ autoAdvance })}
                    hint="Po odpowiedzi widać poprawne słowo, czytanie i znaczenie. Pudło zawsze czeka na dotknięcie."
                  />

                  <Choice
                    label="produkcja"
                    value={chosen.settings.production}
                    options={[
                      { value: 'off' as const, label: 'wyłączona' },
                      { value: 'mature' as const, label: 'od dojrzałych' },
                      { value: 'always' as const, label: 'zawsze' },
                    ]}
                    onChange={(production) => void change({ production })}
                    hint="Karta dojrzała przestaje być quizem i prosi o odtworzenie słowa z pamięci."
                  />

                  <Choice
                    label="tempo mowy"
                    value={chosen.settings.rate}
                    options={[
                      { value: 0.45, label: 'wolno' },
                      { value: 0.6, label: 'normalnie' },
                      { value: 0.85, label: 'szybko' },
                    ]}
                    onChange={(rate) => void change({ rate })}
                    hint="Dotyczy czytania zdań i kart ze słuchu."
                  />

                  <Choice
                    label="etap"
                    value={chosen.settings.stageOverride ?? 'auto'}
                    options={[
                      { value: 'auto' as const, label: 'po kolei' },
                      ...gatedStages(adapterFor(chosen.settings.lang)).map((stage) => ({
                        value: stage,
                        label: STAGE_LABEL[stage],
                      })),
                    ]}
                    onChange={(value) =>
                      void change({ stageOverride: value === 'auto' ? null : value })
                    }
                    hint="Etapy nie blokują sztywno. Możesz przeskoczyć wcześniejsze, jeśli już je znasz."
                  />

                  <Choice
                    label="tryb"
                    value={chosen.settings.active}
                    options={[
                      { value: true, label: 'aktywny' },
                      { value: false, label: 'utrzymywany' },
                    ]}
                    onChange={(active) => void change({ active })}
                    hint="Utrzymywany nie dostaje nowych słów — tylko powtórki tego, co już umiesz."
                  />
                </div>
              </details>
            </div>
          )}
        </>
      )}

      {pending && (
        <div className="nabu-card flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col gap-1">
            <Mono tone="accent">{adapterFor(pending).name}</Mono>
            <p className="font-ui text-[14px] leading-[1.6] text-text-2">
              Od czego zaczynamy? Wybór ustawia pasmo częstości, a przy trzech ostatnich
              opcjach zapytamy jeszcze o dwadzieścia pięć słów, żeby trafić z materiałem
              od pierwszej sesji.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => void addLanguage(pending, level.id)}
                className="nabu-press nabu-card flex flex-col gap-1 px-5 py-4 text-start"
              >
                <span className="font-ui text-[15px] text-text">{level.label}</span>
                <span className="font-ui text-[12.5px] leading-[1.5] text-text-2">
                  {level.description}
                </span>
              </button>
            ))}
          </div>

          <Button variant="ghost" full onClick={() => setPending(null)}>
            anuluj
          </Button>
        </div>
      )}

      {missing.length > 0 && (
        <div className="flex flex-col gap-3 pt-2">
          <Mono>dodaj język</Mono>
          <div className="flex flex-wrap gap-2">
            {missing.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => beginAdd(code)}
                className="nabu-press nabu-card font-ui min-h-[44px] rounded-full px-5 text-[13px]
                  text-text-2"
              >
                {adapterFor(code).name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stopka: postęp i ustawienia w tym samym miejscu co narzędzia deweloperskie —
          test dźwięku z sekcji 11 wykonuje się na urządzeniu, więc musi być dostępny
          z telefonu, ale nic z tego nie zasługuje na pasek u góry. */}
      <nav className="mt-auto flex flex-wrap gap-5 pt-8">
        {chosen && (
          <Link to={`/postep/${chosen.settings.lang}`} className="nabu-press">
            <Mono tone="normal">postęp</Mono>
          </Link>
        )}
        <Link to="/ustawienia" className="nabu-press">
          <Mono tone="normal">ustawienia</Mono>
        </Link>
        <Link to="/demo">
          <Mono>demo</Mono>
        </Link>
        <Link to="/audio">
          <Mono>test dźwięku</Mono>
        </Link>
      </nav>
    </div>
  )
}
