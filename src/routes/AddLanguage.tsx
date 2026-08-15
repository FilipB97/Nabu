import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { LANG_CODES, adapterFor, interferesWith } from '@/langs'
import { useLangs } from '@/app/lang'
import { LEVELS, levelById, type Level } from '@/session/calibration'
import { loadMeta } from '@/store/decks'
import { settingsFor, updateSettings } from '@/store/db'
import { Button } from '@/ui/Button'
import { Mono } from '@/ui/Mono'

/**
 * Dodawanie języka — sekcja 8.1 planu, po redesignie.
 *
 * Dwa kroki, każdy o jednym pytaniu: **czego** i **od czego**. Wcześniej oba były
 * wciśnięte w dół ekranu startu, a ostrzeżenie o interferencji wychodziło systemowym
 * `window.confirm` — czyli oknem, które wygląda jak błąd przeglądarki i którego jedyną
 * sensowną odpowiedzią wydaje się „anuluj".
 *
 * Teraz ostrzeżenie jest wierszem w karcie: mówi to samo, ale niczego nie blokuje
 * i nie udaje awarii. Sekcja 2.4 planu wprost tego chce — o interferencji mówimy raz
 * i zostawiamy decyzję użytkownikowi.
 *
 * Kafel pokazuje liczbę zdań w talii, bo to jedyna liczba, która różni języki między
 * sobą przed rozpoczęciem nauki. Gdy talii nie da się odpytać (pierwsze wejście bez
 * sieci), kafel po prostu jej nie pokazuje — brak liczby nie może blokować wyboru.
 */

/** Ile zdań ma talia. `null` znaczy „jeszcze nie wiem", `0` — „nie udało się sprawdzić". */
type Sizes = Record<string, number>

export function AddLanguage() {
  const navigate = useNavigate()
  const { rows, select, refresh } = useLangs()
  const [pending, setPending] = useState<string | null>(null)
  const [sizes, setSizes] = useState<Sizes>({})

  const added = new Set((rows ?? []).map((row) => row.settings.lang))
  const missing = LANG_CODES.filter((code) => !added.has(code))

  // `meta.json` waży kilkaset bajtów, więc odpytanie wszystkich talii naraz jest tańsze
  // niż jedno zdanie z paczki — a `loadMeta` i tak trzyma je w pamięci podręcznej.
  // Błąd pojedynczego języka nie może wywrócić siatki, stąd zero zamiast wyjątku.
  useEffect(() => {
    let cancelled = false
    void Promise.all(
      LANG_CODES.map(async (code) => {
        try {
          return [code, (await loadMeta(code)).sentences] as const
        } catch {
          return [code, 0] as const
        }
      }),
    ).then((entries) => {
      if (!cancelled) setSizes(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Poziom ustawia pasmo doboru i to, czy zaczynamy od pisma. Kalibracja rusza od razu —
   * jej sens jest w tym, żeby PIERWSZA sesja miała właściwy materiał, więc odłożenie
   * jej na później czyni ją bezużyteczną.
   */
  async function add(code: string, level: Level) {
    const spec = levelById(level)
    await settingsFor(code)
    await updateSettings(code, {
      addedAt: Date.now(),
      level,
      bandFrom: spec.bandFrom,
      bandTo: spec.bandTo,
      // Poziom mówi, OD CZEGO zaczynamy — nie przypina etapu. Różnica jest istotna:
      // przypięcie zostaje na zawsze i to przez nie „Zaawansowany" siedział w kółko
      // na stu najczęstszych słowach.
      startStage: spec.startStage,
      // Poziom decyduje też o tym, CZY odpowiadasz z pamięci. Dla konta zaawansowanego
      // wybór jednej z czterech opcji jest testem zbyt łatwym, żeby czegokolwiek uczyć.
      production: spec.production,
      calibrated: !spec.calibrate,
    })
    select(code)
    await refresh()
    navigate(spec.calibrate ? `/kalibracja/${code}` : '/start', { replace: true })
  }

  if (pending) {
    const adapter = adapterFor(pending)
    const clash = interferesWith(pending).find((other) => added.has(other))

    return (
      <div className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-2">
          <Mono tone="accent">krok 2 z 2</Mono>
          <h1 className="font-display text-[clamp(28px,5vw,38px)] leading-none text-text">
            {adapter.name}
          </h1>
        </div>

        <section className="nabu-card flex flex-col gap-5 px-[clamp(20px,4vw,28px)] py-[clamp(20px,4vw,26px)]">
          <p className="font-ui max-w-[560px] text-[14.5px] leading-[1.6] text-text-2">
            Od czego zaczynamy? Wybór ustawia pasmo częstości, z którego dobieramy nowe
            słowa. Przy trzech ostatnich opcjach zapytamy jeszcze o dwadzieścia pięć słów,
            żeby trafić z materiałem od pierwszej sesji.
          </p>

          {clash && (
            // Sekcja 2.4: mówimy o interferencji raz i nie blokujemy. Wiersz w karcie,
            // nie `window.confirm` — okno systemowe wygląda jak awaria i wymusza decyzję
            // w momencie, w którym użytkownik nie ma jeszcze z czego jej podjąć.
            <div className="flex flex-col gap-1 rounded-[14px] border border-wrong-border bg-wrong-bg px-4 py-3">
              <Mono tone="normal">uwaga</Mono>
              <p className="font-ui text-[13px] leading-[1.55] text-wrong-text">
                Uczysz się już {adapterFor(clash).name}. Te dwa języki mieszają się łatwiej
                niż inne — możesz dodać teraz albo poczekać, aż tamten przejdzie w tryb
                utrzymania.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-[10px]">
            {LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => void add(pending, level.id)}
                className="nabu-press flex flex-col gap-1 rounded-[14px] border border-border
                  bg-surface-2 px-5 py-4 text-start"
              >
                <span className="font-ui text-[15px] text-text">{level.label}</span>
                <span className="font-ui text-[12.5px] leading-[1.5] text-text-2">
                  {level.description}
                </span>
              </button>
            ))}
          </div>

          <Button variant="ghost" onClick={() => setPending(null)}>
            anuluj
          </Button>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[clamp(28px,6vw,44px)] leading-[1.15] text-text">
          {added.size === 0 ? 'Czego chcesz się uczyć?' : 'Dodaj język'}
        </h1>
        <p className="font-ui max-w-[560px] text-[15.5px] leading-[1.6] text-text-2">
          Dwa aktywne języki naraz to rozsądny sufit — pięć to sto kart dziennie
          i porzucenie aplikacji w drugim tygodniu. Kolejny można dodać w każdej chwili.
        </p>
      </div>

      {missing.length === 0 ? (
        <p className="font-ui text-[14px] leading-[1.6] text-text-2">
          Wszystkie dostępne języki są już dodane. Kolejne dochodzą razem z taliami.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-[14px] md:grid-cols-3">
          {missing.map((code) => {
            const adapter = adapterFor(code)
            const sentences = sizes[code]
            return (
              <button
                key={code}
                type="button"
                onClick={() => setPending(code)}
                className="nabu-press nabu-card flex flex-col items-start gap-2 px-5 py-5 text-start"
              >
                <span className="font-display text-[19px] leading-none text-text">
                  {adapter.name}
                </span>
                <span className="flex flex-col gap-1">
                  {sentences ? (
                    <Mono>{sentences.toLocaleString('pl-PL')} zdań</Mono>
                  ) : (
                    <Mono>talia w komplecie</Mono>
                  )}
                  {adapter.hasScriptStage && <Mono tone="normal">z nauką pisma</Mono>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
