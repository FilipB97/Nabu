import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESET, paletteOf } from './presets'
import { TOKENS, cssVar } from './tokens'

/**
 * `src/index.css` powtarza domyślną paletę w bloku `:root`, żeby pierwsza klatka
 * przed uruchomieniem JavaScriptu nie była bezbarwna. To jedyne dozwolone powtórzenie
 * wartości w projekcie — i dlatego wymaga pilnowania. Bez tego testu zmiana presetu
 * Atrament w `presets.ts` cicho rozjeżdża się z CSS-em i widać to dopiero na urządzeniu.
 */

const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')

function rootBlock(): string {
  const match = /:root\s*\{([^}]*)\}/.exec(css)
  if (!match) throw new Error('Nie znaleziono bloku :root w src/index.css')
  return match[1]!
}

describe('wartości startowe w index.css', () => {
  const block = rootBlock()
  const expected = paletteOf(DEFAULT_PRESET, 'dark')

  it.each(TOKENS)('%s zgadza się z domyślnym presetem', (token) => {
    const declaration = new RegExp(`${cssVar(token)}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(block)
    expect(declaration, `Brak ${cssVar(token)} w bloku :root`).not.toBeNull()
    expect(declaration![1]!.toLowerCase()).toBe(expected[token].toLowerCase())
  })

  it('nie ma tokenów spoza kontraktu', () => {
    const declared = [...block.matchAll(/(--nabu-[\w-]+)\s*:/g)].map((m) => m[1]!)
    const known = TOKENS.map(cssVar)
    expect(declared.sort()).toEqual([...known].sort())
  })

  it('każdy token kontraktu ma alias w bloku @theme', () => {
    const themeBlock = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    for (const token of TOKENS) {
      expect(themeBlock, `Brak aliasu Tailwinda dla ${cssVar(token)}`).toContain(
        `--color-${token}: var(${cssVar(token)});`,
      )
    }
  })
})
