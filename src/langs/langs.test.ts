import { describe, expect, it } from 'vitest'
import { LANGS, LANG_CODES, adapterFor, stagesFor } from './index.ts'

/**
 * Kontrakt adapterów — sekcja 2.1 planu.
 *
 * Rdzeń zakłada, że każdy adapter jest kompletny. Adapter niekompletny nie wywali się
 * przy starcie, tylko przy pierwszej karcie danego typu — czyli u użytkownika, a nie
 * w CI. Te asercje są po to, żeby wywalił się tutaj.
 */

describe('kontrakt adapterów', () => {
  it.each(LANG_CODES)('%s: etap 0 istnieje dokładnie wtedy, gdy jest inwentarz pisma', (code) => {
    const adapter = adapterFor(code)
    expect(
      adapter.scriptItems !== undefined,
      `${code}: hasScriptStage=${adapter.hasScriptStage}, a scriptItems ` +
        `${adapter.scriptItems ? 'jest' : 'brakuje'}. Etap 0 bez inwentarza to pusta sesja.`,
    ).toBe(adapter.hasScriptStage)
  })

  it.each(LANG_CODES)('%s: inwentarz pisma ma unikalne znaki i niepuste czytania', (code) => {
    const items = adapterFor(code).scriptItems?.() ?? []
    if (items.length === 0) return

    expect(new Set(items.map((item) => item.s)).size).toBe(items.length)
    for (const item of items) {
      expect(item.r.trim().length, `${code}: znak ${item.s} bez czytania`).toBeGreaterThan(0)
      expect(item.group.trim().length, `${code}: znak ${item.s} bez grupy`).toBeGreaterThan(0)
    }
  })

  it.each(LANG_CODES)('%s: każda pozycja etapu 0 ma dość kandydatów na opcje', (code) => {
    const adapter = adapterFor(code)
    const items = adapter.scriptItems?.() ?? []
    if (items.length === 0) return

    // Grupa jest preferencją, nie warunkiem: `ん` jest w kanie jedyną sylabą nosową,
    // więc jego kolumna ma jednego mieszkańca i dystraktory dobiorą się spoza niej.
    // Warunkiem koniecznym jest to, żeby w ogóle było z czego wybierać — inaczej
    // pozycja spada na kartę `reveal` z samooceną, czyli na etapie 0 na nic.
    const needed = adapter.quiz.minOptions - 1
    for (const item of items) {
      const others = items.filter((other) => other.r !== item.r).length
      expect(others, `${code}: znak ${item.s} ma ${others} kandydatów`).toBeGreaterThanOrEqual(
        needed,
      )
    }
  })

  it('etapy zaczynają się od pisma tylko tam, gdzie pismo jest obce', () => {
    for (const adapter of Object.values(LANGS)) {
      expect(stagesFor(adapter)[0]).toBe(adapter.hasScriptStage ? 'script' : 'core')
    }
  })
})
