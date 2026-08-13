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

  it.each(LANG_CODES)('%s: etap 0 tłumaczy pismo, a nie tylko o nie pyta', (code) => {
    const adapter = adapterFor(code)
    if (!adapter.hasScriptStage) return

    // Bez tych dwóch pól pierwsze spotkanie ze znakiem jest wyborem jednej z czterech
    // rzeczy, których żadnej użytkownik nie widział — czyli losowaniem. Adapter z etapem
    // 0 musi umieć powiedzieć, jak działa jego pismo i skąd bierze się czytanie znaku.
    expect(adapter.scriptAbout?.trim().length ?? 0, `${code}: brak opisu pisma`).toBeGreaterThan(80)
    expect(adapter.scriptNote, `${code}: brak wyjaśnienia pojedynczego znaku`).toBeDefined()

    for (const item of adapter.scriptItems?.() ?? []) {
      const note = adapter.scriptNote?.(item) ?? ''
      expect(note.length, `${code}: znak ${item.s} bez wyjaśnienia`).toBeGreaterThan(40)
      expect(note, `${code}: wyjaśnienie znaku ${item.s} nie mówi o jego czytaniu`).toContain(item.r)
    }
  })

  it.each(LANG_CODES)('%s: każdy znak ma zaczep pamięciowy', (code) => {
    const adapter = adapterFor(code)
    if (!adapter.hasScriptStage) return

    expect(adapter.scriptMnemonic, `${code}: brak zaczepów pamięciowych`).toBeDefined()
    for (const item of adapter.scriptItems?.() ?? []) {
      const hint = adapter.scriptMnemonic?.(item) ?? ''
      expect(hint.length, `${code}: znak ${item.s} bez zaczepu`).toBeGreaterThan(15)
    }
  })

  it.each(LANG_CODES)('%s: porcje pokrywają inwentarz w tej samej kolejności', (code) => {
    const adapter = adapterFor(code)
    if (!adapter.hasScriptStage) return

    const items = adapter.scriptItems?.() ?? []
    const batches = adapter.scriptBatches?.() ?? []
    expect(batches.length, `${code}: brak porcji wprowadzania`).toBeGreaterThan(0)

    // Kolejność musi się zgadzać co do znaku: identyfikatory pozycji w talii są indeksami
    // `scriptItems()`, więc porcja przestawiająca znaki przestawiłaby znaczenie kart,
    // które użytkownik ma już w bazie.
    expect(batches.flatMap((batch) => batch.items.map((item) => item.s))).toEqual(
      items.map((item) => item.s),
    )

    for (const batch of batches) {
      expect(batch.items.length, `${code}: pusta porcja ${batch.id}`).toBeGreaterThan(0)
      expect(batch.items.length, `${code}: porcja ${batch.id} za duża na jedno posiedzenie`)
        .toBeLessThanOrEqual(6)
      expect(batch.label.trim().length, `${code}: porcja ${batch.id} bez nazwy`).toBeGreaterThan(0)
      expect(batch.note.length, `${code}: porcja ${batch.id} bez wyjaśnienia`).toBeGreaterThan(40)
    }

    expect(new Set(batches.map((batch) => batch.id)).size).toBe(batches.length)
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
