import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { adapterFor } from '@/langs'
import { useLangs } from './lang'
import { Mono } from '@/ui/Mono'

/**
 * Powłoka aplikacji — jeden układ dla wszystkich ekranów.
 *
 * Przed redesignem każdy ekran rysował własny nagłówek i wracał inaczej, a aplikacja
 * na desktopie była tą samą kolumną 460 px co na telefonie. Teraz są dwa układy:
 *
 * - **szyna boczna** od 920 px: marka wraca na główny, lista języków, trzy sekcje,
 *   stopka ze stanem. Wszystko widoczne naraz, bo miejsce na to jest;
 * - **pasek u góry i zakładki na dole** poniżej 920 px: ten sam zestaw, ale rozłożony
 *   tak, żeby kciuk sięgał do nawigacji, a treść miała całą wysokość ekranu.
 *
 * Sesja i onboarding nie mają zakładek. Sesja ma jedno zadanie i nic nie może odciągać
 * od słowa na środku (sekcja 9 planu), a onboarding prowadzi krok po kroku — zakładka
 * w połowie tej ścieżki jest zaproszeniem do zgubienia się.
 */

/** Próg układu. Ta sama wartość co w referencji projektowej. */
const WIDE = 920

export function useWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(`(min-width: ${WIDE}px)`).matches,
  )

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const query = matchMedia(`(min-width: ${WIDE}px)`)
    const update = () => setWide(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return wide
}

/** Znak marki: trzy paski o różnej wysokości, pierwszy w akcencie. */
export function Mark({ height = 22 }: { height?: number }) {
  return (
    <span className="flex items-end gap-[5px]" aria-hidden>
      {[
        ['bg-accent', height],
        ['bg-tick-done', Math.round(height * 0.6)],
        ['bg-tick-done', Math.round(height * 0.78)],
      ].map(([color, h], i) => (
        <span key={i} className={`w-1 rounded-[1px] ${color}`} style={{ height: `${h}px` }} />
      ))}
    </span>
  )
}

type Section = 'nauka' | 'postep' | 'ustawienia'

const SECTIONS: ReadonlyArray<{ id: Section; label: string; href: (lang: string | null) => string }> =
  [
    { id: 'nauka', label: 'Nauka', href: () => '/start' },
    { id: 'postep', label: 'Postęp', href: (lang) => (lang ? `/postep/${lang}` : '/start') },
    { id: 'ustawienia', label: 'Ustawienia', href: () => '/ustawienia' },
  ]

/**
 * Która sekcja jest aktywna. „Nauka" obejmuje wszystko, co dzieje się po drodze do karty:
 * sesję, podsumowanie, kalibrację i dodawanie języka — inaczej zakładka gasłaby w środku
 * przepływu i wyglądało, jakby użytkownik wypadł z aplikacji.
 */
function sectionOf(pathname: string): Section {
  if (pathname.startsWith('/postep')) return 'postep'
  if (pathname.startsWith('/ustawienia')) return 'ustawienia'
  return 'nauka'
}

/** Ekrany prowadzone krok po kroku: bez zakładek, z jednym wyjściem. */
function isFocused(pathname: string): boolean {
  return pathname.startsWith('/sesja/') || pathname.startsWith('/kalibracja/')
}

/**
 * Ekrany, na których wracamy tam, gdzie użytkownik był, a nie na górę.
 *
 * Wejście w ustawienia z połowy listy i powrót na sam początek ekranu kasuje kontekst,
 * którego szukało się przez chwilę — a przy liście talii czy prognozy ten kontekst jest
 * całą treścią. Sesji i kalibracji tu nie ma: one zawsze zaczynają od pierwszej karty.
 */
const REMEMBERED = ['/start', '/postep', '/ustawienia', '/dodaj']

