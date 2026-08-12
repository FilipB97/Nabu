import type { LangAdapter } from './types'
import { es } from './es'
import { pt } from './pt'
import { sv } from './sv'
import { ko } from './ko'
import { ja } from './ja'

/**
 * Rejestr adapterów — jedyne miejsce, które zna komplet obsługiwanych języków.
 *
 * Kolejność jest kolejnością na ekranie wyboru języka (sekcja 8.1): najpierw klasa A,
 * potem języki z obcym pismem. To nie jest przypadek — trzy pierwsze kosztują razem
 * mniej niż jeden japoński i dają natychmiastowy dowód, że rdzeń jest neutralny.
 */
const ADAPTERS = [es, pt, sv, ko, ja] as const

export const LANGS: Record<string, LangAdapter> = Object.fromEntries(
  ADAPTERS.map((adapter) => [adapter.code, adapter]),
)

export const LANG_CODES: string[] = ADAPTERS.map((adapter) => adapter.code)

export function adapterFor(code: string): LangAdapter {
  const adapter = LANGS[code]
  if (!adapter) throw new Error(`Nieznany język: ${code}`)
  return adapter
}

/**
 * Pary języków na tyle bliskich, że interferencja przy równoległej nauce jest realna.
 * Nie blokujemy — mówimy o tym raz i proponujemy rozdzielenie w czasie (sekcja 2.4).
 */
export const INTERFERING_PAIRS: ReadonlyArray<readonly [string, string]> = [[es.code, pt.code]]

export function interferesWith(code: string): string[] {
  return INTERFERING_PAIRS.flatMap(([a, b]) => (a === code ? [b] : b === code ? [a] : []))
}

// Eksport po nazwie, żeby reszta aplikacji mogła sięgnąć po konkretny adapter
// bez wpisywania kodu języka jako literału (patrz reguła ESLint).
export { es, pt, sv, ko, ja }

export type { LangAdapter } from './types'
export { stagesFor } from './types'
