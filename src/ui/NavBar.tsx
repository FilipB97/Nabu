import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Mono } from './Mono'

/**
 * Pasek nawigacji — jeden układ na wszystkich ekranach poza sesją.
 *
 * Wzorzec jest iOS-owy, bo tam się sprawdził i bo użytkownik zna go z każdej innej
 * aplikacji na telefonie: **chevron wstecz po lewej, tytuł na środku, akcja po prawej**.
 * Wcześniej każdy ekran wracał inaczej — raz „← WYJDŹ" wersalikami, raz „← wróć",
 * a z sesji nie dało się wrócić wcale.
 *
 * Chevron, a nie strzałka: strzałka mówi „przesuń", chevron mówi „poziom wyżej".
 * Etykieta obok niego jest opcjonalna i domyślnie pusta — na wąskim ekranie tytuł
 * jest ważniejszy niż nazwa miejsca, do którego wracamy.
 */

type NavBarProps = {
  title?: ReactNode
  /** Dokąd wraca chevron. Bez tego cofamy się w historii. */
  back?: string
  backLabel?: string
  /** Akcja po prawej — zwykle jedna, cicha. */
  action?: ReactNode
}

export function NavBar({ title, back, backLabel, action }: NavBarProps) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[44px] items-center justify-between gap-2 px-1">
      <button
        type="button"
        onClick={() => (back ? navigate(back) : navigate(-1))}
        aria-label={backLabel ? `Wróć: ${backLabel}` : 'Wróć'}
        className="nabu-press flex min-h-[44px] min-w-[44px] items-center gap-1 pe-2 text-accent"
      >
        {/* Chevron rysowany, nie znakiem: znak `‹` ma w każdym kroju inną grubość
            i inne światło, a ten element powtarza się na każdym ekranie. */}
        <svg viewBox="0 0 12 20" className="h-[18px] w-[11px]" aria-hidden focusable="false">
          <path
            d="M10 1 2 10l8 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {backLabel && <span className="font-ui text-[15px]">{backLabel}</span>}
      </button>

      {title && <Mono tone="normal">{title}</Mono>}

      <div className="flex min-h-[44px] min-w-[44px] items-center justify-end">{action}</div>
    </div>
  )
}
