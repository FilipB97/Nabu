import { Mono } from './Mono'

/**
 * Wybór jednej wartości z kilku — powtarzający się element ustawień (sekcja 8.5).
 *
 * Nie jest to `<select>`: opcji są zawsze dwie do czterech, a lista rozwijana na telefonie
 * kosztuje dwa dotknięcia i przykrywa ekran systemowym arkuszem. Rząd podkreślonych etykiet
 * pokazuje przy okazji, jakie są możliwości, zanim użytkownik czegokolwiek dotknie.
 */

type ChoiceProps<T extends string | number | boolean> = {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  /** Zdanie wyjaśniające, gdy sama etykieta nie wystarcza. */
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
    <div className="flex flex-col gap-2">
      <Mono>{label}</Mono>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={`nabu-press font-ui flex min-h-[40px] items-center rounded-full px-4
              text-[13px] transition-colors duration-150 ${
                option.value === value
                  ? 'bg-surface-2 text-accent'
                  : 'text-text-2 hover:text-text'
              }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint && <p className="font-ui text-[12.5px] leading-[1.5] text-text-3">{hint}</p>}
    </div>
  )
}
