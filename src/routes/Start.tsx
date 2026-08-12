import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { LANG_CODES, adapterFor, interferesWith } from '@/langs'
import {
  BACKLOG_LIMIT,
  INTENSITY,
  addedLanguages,
  backlogCount,
  dueCount,
  settingsFor,
  updateSettings,
  type LangSettings,
} from '@/store/db'
import { Mark } from '@/ui/Ticks'
import { Mono } from '@/ui/Mono'

/**
 * Ekran startu sesji — sekcja 8.3 planu.
 *
 * Ma odpowiadać na trzy pytania w jednym spojrzeniu: ile jest do zrobienia, ile to
 * potrwa, co się dzieje dalej. Przełącznik języka jest na wierzchu, nie w ustawieniach,
 * a języki aktywne są oddzielone od utrzymywanych (sekcja 2.4).
 */

type Row = { settings: LangSettings; due: number; backlog: number }

const INTENSITY_LABEL: Record<LangSettings['intensity'], string> = {
  short: 'krótka',
  normal: 'normalna',
  long: 'długa',
}

export function Start() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const now = Date.now()
    const langs = await addedLanguages()
    const loaded = await Promise.all(
      langs.map(async (settings) => ({
        settings,
        due: await dueCount(settings.lang, now),
        backlog: await backlogCount(settings.lang),
      })),
    )
    setRows(loaded)
    setSelected(
      (current) => current ?? loaded.find((r) => r.settings.active)?.settings.lang ?? null,
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addLanguage = useCallback(
    async (code: string) => {
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
      await settingsFor(code)
      await updateSettings(code, { addedAt: Date.now() })
      await refresh()
      setSelected(code)
    },
    [refresh, rows],
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-8 bg-bg px-6 py-10">
      <Mark height={18} />

      {rows.length === 0 ? (
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-[26px] leading-[1.3] text-text">
            Czego chcesz się uczyć?
          </h1>
          <p className="font-ui text-[14px] leading-[1.6] text-text-2">
            Możesz dodać kolejny język później. Dwa aktywne naraz to rozsądny sufit.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <Mono>aktywne</Mono>
            <div className="flex flex-wrap gap-3">
              {active.map((row) => (
                <button
                  key={row.settings.lang}
                  type="button"
                  onClick={() => setSelected(row.settings.lang)}
                  aria-pressed={selected === row.settings.lang}
                  className={`font-display border-b pb-1 text-[20px] ${
                    selected === row.settings.lang
                      ? 'border-accent text-text'
                      : 'border-transparent text-text-3'
                  }`}
                >
                  {adapterFor(row.settings.lang).name}
                  {row.due > 0 && (
                    <span className="font-mono ms-2 text-[12px] text-text-2">{row.due}</span>
                  )}
                </button>
              ))}
            </div>

            {maintained.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Mono>utrzymywane</Mono>
                {maintained.map((row) => (
                  <button
                    key={row.settings.lang}
                    type="button"
                    onClick={() => setSelected(row.settings.lang)}
                    className="font-ui text-[13px] text-text-3"
                  >
                    {adapterFor(row.settings.lang).name} {row.due}
                  </button>
                ))}
              </div>
            )}
          </div>

          {chosen && (
            <div className="flex flex-col gap-6 border-t border-border-quiet pt-8">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[44px] leading-none text-text">
                    {chosen.due}
                  </span>
                  <span className="font-ui text-[14px] text-text-2">do powtórki</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[22px] leading-none text-accent">
                    +{' '}
                    {chosen.backlog >= BACKLOG_LIMIT
                      ? 0
                      : INTENSITY[chosen.settings.intensity].fresh}
                  </span>
                  <span className="font-ui text-[14px] text-text-2">nowych</span>
                </div>
              </div>

              {chosen.backlog >= BACKLOG_LIMIT && (
                <p className="font-ui text-[13px] leading-[1.6] text-text-2">
                  Czeka {chosen.backlog} rozpoczętych pozycji. Nie dokładamy kolejnych, dopóki nie
                  zejdziesz poniżej {BACKLOG_LIMIT} — inaczej zaległość rośnie szybciej, niż da się
                  ją nadrobić.
                </p>
              )}

              <button
                type="button"
                onClick={() => navigate(`/sesja/${chosen.settings.lang}`)}
                disabled={chosen.due === 0 && chosen.backlog >= BACKLOG_LIMIT}
                className="min-h-[62px] border border-border text-[17px] text-text disabled:text-text-3"
              >
                Zacznij
              </button>

              <div className="flex gap-5">
                {(['short', 'normal', 'long'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={async () => {
                      await updateSettings(chosen.settings.lang, { intensity: level })
                      await refresh()
                    }}
                    className={`font-ui border-b pb-1 text-[13px] ${
                      chosen.settings.intensity === level
                        ? 'border-accent text-accent'
                        : 'border-transparent text-text-2'
                    }`}
                  >
                    {INTENSITY_LABEL[level]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {missing.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border-quiet pt-6">
          <Mono>dodaj język</Mono>
          <div className="flex flex-wrap gap-3">
            {missing.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => void addLanguage(code)}
                className="font-ui border border-border-quiet px-4 py-2 text-[13px] text-text-2"
              >
                {adapterFor(code).name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
