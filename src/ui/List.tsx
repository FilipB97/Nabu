import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Mono } from './Mono'

/**
 * Lista pogrupowana — układ, w którym iOS trzyma ustawienia i który każdy zna z telefonu.
 *
 * Rzeczy pokrewne siedzą w jednej zaokrąglonej grupie, rozdzielone włosową linią,
 * z nagłówkiem nad grupą i wyjaśnieniem pod nią. Wyjaśnienie POD grupą, nie pod każdym
 * wierszem: inaczej ekran ustawień zamienia się w ścianę tekstu, przez którą trzeba
 * czytać, żeby cokolwiek znaleźć.
 *
 * Wiersz ma stałą wysokość 52 px i jedno miejsce na wartość po prawej. To jest cały
 * kontrakt — dzięki niemu piętnaście ustawień wygląda jak lista, a nie jak piętnaście
 * osobnych pomysłów.
 */

type GroupProps = {
  /** Nagłówek nad grupą, wersalikami. */
  label?: string
  /** Wyjaśnienie pod grupą. */
  hint?: ReactNode
  children: ReactNode
}

export function Group({ label, hint, children }: GroupProps) {
  return (
    <section className="flex flex-col gap-2">
      {label && <Mono className="px-1">{label}</Mono>}
      <div className="nabu-card overflow-hidden">
        {/* Linia rozdzielająca zaczyna się od tekstu, nie od krawędzi karty — inaczej
            grupa czyta się jak tabela, a ma się czytać jak jedna rzecz. */}
        <div className="divide-y divide-border-quiet [&>*]:px-5">{children}</div>
      </div>
      {hint && <p className="font-ui px-1 text-[12.5px] leading-[1.5] text-text-3">{hint}</p>}
    </section>
  )
}

type RowProps = {
  label: ReactNode
  /** Wartość po prawej: tekst, liczba albo kontrolka. */
  value?: ReactNode
  /** Wiersz prowadzący dalej — dostaje chevron i staje się linkiem. */
  to?: string
  onClick?: () => void
  /** Treść pod etykietą, gdy sama etykieta nie wystarcza. */
  description?: ReactNode
  /**
   * Chevron mówi „dalej, na inny ekran". Wiersz, który tylko coś WYBIERA — preset motywu,
   * pozycję z listy — nie prowadzi nigdzie i chevron w nim kłamie, więc da się go zdjąć.
   */
  chevron?: boolean
}

function Body({ label, value, description, chevron }: RowProps & { chevron: boolean }) {
  return (
    <>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="font-ui text-[15px] text-text">{label}</span>
        {description && (
          <span className="font-ui text-[12.5px] leading-[1.45] text-text-3">{description}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {value}
        {chevron && (
          <svg viewBox="0 0 12 20" className="h-[15px] w-[9px] text-text-3" aria-hidden>
            <path
              d="M2 1l8 9-8 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </>
  )
}

const ROW = 'flex min-h-[52px] w-full items-center justify-between gap-4 py-3 text-start'

export function Row(props: RowProps) {
  const chevron = props.chevron ?? true

  if (props.to) {
    return (
      <Link to={props.to} className={`nabu-press ${ROW}`}>
        <Body {...props} chevron={chevron} />
      </Link>
    )
  }

  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick} className={`nabu-press ${ROW}`}>
        <Body {...props} chevron={chevron} />
      </button>
    )
  }

  return (
    <div className={ROW}>
      <Body {...props} chevron={false} />
    </div>
  )
}
