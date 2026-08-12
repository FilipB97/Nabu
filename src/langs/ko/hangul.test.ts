import { describe, expect, it } from 'vitest'
import { compose, decompose, isSyllable, toJamoSequence } from './hangul'

/**
 * Ta arytmetyka obsługuje dwie rzeczy naraz — klawiaturę jamo i dobór dystraktorów —
 * więc jej błąd objawiłby się w dwóch odległych miejscach. Stąd testy mimo prostoty kodu.
 */

describe('rozkład i złożenie sylab', () => {
  it('rozkłada 물 na ㅁ + ㅜ + ㄹ', () => {
    expect(decompose('물')).toEqual({ initial: 6, medial: 13, final: 8 })
  })

  it('rozkłada sylabę bez wygłosu', () => {
    expect(decompose('무')).toEqual({ initial: 6, medial: 13, final: 0 })
  })

  it('składa z powrotem parę z makiety: 물 / 불 / 말', () => {
    expect(compose({ initial: 6, medial: 13, final: 8 })).toBe('물')
    expect(compose({ initial: 7, medial: 13, final: 8 })).toBe('불')
    expect(compose({ initial: 6, medial: 0, final: 8 })).toBe('말')
  })

  it('składanie jest odwrotnością rozkładu dla całego bloku sylab', () => {
    for (let code = 0xac00; code < 0xac00 + 11172; code += 37) {
      const syllable = String.fromCodePoint(code)
      expect(compose(decompose(syllable)!)).toBe(syllable)
    }
  })

  it('odrzuca znaki spoza bloku sylab', () => {
    expect(decompose('a')).toBeNull()
    expect(decompose('水')).toBeNull()
    expect(decompose(' ')).toBeNull()
    expect(isSyllable('ㄱ')).toBe(false)
  })

  it('pilnuje zakresów przy składaniu', () => {
    expect(() => compose({ initial: 19, medial: 0, final: 0 })).toThrow(RangeError)
    expect(() => compose({ initial: 0, medial: 21, final: 0 })).toThrow(RangeError)
    expect(() => compose({ initial: 0, medial: 0, final: 28 })).toThrow(RangeError)
  })
})

describe('ciąg jamo', () => {
  it('para różniąca się nagłosem daje ciągi o odległości 1', () => {
    const mul = toJamoSequence('물')
    const bul = toJamoSequence('불')
    expect(mul).toHaveLength(3)
    expect(bul).toHaveLength(3)
    expect(mul.filter((j, i) => j !== bul[i])).toHaveLength(1)
  })

  it('przepuszcza spacje i interpunkcję bez zmian', () => {
    expect(toJamoSequence('물 좀')).toContain(' ')
    expect(toJamoSequence('물.').at(-1)).toBe('.')
  })
})