/**
 * Pamięć pozycji przewijania per ekran.
 *
 * Trzymana w pamięci, nie w `sessionStorage`: chodzi o powrót w obrębie jednej sesji
 * pracy, a nie o odtwarzanie stanu po przeładowaniu — tam użytkownik i tak spodziewa
 * się początku. Zapis idzie przy każdym przewinięciu, więc nie zależy od tego, którą
 * drogą ekran został opuszczony (chevron, zakładka, przycisk wstecz przeglądarki).
 */
function useScrollMemory(pathname: string) {
  const positions = useRef(new Map<string, number>())
  const at = useRef(pathname)

  useEffect(() => {
    const save = () => positions.current.set(at.current, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [])

  useLayoutEffect(() => {
    at.current = pathname
    const remembered = REMEMBERED.some((prefix) => pathname.startsWith(prefix))
    const target = remembered ? (positions.current.get(pathname) ?? 0) : 0

    if (target === 0) {
      window.scrollTo(0, 0)
      return
    }

    // Treść bywa doładowywana po pierwszym renderze (talia, statystyki), a do pozycji
    // 800 px nie da się przewinąć strony, która ma na razie 400. Stąd kilka prób przez
    // kolejne klatki zamiast jednego skoku — z twardym limitem, żeby nie kręcić się
    // w nieskończoność na ekranie, który po prostu jest krótszy niż był.
    let frames = 0
    let raf = 0
    const settle = () => {
      window.scrollTo(0, target)
      if (Math.abs(window.scrollY - target) < 2 || frames++ > 20) return
      raf = requestAnimationFrame(settle)
    }
    settle()
    return () => cancelAnimationFrame(raf)
  }, [pathname])
}

/**
 * Tytuł ekranu w pasku mobilnym. Krótki i rzeczownikowy — pasek ma powiedzieć, gdzie
 * jesteśmy, a nie opowiedzieć, co się tu robi.
 */
function titleOf(pathname: string): string {
  if (pathname.startsWith('/postep')) return 'postęp'
  if (pathname.startsWith('/ustawienia')) return 'ustawienia'
  if (pathname.startsWith('/dodaj')) return 'dodaj język'
  if (pathname.startsWith('/koniec')) return 'sesja zakończona'
  if (pathname.startsWith('/audio')) return 'test dźwięku'
  if (pathname.startsWith('/mowa')) return 'sonda mowy'
  if (pathname.startsWith('/demo')) return 'demo'
  return 'nauka'
}

/**
 * Pasek górny telefonu. Chevron cofa o poziom, znak marki po prawej wraca na główny —
 * dwa różne ruchy, więc dwa osobne elementy. Na ekranie głównym chevron nie ma dokąd
 * cofać, więc jego miejsce zajmuje marka.
 */
function TopBar({ pathname }: { pathname: string }) {
  const navigate = useNavigate()
  const root = pathname.startsWith('/start')

  return (
    <header
      className="sticky top-0 z-10 flex min-h-[52px] items-center justify-between gap-2
        border-b border-border-quiet bg-surface/95 px-3
        pt-[env(safe-area-inset-top)] backdrop-blur-[10px]"
    >
      {root ? (
        <span className="flex min-w-[64px] items-center gap-2 ps-2">
          <Mark height={16} />
          <span className="font-display text-[17px] text-text">Nabu</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="nabu-press font-ui flex min-h-[44px] min-w-[64px] items-center gap-1 px-2
            text-[15px] text-accent"
        >
          {/* Chevron rysowany, nie znakiem: znak `‹` ma w każdym kroju inną grubość. */}
          <svg viewBox="0 0 12 20" className="h-[16px] w-[10px]" aria-hidden focusable="false">
            <path
              d="M10 1 2 10l8 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          wstecz
        </button>
      )}

      <Mono tone="normal">{titleOf(pathname)}</Mono>

      <span className="flex min-w-[64px] justify-end">
        {!root && (
          <Link
            to="/start"
            aria-label="Ekran główny"
            className="nabu-press flex min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <Mark height={16} />
          </Link>
        )}
      </span>
    </header>
  )
}

function LanguageRail() {
  const { rows, selected, select } = useLangs()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-2">
      <Mono>języki</Mono>
      {(rows ?? []).map((row) => {
        const active = row.settings.lang === selected
        return (
          <button
            key={row.settings.lang}
            type="button"
            onClick={() => {
              select(row.settings.lang)
              navigate('/start')
            }}
            aria-pressed={active}
            className={`nabu-press font-ui flex min-h-[42px] items-center justify-between gap-3
              rounded-[12px] border px-[13px] text-[14.5px] ${
                active
                  ? 'border-border bg-surface-2 text-text'
                  : 'border-border-quiet text-text-2'
              }`}
          >
            {adapterFor(row.settings.lang).name}
            <span className={`font-mono text-[12px] ${active ? 'text-accent' : 'text-text-3'}`}>
              {row.due}
            </span>
          </button>
        )
      })}
      <Link
        to="/dodaj"
        className="nabu-press font-ui flex min-h-[42px] items-center rounded-[12px] border
          border-dashed border-border-quiet px-[13px] text-[14.5px] text-text-3"
      >
        + dodaj język
      </Link>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const wide = useWide()
  const { pathname } = useLocation()
  const { selected } = useLangs()
  const section = sectionOf(pathname)
  const focused = isFocused(pathname)
  useScrollMemory(pathname)

  if (wide) {
    return (
      <div className="flex min-h-screen bg-bg">
        <nav
          className="sticky top-0 flex h-screen w-[256px] shrink-0 flex-col gap-[30px]
            border-e border-border-quiet bg-surface px-5 py-[26px]"
        >
          <Link to="/start" className="nabu-press flex items-center gap-3">
            <Mark height={22} />
            <span className="font-display text-[23px] text-text">Nabu</span>
          </Link>

          <LanguageRail />

          <div className="flex flex-col gap-1">
            {SECTIONS.map((item) => {
              const active = item.id === section
              return (
                <Link
                  key={item.id}
                  to={item.href(selected)}
                  className={`nabu-press font-ui flex min-h-[42px] items-center gap-3 rounded-[12px]
                    px-[13px] text-[14.5px] ${active ? 'bg-surface-2 text-text' : 'text-text-2'}`}
                >
                  <span
                    className={`h-[6px] w-[6px] rounded-full ${active ? 'bg-accent' : 'bg-tick-future'}`}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="mt-auto flex flex-col gap-1">
            <Mono>zapisane lokalnie</Mono>
            <Mono>offline</Mono>
          </div>
        </nav>

        <main className="flex min-w-0 flex-1 justify-center px-10 pt-[38px] pb-11">
          <div className={`w-full ${focused ? 'max-w-[880px]' : 'max-w-[1020px]'}`}>{children}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Sesja i kalibracja rysują własny nagłówek: jest w nim licznik kart i wyjście,
          a dwa paski jeden nad drugim zabrałyby ekranowi karty jedną trzecią wysokości. */}
      {!focused && <TopBar pathname={pathname} />}

      <main
        className={`flex flex-1 flex-col px-5 pb-6 ${
          focused ? 'pt-[calc(env(safe-area-inset-top)+12px)]' : 'pt-5'
        }`}
      >
        {children}
      </main>

      {!focused && (
        <nav
          className="sticky bottom-0 flex border-t border-border-quiet bg-surface
            pb-[env(safe-area-inset-bottom)]"
        >
          {SECTIONS.map((item) => {
            const active = item.id === section
            return (
              <Link
                key={item.id}
                to={item.href(selected)}
                aria-current={active ? 'page' : undefined}
                className={`nabu-press font-ui flex min-h-[52px] flex-1 items-center justify-center
                  gap-2 text-[13px] ${active ? 'bg-surface-2 text-text' : 'text-text-2'}`}
              >
                <span
                  className={`h-[6px] w-[6px] rounded-full ${active ? 'bg-accent' : 'bg-tick-future'}`}
                  aria-hidden
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
