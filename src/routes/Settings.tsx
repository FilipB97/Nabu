import { Link } from 'react-router'
import { MODES, PRESETS, PRESETS_IDS, useTheme } from '@/theme/ThemeProvider'
import { paletteOf, type Mode } from '@/theme/presets'
import { Choice } from '@/ui/Choice'
import { Mono } from '@/ui/Mono'

/**
 * Ustawienia globalne — sekcja 8.5 planu, M9.
 *
 * Jest tu wyłącznie to, co nie należy do żadnego języka: motyw. Ustawienia sesji,
 * etapu, produkcji i mowy są per język i siedzą na ekranie startu, przy języku,
 * którego dotyczą — przeniesienie ich tutaj zmusiłoby użytkownika do wybierania
 * języka dwa razy.
 *
 * Preset pokazujemy JEGO WŁASNYMI kolorami, nie nazwą. Nazwa („Mech", „Piasek")
 * nie mówi nic, dopóki nie zobaczy się rampy — a rampa jest całą treścią wyboru.
 */

const MODE_LABEL: Record<Mode, string> = {
  dark: 'ciemny',
  light: 'jasny',
  system: 'systemowy',
}

export function Settings() {
  const { preset, mode, variant, setPreset, setMode } = useTheme()

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col gap-8 bg-bg px-6
        pt-[calc(env(safe-area-inset-top)+28px)] pb-[calc(env(safe-area-inset-bottom)+32px)]"
    >
      <div className="flex items-center justify-between gap-3">
        <Link to="/start" className="nabu-press -m-3 rounded-full p-3">
          <Mono tone="normal">← wróć</Mono>
        </Link>
        <Mono>ustawienia</Mono>
      </div>

      <Choice
        label="tryb"
        value={mode}
        options={MODES.map((id) => ({ value: id, label: MODE_LABEL[id] }))}
        onChange={setMode}
        hint="Systemowy idzie za ustawieniem telefonu i zmienia się razem z nim."
      />

      <div className="flex flex-col gap-3">
        <Mono>motyw</Mono>
        <div className="flex flex-col gap-2">
          {PRESETS_IDS.map((id) => {
            // Próbkę rysujemy w wariancie AKTUALNIE widocznym — inaczej użytkownik
            // w trybie jasnym wybierałby spośród ciemnych rampek.
            const palette = paletteOf(id, variant)
            const selected = id === preset
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPreset(id)}
                aria-pressed={selected}
                className={`nabu-press nabu-card flex items-center gap-4 px-5 py-4 text-start
                  ${selected ? 'nabu-card-raised' : ''}`}
              >
                <span className="flex shrink-0 gap-1" aria-hidden>
                  {(['bg', 'surface-2', 'text-2', 'accent'] as const).map((token) => (
                    <span
                      key={token}
                      className="h-7 w-5 rounded-[4px]"
                      // Jedyne miejsce w aplikacji z kolorem w atrybucie `style`:
                      // próbka MUSI pokazywać paletę, której użytkownik jeszcze nie wybrał,
                      // więc nie może brać koloru z aktywnych zmiennych CSS.
                      style={{ background: palette[token] }}
                    />
                  ))}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span
                    className={`font-ui text-[15px] ${selected ? 'text-accent' : 'text-text'}`}
                  >
                    {PRESETS[id].name}
                  </span>
                  <span className="font-ui text-[12.5px] leading-[1.5] text-text-2">
                    {PRESETS[id].description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="font-ui text-[12.5px] leading-[1.5] text-text-3">
          Każdy motyw przechodzi w CI test kontrastu WCAG AA — w obu wariantach, na każdej
          parze tekstu i tła. Motyw, który łamie kontrast, nie wchodzi do aplikacji.
        </p>
      </div>
    </div>
  )
}
