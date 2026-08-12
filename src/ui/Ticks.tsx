/**
 * Pasek równo rozłożonych znaczników.
 *
 * Jeden rysunek w kilku skalach — sekcja 0 i 9 planu. Ten sam komponent jest paskiem
 * postępu sesji, wykresem prognozy powtórek, licznikiem opanowanych znaków i znakiem
 * marki. Nie chcemy trzech różnych rozwiązań tego samego problemu wizualnego.
 *
 * Pudła są znaczone kolorem akcentu, nie czerwienią: w tej aplikacji nie ma koloru
 * błędu (sekcja 9.1).
 */

type TicksProps = {
  /** Ile segmentów w sumie — zwykle liczba kart w sesji. */
  total: number
  /** Ile już za nami. Segment o tym indeksie jest bieżący. */
  done: number
  /** Indeksy kart, na których było pudło. */
  lapses?: readonly number[]
  /** Wysokość segmentu w px. 13 w sesji, mniej przy licznikach znaków. */
  height?: number
  className?: string
  /** Opis dla czytnika ekranu. Bez niego pasek jest niemy. */
  label?: string
}

export function Ticks({ total, done, lapses = [], height = 13, className, label }: TicksProps) {
  const missed = new Set(lapses)

  return (
    <div
      className={`flex w-full items-end gap-[3px] ${className ?? ''}`}
      role="img"
      aria-label={label ?? `${done} z ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const color =
          i === done
            ? 'bg-tick-current'
            : i < done
              ? missed.has(i)
                ? 'bg-accent'
                : 'bg-tick-done'
              : 'bg-tick-future'

        return (
          <div
            key={i}
            className={`min-w-0 flex-1 rounded-[1px] ${color}`}
            style={{ height: `${height}px` }}
          />
        )
      })}
    </div>
  )
}

type BarsProps = {
  /** Wartości słupków. Pierwszy jest wyróżniony akcentem — to „dziś". */
  values: readonly number[]
  /** Wysokość najwyższego słupka w px. */
  height?: number
  className?: string
  label?: string
}

/** Prognoza powtórek — ten sam motyw, inna skala. */
export function Bars({ values, height = 56, className, label }: BarsProps) {
  const max = Math.max(...values, 1)

  return (
    <div
      className={`flex w-full items-end gap-[3px] ${className ?? ''}`}
      role="img"
      aria-label={label ?? 'prognoza powtórek'}
    >
      {values.map((value, i) => (
        <div
          key={i}
          className={`min-w-0 flex-1 rounded-[1px] ${i === 0 ? 'bg-accent' : 'bg-tick-done'}`}
          style={{
            height: `${Math.max(2, Math.round((height * value) / max))}px`,
          }}
        />
      ))}
    </div>
  )
}
