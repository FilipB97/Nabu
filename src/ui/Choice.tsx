/**
 * Przełącznik segmentowy — wybór jednej wartości z dwóch do czterech.
 *
 * Kontrolka jest iOS-owa nie z sentymentu, tylko dlatego, że rozwiązuje konkretny problem:
 * pokazuje WSZYSTKIE możliwości naraz i to, która jest wybrana, w jednym elemencie
 * i bez otwierania czegokolwiek. Lista rozwijana kosztuje dwa dotknięcia i przykrywa
 * ekran systemowym arkuszem; rząd luźnych przycisków nie mówi, że wykluczają się wzajemnie.
 *
 * Zaznaczenie jest wypełnieniem, nie samym kolorem tekstu: przy trzech poziomach tekstu
 * na ciemnym tle różnice jasności są małe, a kształt widać zawsze.
 */

type ChoiceProps<T extends string | number | boolean> = {
  label?: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  /** Opis pod kontrolką, gdy sama etykieta nie wystarcza. */
  hint?: string
}

export function Choice<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
  hint,
}: ChoiceProps<T>) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div
        className="flex w-full gap-[3px] rounded-[12px] bg-bg p-[3px]"
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`font-ui min-h-[36px] min-w-0 flex-1 rounded-[9px] px-2 text-[13px]
                transition-colors duration-150 ${
                  selected ? 'nabu-card-raised text-accent' : 'text-text-2'
                }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {hint && <p className="font-ui text-[12.5px] leading-[1.5] text-text-3">{hint}</p>}
    </div>
  )
}
