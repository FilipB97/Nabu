import type { LangAdapter } from './types.ts'
import { en } from './en/index.ts'
import { de } from './de/index.ts'
import { es } from './es/index.ts'
import { pt } from './pt/index.ts'
import { sv } from './sv/index.ts'
import { ko } from './ko/index.ts'
import { ja } from './ja/index.ts'
import { zh } from './zh/index.ts'
import { ar } from './ar/index.ts'

/**
 * Rejestr adapterów — jedyne miejsce, które zna komplet obsługiwanych języków.
 *
 * Kolejność jest kolejnością na ekranie wyboru języka (sekcja 8.1): najpierw klasa A,
 * potem języki z obcym pismem. To nie jest przypadek — trzy pierwsze kosztują razem
 * mniej niż jeden japoński i dają natychmiastowy dowód, że rdzeń jest neutralny.
 */
const ADAPTERS = [en, de, es, pt, sv, ko, ja, zh, ar] as const

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
export const INTERFERING_PAIRS: ReadonlyArray<readonly [string, string]> = [
  [es.code, pt.code],
  // Niemiecki i szwedzki: wspólny rdzeń germański daje setki par bliskich formą
  // i znaczeniem (`Haus` / `hus`, `trinken` / `dricka`), a różnice są na tyle drobne,
  // że przy równoległej nauce mieszają się w obie strony.
  [de.code, sv.code],
]

export function interferesWith(code: string): string[] {
  return INTERFERING_PAIRS.flatMap(([a, b]) => (a === code ? [b] : b === code ? [a] : []))
}

// Eksport po nazwie, żeby reszta aplikacji mogła sięgnąć po konkretny adapter
// bez wpisywania kodu języka jako literału (patrz reguła ESLint).
export { en, de, es, pt, sv, ko, ja, zh, ar }

export type { LangAdapter, ProductionMode, ScriptBatch, ScriptItem, Stage } from './types.ts'
export { stagesFor } from './types.ts'
