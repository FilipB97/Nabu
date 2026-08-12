import type { LangAdapter } from '@/langs'

/**
 * Klawiatura w aplikacji — sekcja 7.2 planu.
 *
 * Komponent nie zna żadnego pisma: dostaje rzędy klawiszy z adaptera i oddaje naciśnięcia.
 * Składanie liter w tekst też należy do adaptera, bo hangul składa się arytmetycznie,
 * a kana doklejeniem znaku dźwięczności — to są dwie różne operacje na tym samym
 * zdarzeniu „naciśnięto klawisz".
 */

type KeyboardProps = {
  rows: NonNullable<LangAdapter['keyboard']>['rows']
  onKey: (key: string) => void
  onBackspace: () => void
  /** Krój pisma docelowego — klawisze mają wyglądać tak, jak wygląda odpowiedź. */
  font: LangAdapter['display']['font']
}

const FONT_CLASS: Record<LangAdapter['display']['font'], string> = {
  ui: 'font-ui',
  display: 'font-display',
  ja: 'font-ja',
  ko: 'font-ko',
}

export function Keyboard({ rows, onKey, onBackspace, font }: KeyboardProps) {
  return (
    <div className="flex flex-col gap-[6px]">
      {rows.map((row, index) => (
        <div key={index} className="flex justify-center gap-[6px]">
          {row.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onKey(key)}
              // Klawisz musi znieść dziesięć pozycji w rzędzie na ekranie 360 px,
              // więc szerokość jest elastyczna, a wysokość stała i w zasięgu kciuka.
              className={`nabu-press nabu-card ${FONT_CLASS[font]} min-h-[46px] min-w-0 flex-1
                rounded-[10px] px-1 text-[19px] text-text`}
            >
              {key}
            </button>
          ))}
        </div>
      ))}

      <button
        type="button"
        onClick={onBackspace}
        aria-label="Skasuj ostatni znak"
        className="nabu-press nabu-card font-mono mt-1 min-h-[46px] rounded-[10px] text-[15px]
          text-text-2"
      >
        ←
      </button>
    </div>
  )
}
