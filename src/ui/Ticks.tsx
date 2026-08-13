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

type ProgressProps = {
  total: number
  done: number
  /** Indeksy kart, na których było pudło. */
  lapses?: readonly number[]
  className?: string
  label?: string
}

/**
 * Postęp sesji jako ciągła linia.
 *
 * Wersja segmentowa (`Ticks`) rozpadała się przy dłuższych sesjach: pięćdziesiąt kart
 * to pięćdziesiąt kresek po dwa piksele, czyli szum zamiast informacji. Linia znosi
 * dowolną długość, a pudła są na niej nacięciami w kolorze tła — nadal widoczne,
 * nadal na swoich miejscach.
 *
 * Znaczniki zostają tam, gdzie mają sens: znak marki i liczniki opanowanych znaków.
 */
export function Progress({ total, done, lapses = [], className, label }: ProgressProps) {
  const filled = total > 0 ? Math.min(1, done / total) : 0

  return (
    <div
      className={`relative h-[5px] w-full overflow-hidden rounded-full bg-tick-future ${className ?? ''}`}
      role="img"
      aria-label={label ?? `${done} z ${total}`}
    >
      <div
        className="nabu-accent-fill h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${filled * 100}%` }}
      />
      {lapses.map((index) => (
        <span
          key={index}
          className="absolute top-0 h-full w-[2px] bg-bg"
          style={{ left: `${((index + 0.5) / Math.max(1, total)) * 100}%` }}
        />
      ))}
    </div>
  )
}

type BarsProps = {
  /** Wartości słupków. Pierwszy jest wyróżniony akcentem — to „dziś". */
  values: readonly number[]
  /** Podpisy pod słupkami, po jednym na wartość. Bez nich oś nie mówi, o które dni chodzi. */
  labels?: readonly string[]
  /** Wysokość najwyższego słupka w px. */
  height?: number
  className?: string
  label?: string
}

/** Prognoza powtórek — ten sam motyw, inna skala. */
export function Bars({ values, labels, height = 64, className, label }: BarsProps) {
  const max = Math.max(...values, 1)

  return (
    <div
      className={`flex w-full items-end gap-[6px] ${className ?? ''}`}
      role="img"
      aria-label={label ?? 'prognoza powtórek'}
    >
      {values.map((value, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          {/* Słupek rośnie od dołu, więc kolumna musi mieć stałą wysokość — inaczej dni
              bez powtórek podnosiłyby podpisy wyżej niż dni z powtórkami. */}
          <div className="flex w-full items-end" style={{ height: `${height}px` }}>
            <div
              className={`w-full rounded-[3px] ${i === 0 ? 'bg-accent' : 'bg-tick-future'}`}
              style={{ height: `${Math.max(2, Math.round((height * value) / max))}px` }}
            />
          </div>
          {labels?.[i] && (
            <span className="font-mono text-[10px] leading-none text-text-3">{labels[i]}</span>
          )}
        </div>
      ))}
    </div>
  )
}

type MarkProps = {
  /** Wysokość kresek w px. 22 w nagłówku, mniej w pasku bocznym. */
  height?: number
  className?: string
}

/**
 * Znak marki — ten sam motyw równo rozłożonych znaczników, ale bez znaczenia
 * „postępu": pierwsza kreska w akcencie, dwie kolejne wygaszone.
 *
 * Osobny komponent, a nie `Ticks` z wymuszonymi wartościami, bo `done` i `lapses`
 * opisują stan sesji. Sygnatura marki nie ma stanu, więc każde ich ustawienie tutaj
 * byłoby kłamstwem — i widać to od razu: `Ticks total=3 done=0` daje białą kreskę
 * bieżącej karty i dwie prawie niewidoczne kreski przyszłych.
 */
export function Mark({ height = 22, className }: MarkProps) {
  return (
    <div className={`flex items-end gap-[5px] ${className ?? ''}`} role="img" aria-label="Nabu">
      {['bg-accent', 'bg-tick-done', 'bg-tick-done'].map((color, i) => (
        <div key={i} className={`w-1 rounded-[1px] ${color}`} style={{ height: `${height}px` }} />
      ))}
    </div>
  )
}
