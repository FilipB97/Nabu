import { describe, expect, it } from 'vitest'
import { contrastRatio, parseHex, round2 } from './contrast'
import { PRESETS_IDS, VARIANTS, paletteOf } from './presets'
import { ROLES, TOKENS, requiredRatio, type Token } from './tokens'

/**
 * Bramka jakości z sekcji 9.1 planu.
 *
 * Preset łamiący AA nie wchodzi do repo. To jest tańsze i pewniejsze niż oglądanie
 * kolorów okiem, a brief i tak wymaga AA na wszystkim, łącznie z tekstem pomocniczym.
 *
 * Dwa tokeny są celowo poza sprawdzeniem — `border-quiet` i `tick-future`. Powód
 * i granice tej decyzji: `docs/ADR-002-motywy.md`. Ich proporcje i tak są wypisywane
 * w audycie na końcu pliku, żeby nie zniknęły z oczu.
 */

const SURFACES = ['bg', 'surface'] as const satisfies readonly Token[]

describe('kontrakt tokenów', () => {
  it.each(PRESETS_IDS)('preset %s ma komplet tokenów w obu wariantach', (preset) => {
    for (const variant of VARIANTS) {
      const palette = paletteOf(preset, variant)
      expect(Object.keys(palette).sort()).toEqual([...TOKENS].sort())
    }
  })

  it.each(PRESETS_IDS)('preset %s ma same poprawne wartości heksowe', (preset) => {
    for (const variant of VARIANTS) {
      const palette = paletteOf(preset, variant)
      for (const token of TOKENS) expect(() => parseHex(palette[token])).not.toThrow()
    }
  })

  it('każdy token ma przypisaną rolę', () => {
    expect(Object.keys(ROLES).sort()).toEqual([...TOKENS].sort())
  })
})

describe('kontrast AA', () => {
  const cases = PRESETS_IDS.flatMap((preset) =>
    VARIANTS.flatMap((variant) => {
      const palette = paletteOf(preset, variant)
      return TOKENS.flatMap((token) => {
        const required = requiredRatio(token)
        if (required === 0) return []
        return (ROLES[token].on ?? ['bg']).map((surface) => ({
          preset,
          variant,
          token,
          surface,
          required,
          ratio: contrastRatio(palette[token], palette[surface]),
        }))
      })
    }),
  )

  it('polityka obejmuje każdą powierzchnię, na której token występuje', () => {
    for (const token of TOKENS) {
      for (const surface of ROLES[token].on ?? []) {
        expect(SURFACES).toContain(surface)
      }
    }
  })

  it('sprawdzamy niepustą listę par', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  it.each(cases)(
    '$preset/$variant: $token na $surface >= $required:1',
    ({ token, surface, required, ratio, preset, variant }) => {
      expect(
        round2(ratio),
        `${preset}/${variant}: --nabu-${token} na --nabu-${surface} daje ${round2(ratio)}:1, ` +
          `a rola „${ROLES[token].role}" wymaga ${required}:1. ` +
          'Popraw wartość w presets.ts — nie próg w tokens.ts.',
      ).toBeGreaterThanOrEqual(required)
    },
  )
})

describe('audyt tokenów dekoracyjnych', () => {
  /**
   * Nie jest to asercja na próg — te tokeny świadomie go nie mają. Chodzi o to, żeby
   * ich proporcje były widoczne przy każdym przebiegu, a nie ukryte za decyzją sprzed
   * pół roku. Jeśli któraś zjedzie poniżej 1.2:1, element przestaje być widoczny
   * w ogóle i wtedy to już nie jest wybór estetyczny.
   */
  const decorative = TOKENS.filter((t) => ROLES[t].role === 'decorative')

  it.each(PRESETS_IDS)('preset %s: tokeny dekoracyjne pozostają widoczne', (preset) => {
    for (const variant of VARIANTS) {
      const palette = paletteOf(preset, variant)
      for (const token of decorative) {
        const ratio = contrastRatio(palette[token], palette.bg)
        expect(
          round2(ratio),
          `${preset}/${variant}: --nabu-${token} na tle daje ${round2(ratio)}:1 — ` +
            'element zlewa się z tłem całkowicie.',
        ).toBeGreaterThanOrEqual(1.2)
      }
    }
  })
})
