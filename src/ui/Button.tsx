import type { ReactNode } from 'react'

/**
 * Przycisk — trzy wagi, nie trzy wyglądy.
 *
 * `primary` niesie wypełnienie akcentem i jest na ekranie jeden. `quiet` to karta:
 * ta sama głębia co reszta materiału, bez barwy. `ghost` nie ma tła w ogóle i służy
 * czynnościom, które nie są celem ekranu — wyjściu, zmianie ustawienia.
 *
 * Minimalna wysokość 56 px wszędzie: dolna trzecia ekranu to strefa kciuka (sekcja 8.4),
 * a karta w sesji jest dotykana setki razy dziennie.
 */

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'quiet' | 'ghost'
  disabled?: boolean
  /** Rozciąga przycisk na całą szerokość rodzica. */
  full?: boolean
  autoFocus?: boolean
  ariaLabel?: string
  className?: string
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'nabu-accent-fill rounded-[16px] text-[16px]',
  quiet: 'nabu-card text-text text-[15px]',
  ghost: 'text-text-2 text-[14px] rounded-[14px]',
}

export function Button({
  children,
  onClick,
  variant = 'quiet',
  disabled = false,
  full = false,
  autoFocus = false,
  ariaLabel,
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      className={`nabu-press font-ui flex min-h-[56px] items-center justify-center px-6
        ${full ? 'w-full' : ''} ${VARIANT[variant]}
        ${disabled ? 'pointer-events-none opacity-45' : 'cursor-pointer'} ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
