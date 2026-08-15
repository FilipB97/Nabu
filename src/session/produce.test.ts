import { describe, expect, it } from 'vitest'
import { en, es, ja, ko } from '@/langs'
import { composeJamo } from '@/langs/ko/keyboard'
import { composeKana, DAKUTEN, HANDAKUTEN } from '@/langs/ja/keyboard'
import { newCard, type CardState } from '@/srs/types'
import type { DeckItem } from '@/store/decks'
import { checkProduction, productionFor } from './produce.ts'

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0)

function item(surface: string, gloss: string, reading?: string): DeckItem {
  return {
    id: 'x',
    text: surface,
    tokens: [{ s: surface, b: 100, gloss, ...(reading ? { r: reading } : {}) }],
    pl: 'zdanie po polsku',
    src: 'direct',
    band: 100,
    cloze: 0,
    distractors: [],
    quiz: true,
  }
}

const mature = (over: Partial<CardState> = {}): CardState => ({
  ...newCard('x', 'es', 'sentences', NOW),
  interval: 30,
  reps: 6,
  ...over,
})

describe('kiedy karta wchodzi w produkcję', () => {
  it('dopiero po dojrzeniu — sekcja 6.4', () => {
    const young = { ...mature(), interval: 5 }
    expect(productionFor(es, young, item('casa', 'dom'), 'mature')).toBeNull()
    expect(productionFor(es, mature(), item('casa', 'dom'), 'mature')?.mode).toBe('type')
  })

  it('ustawienie „zawsze" nie czeka na dojrzałość', () => {
    const young = { ...mature(), interval: 0 }
    expect(productionFor(es, young, item('casa', 'dom'), 'always')?.mode).toBe('type')
  })

  it('ustawienie „wyłączona" wyłącza produkcję zupełnie', () => {
    expect(productionFor(es, mature(), item('casa', 'dom'), 'off')).toBeNull()
  })

  it('koreański pisze jamo, nie klawiaturą systemową', () => {
    const production = productionFor(ko, mature(), item('물', 'woda'), 'mature')
    expect(production?.mode).toBe('jamo')
    expect(production?.expected).toBe('물')
  })

  it('japoński bez czytania nie ma czego produkować i zostaje quizem', () => {
    // `draw` czeka na dane o kreskach, `kana` wymaga czytania — bez obu karta jest quizem.
    expect(productionFor(ja, mature(), item('水', 'woda'), 'mature')).toBeNull()
  })

  it('japoński z czytaniem prosi o czytanie, nie o zapis', () => {
    const production = productionFor(ja, mature(), item('水', 'woda', 'みず'), 'mature')
    expect(production?.mode).toBe('kana')
    expect(production?.expected).toBe('みず')
    expect(production?.prompt).toBe('水')
  })
})

describe('ocena wpisanej odpowiedzi', () => {
  it('zgadza się co do znaku', () => {
    expect(checkProduction('casa', 'casa')).toEqual({ correct: true, nearMiss: false })
  })

  it('wielkość liter i spacje nie są pomyłką', () => {
    expect(checkProduction('  Casa ', 'casa').correct).toBe(true)
  })

  it('sam brak diakrytyku to potknięcie, nie pomyłka', () => {
    expect(checkProduction('cafe', 'café')).toEqual({ correct: true, nearMiss: true })
  })

  it('inne słowo jest pomyłką, choćby podobne', () => {
    expect(checkProduction('mesa', 'casa')).toEqual({ correct: false, nearMiss: false })
  })

  it('pusta odpowiedź nigdy nie jest trafna', () => {
    expect(checkProduction('', 'casa').correct).toBe(false)
  })
})

describe('klawiatura jamo', () => {
  it('składa 물 z ㅁ + ㅜ + ㄹ — bramka M8', () => {
    expect(composeJamo([...'ㅁㅜㄹ'])).toBe('물')
  })

  it('przenosi wygłos do następnej sylaby, gdy przyjdzie samogłoska', () => {
    // Bez tej reguły `무` + `ㄹ` + `ㅏ` dałoby `물아` zamiast `무라`.
    expect(composeJamo([...'ㅁㅜㄹㅏ'])).toBe('무라')
  })

  it('składa wyraz wielosylabowy', () => {
    expect(composeJamo([...'ㅎㅏㄴㄱㅡㄹ'])).toBe('한글')
  })

  it('pojedyncza spółgłoska zostaje widoczna, zamiast znikać', () => {
    expect(composeJamo([...'ㄱ'])).toBe('ㄱ')
  })

  it('sylaba bez nagłosu nie wywraca składania', () => {
    expect(composeJamo([...'ㅏ'])).toBe('ㅏ')
  })
})

describe('klawiatura kany', () => {
  it('skleja sylaby', () => {
    expect(composeKana([...'みず'])).toBe('みず')
  })

  it('znak dźwięczności działa wstecz, na ostatnią sylabę', () => {
    expect(composeKana(['か', DAKUTEN])).toBe('が')
    expect(composeKana(['は', HANDAKUTEN])).toBe('ぱ')
  })

  it('znak dźwięczności nad sylabą, która go nie przyjmuje, nic nie psuje', () => {
    expect(composeKana(['あ', DAKUTEN])).toBe('あ')
  })

  it('znak dźwięczności bez sylaby przed nim jest pomijany', () => {
    expect(composeKana([DAKUTEN, 'か'])).toBe('か')
  })
})

describe('kiedy karta idzie w produkcję', () => {
  const zdanie = {
    id: 'x',
    text: 'They are pleased with your work.',
    tokens: [{ s: 'pleased', b: 2500, gloss: 'zadowolony' }],
    pl: 'Są zadowoleni z pracy.',
    src: 'direct' as const,
    band: 2500,
    cloze: 0,
    distractors: [],
    quiz: true,
  }
  const card = (reps: number, interval: number) => ({
    ...newCard('x', 'en', 'sentences', 0),
    reps,
    interval,
  })

  it('przy „zawsze" pierwsze spotkanie zostaje quizem — nie ma czego odtwarzać', () => {
    // Karta wprowadzenia właśnie pokazała słowo. Wpisanie go sekundę później byłoby
    // przepisaniem, nie przypomnieniem, a ocena z tego trafiłaby do harmonogramu.
    expect(productionFor(en, card(0, 0), zdanie, 'always')).toBeNull()
  })

  it('przy „zawsze" pierwsza powtórka już jest produkcją', () => {
    const production = productionFor(en, card(1, 0), zdanie, 'always')
    expect(production?.mode).toBe('type')
    expect(production?.expected).toBe('pleased')
    expect(production?.prompt).toBe('zadowolony')
  })

  it('przy „od dojrzałych" powtórka młodej karty zostaje quizem', () => {
    expect(productionFor(en, card(3, 5), zdanie, 'mature')).toBeNull()
    expect(productionFor(en, card(9, 30), zdanie, 'mature')?.mode).toBe('type')
  })

  it('przy „wyłączonej" produkcji nie ma nigdy', () => {
    expect(productionFor(en, card(9, 30), zdanie, 'off')).toBeNull()
  })
})


