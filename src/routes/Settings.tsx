import { MODES, PRESETS, PRESETS_IDS, useTheme } from '@/theme/ThemeProvider'
import { paletteOf, type Mode } from '@/theme/presets'
import { Choice } from '@/ui/Choice'
import { Group, Row } from '@/ui/List'
import { NavBar } from '@/ui/NavBar'

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
      className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col gap-7 bg-bg px-5
        pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+32px)]"
    >
      <NavBar title="ustawienia" back="/start" backLabel="Start" />

      <Group
        label="wygląd"
        hint="Systemowy idzie za ustawieniem telefonu i zmienia się razem z nim."
      >
        <div className="flex flex-col gap-3 py-4">
          <span className="font-ui text-[15px] text-text">Tryb</span>
          <Choice
            label="tryb"
            value={mode}
            options={MODES.map((id) => ({ value: id, label: MODE_LABEL[id] }))}
            onChange={setMode}
          />
        </div>
      </Group>

      <Group
        label="motyw"
        hint="Każdy motyw przechodzi w CI test kontrastu WCAG AA — w obu wariantach, na każdej
          parze tekstu i tła. Motyw, który łamie kontrast, nie wchodzi do aplikacji."
      >
        {PRESETS_IDS.map((id) => {
          // Próbkę rysujemy w wariancie AKTUALNIE widocznym — inaczej użytkownik
          // w trybie jasnym wybierałby spośród ciemnych rampek.
          const palette = paletteOf(id, variant)
          const selected = id === preset
          return (
            <Row
              key={id}
              onClick={() => setPreset(id)}
              label={
                <span className={selected ? 'text-accent' : undefined}>{PRESETS[id].name}</span>
              }
              description={PRESETS[id].description}
              value={
                <span className="flex shrink-0 gap-1" aria-hidden>
                  {(['bg', 'surface-2', 'text-2', 'accent'] as const).map((token) => (
                    <span
                      key={token}
                      className="h-7 w-[18px] rounded-[5px]"
                      // Jedyne miejsce w aplikacji z kolorem w atrybucie `style`: próbka MUSI
                      // pokazywać paletę, której użytkownik jeszcze nie wybrał, więc nie może
                      // brać koloru z aktywnych zmiennych CSS.
                      style={{ background: palette[token] }}
                    />
                  ))}
                </span>
              }
            />
          )
        })}
      </Group>
    </div>
  )
}
