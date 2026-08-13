/**
 * Kontrakt tokenów motywu — sekcja 9.1 planu.
 *
 * To jest jedyne miejsce w aplikacji, które zna pojęcie koloru. Komponenty sięgają
 * po `var(--nabu-*)` przez klasy Tailwinda, nigdy po wartość heksową (pilnuje tego
 * reguła ESLint). Preset to inna rampa neutralna i inna barwa akcentu — nic więcej.
 *
 * Dołożenie tokenu jest zmianą kontraktu: trzeba go dopisać do WSZYSTKICH presetów
 * naraz i nadać mu rolę poniżej, inaczej test kontrastu go nie sprawdzi.
 */

export const TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'text',
  'text-2',
  'text-3',
  'border',
  'border-quiet',
  'accent',
  'accent-2',
  'accent-deep',
  'accent-text',
  'shadow',
  'tick-done',
  'tick-future',
  'tick-current',
  'wrong-border',
  'wrong-bg',
  'wrong-text',
] as const

export type Token = (typeof TOKENS)[number]

/** Paleta jednego wariantu (jasnego albo ciemnego) jednego presetu. */
export type Palette = Record<Token, string>

/**
 * Role tokenów, z których test kontrastu wyprowadza wymagane proporcje.
 *
 * - `background` — powierzchnia, na której coś stoi; sama nie jest sprawdzana
 * - `text` — niesie treść, wymaga 4.5:1 (WCAG 2.2 AA, 1.4.3)
 * - `ui` — granica albo wskaźnik stanu, wymaga 3:1 (1.4.11)
 * - `decorative` — nie niesie informacji, nie jest sprawdzany
 *
 * `on` mówi, na jakich powierzchniach token faktycznie występuje w interfejsie.
 * Sprawdzamy każdą parę, a nie tylko tę oczywistą — `--accent` na `--surface`
 * (trafiona opcja quizu) to inny kontrast niż `--accent` na `--bg`.
 */
export const ROLES: Record<
  Token,
  { role: 'background' | 'text' | 'ui' | 'decorative'; on?: Token[] }
> = {
  bg: { role: 'background' },
  surface: { role: 'background' },
  'surface-2': { role: 'background' },

  // Wypełnienie akcentem jest powierzchnią jak każda inna: przycisk główny ma na sobie
  // tekst i oba krańce gradientu muszą go unieść, nie tylko ten, na który akurat padnie
  // środek. Dlatego `accent` i `accent-2` są tu ROLI `background`, a nie tylko `text` —
  // token bywa jednym i drugim, zależnie od miejsca.
  'accent-2': { role: 'background' },
  /** Ciemniejszy kraniec paska postępu i obrys trafionej opcji. */
  'accent-deep': { role: 'background' },
  /** Tło opcji wybranej błędnie — ledwie ciepłe, bez czerwieni. */
  'wrong-bg': { role: 'background' },

  text: { role: 'text', on: ['bg', 'surface', 'surface-2'] },
  'text-2': { role: 'text', on: ['bg', 'surface', 'surface-2'] },
  'text-3': { role: 'text', on: ['bg'] },
  accent: { role: 'text', on: ['bg', 'surface', 'surface-2'] },
  'accent-text': { role: 'text', on: ['accent', 'accent-2', 'accent-deep'] },
  'wrong-text': { role: 'text', on: ['bg', 'surface', 'wrong-bg'] },

  'tick-done': { role: 'ui', on: ['bg'] },
  'tick-current': { role: 'ui', on: ['bg'] },

  // Pasek postępu czyta się jako całość: „zrobione / bieżąca / przed nami". Segment
  // przyszły jest tłem tego paska, a nie wskaźnikiem stanu — informację niosą dwa
  // pozostałe. Ta sama logika dotyczy cichej linii działowej.
  'tick-future': { role: 'decorative' },
  'border-quiet': { role: 'decorative' },

  // Obrysy opcji quizu są dekoracyjne, mimo że otaczają element interaktywny.
  // WCAG 1.4.11 wymaga 3:1 od „informacji wizualnej potrzebnej do rozpoznania
  // komponentu i jego stanu" — a tutaj żadna informacja nie jest niesiona wyłącznie
  // przez obrys. Opcje rozdziela odstęp i każda zawiera duży znak w kolorze o kontraście
  // 15:1; stan po odpowiedzi niosą znaki `✓` i `×`, kolor tekstu (akcent, 7.35:1)
  // oraz wypełnienie tła. Usunięcie obrysów nie odebrałoby użytkownikowi niczego
  // poza wykończeniem. Decyzja i jej granice: docs/ADR-002-motywy.md.
  border: { role: 'decorative' },
  'wrong-border': { role: 'decorative' },

  // Cień nie niesie informacji — powtarza to, co mówi już wypełnienie i odstęp.
  // Występuje wyłącznie z przezroczystością, więc jego kontrast wobec tła nie jest
  // wielkością, którą dałoby się sensownie zmierzyć.
  shadow: { role: 'decorative' },
}

/** Wymagana proporcja kontrastu dla roli. Zwraca 0, gdy roli nie sprawdzamy. */
export function requiredRatio(token: Token): number {
  const { role } = ROLES[token]
  if (role === 'text') return 4.5
  if (role === 'ui') return 3
  return 0
}

/** Nazwa zmiennej CSS pod tokenem. Jedyne miejsce, które ustala ten prefiks. */
export function cssVar(token: Token): string {
  return `--nabu-${token}`
}
