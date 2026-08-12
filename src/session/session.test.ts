import { describe, expect, it } from 'vitest'
import { newCard, type CardState } from '@/srs/types'
import type { DeckItem, Lexicon } from '@/store/decks'
import {
  SessionQueue,
  cardedLemmas,
  knownLemmas,
  selectFresh,
  type QueueEntry,
} from './queue.ts'
import { buildConfusions, buildOptions } from './options.ts'
import { splitAroundCloze } from './cloze.ts'

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0)

function item(id: string, band: number, lemmas: string[], cloze = 0): DeckItem {
  return {
    id,
    text: lemmas.join(' '),
    tokens: lemmas.map((lemma, i) => ({
      s: lemma,
      b: band - i,
      lemma,
      ...(i === cloze ? { gloss: `glosa-${lemma}` } : {}),
    })),
    pl: 'tłumaczenie',
    src: 'direct',
    band,
    cloze,
    distractors: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
    quiz: true,
  }
}

const LEXICON: Lexicon = Object.fromEntries(
  ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((id) => [
    id,
    { s: `opcja-${id}`, pl: `glosa-${id}`, pos: 'noun', b: 100 },
  ]),
)

function entry(id: string, band = 100): QueueEntry {
  return { card: newCard(id, 'es', 'sentences', NOW), item: item(id, band, ['a', 'b']), fresh: false }
}

describe('kolejka sesji', () => {
  it('wpycha kartę z powrotem po kilku innych, a nie na sam koniec', () => {
    const queue = new SessionQueue([1, 2, 3, 4, 5, 6, 7, 8].map((n) => entry(`k${n}`)))
    const first = queue.take()!
    queue.reinsert(first)

    const order: string[] = []
    let next = queue.take()
    while (next) {
      order.push(next.card.id)
      next = queue.take()
    }
    expect(order.indexOf('k1')).toBe(4)
  })

  it('gdy kart jest mniej niż odstęp, wepchnięta ląduje na końcu i sesja się przedłuża', () => {
    const queue = new SessionQueue([entry('a'), entry('b')])
    const first = queue.take()!
    expect(queue.total).toBe(2)
    queue.reinsert(first)
    expect(queue.total).toBe(3)
    expect(queue.peek()!.card.id).toBe('b')
  })

  it('wepchnięta karta przestaje być nowa — nie liczy się drugi raz jako wprowadzona', () => {
    const queue = new SessionQueue([{ ...entry('a'), fresh: true }])
    const first = queue.take()!
    expect(first.fresh).toBe(true)
    queue.reinsert(first)
    expect(queue.peek()!.fresh).toBe(false)
  })
})

describe('dobór nowych pozycji metodą i+1', () => {
  const known = new Set(['woda', 'pić', 'chcieć'])

  it('preferuje zdanie z dokładnie jednym nowym słowem', () => {
    const pool = [
      item('dwa-nowe', 100, ['woda', 'obcy1', 'obcy2']),
      item('jedno-nowe', 200, ['woda', 'pić', 'obcy1']),
      item('zero-nowych', 50, ['woda', 'pić', 'chcieć']),
    ]
    expect(selectFresh(pool, known, new Set(), 1)[0]!.id).toBe('jedno-nowe')
  })

  it('pomija pozycje już widziane', () => {
    const pool = [item('a', 100, ['woda', 'obcy1']), item('b', 200, ['woda', 'obcy2'])]
    expect(selectFresh(pool, known, new Set(['a']), 5).map((i) => i.id)).toEqual(['b'])
  })

  it('przy remisie bierze łatwiejsze pasmo', () => {
    const pool = [item('trudne', 900, ['woda', 'x']), item('łatwe', 100, ['woda', 'y'])]
    expect(selectFresh(pool, known, new Set(), 1)[0]!.id).toBe('łatwe')
  })

  it('nie zwraca nic, gdy limit to zero — to jest stan „zaległości powyżej progu"', () => {
    expect(selectFresh([item('a', 100, ['x'])], known, new Set(), 0)).toEqual([])
  })
})

describe('zdanie wokół luki', () => {
  function sentence(text: string, surfaces: string[], cloze: number): DeckItem {
    return {
      ...item('x', 100, surfaces, cloze),
      text,
      tokens: surfaces.map((s) => ({ s, b: 100, lemma: s })),
    }
  }

  it('zachowuje interpunkcję, której nie ma w tokenach', () => {
    const it_ = sentence('那人是谁？', ['那', '人', '是', '谁'], 1)
    expect(splitAroundCloze(it_, '')).toEqual({ before: '那', after: '是谁？' })
  })

  it('zachowuje przecinki i kropkę w zdaniu ze spacjami', () => {
    const it_ = sentence('Lo hecho, hecho está.', ['Lo', 'hecho', 'hecho', 'está'], 2)
    expect(splitAroundCloze(it_, ' ')).toEqual({ before: 'Lo hecho, ', after: ' está.' })
  })

  it('bierze właściwe wystąpienie, gdy forma powtarza się wcześniej', () => {
    const it_ = sentence('a b a b', ['a', 'b', 'a', 'b'], 2)
    expect(splitAroundCloze(it_, ' ')).toEqual({ before: 'a b ', after: ' b' })
  })

  it('gdy tokenu nie ma w zdaniu, wraca do sklejania — zdanie uboższe, ale poprawne', () => {
    const it_ = sentence('Całkiem inne zdanie.', ['ala', 'ma', 'kota'], 1)
    expect(splitAroundCloze(it_, ' ')).toEqual({ before: 'ala', after: 'kota' })
  })
})

describe('jeden lemat, jedna karta', () => {
  const known = new Set(['woda'])

  it('dwa zdania z tym samym słowem w luce nie wchodzą do sesji razem', () => {
    const pool = [
      item('samochód-1', 100, ['samochód', 'woda']),
      item('samochód-2', 110, ['samochód', 'woda']),
      item('dom', 120, ['dom', 'woda']),
    ]
    expect(selectFresh(pool, known, new Set(), 2).map((i) => i.id)).toEqual(['samochód-1', 'dom'])
  })

  it('słowo, na które jest już karta, nie wraca jako nowe w kolejnej sesji', () => {
    const pool = [item('samochód-2', 110, ['samochód', 'woda']), item('dom', 120, ['dom', 'woda'])]
    const covered = new Set(['samochód'])
    expect(selectFresh(pool, known, new Set(), 5, covered).map((i) => i.id)).toEqual(['dom'])
  })

  it('lemat czyta się z karty, bez wczytywania zdania', () => {
    const card: CardState = { ...newCard('x', 'ja', 'sentences', NOW, '車'), interval: 0 }
    expect(cardedLemmas([card], new Map()).has('車')).toBe(true)
  })

  it('karty sprzed pola `lemma` odzyskują je ze zdania, gdy jest pod ręką', () => {
    const card = newCard('a', 'es', 'sentences', NOW)
    const items = new Map([['a', item('a', 100, ['woda'])]])
    expect(cardedLemmas([card], items).has('woda')).toBe(true)
  })
})

describe('zbiór słów znanych', () => {
  it('karta w krokach nauki jeszcze się nie liczy jako znana', () => {
    const items = new Map([['a', item('a', 100, ['woda'])]])
    const learning: CardState = { ...newCard('a', 'es', 'sentences', NOW), interval: 0, reps: 1 }
    expect(knownLemmas([learning], items).size).toBe(0)
  })

  it('karta z interwałem dziennym liczy się jako znana', () => {
    const items = new Map([['a', item('a', 100, ['woda'])]])
    const learned: CardState = { ...newCard('a', 'es', 'sentences', NOW), interval: 3 }
    expect(knownLemmas([learned], items).has('woda')).toBe(true)
  })
})

describe('dobór opcji quizu', () => {
  const target = item('s1', 100, ['woda', 'pić'])

  it('zwraca żądaną liczbę opcji z dokładnie jedną poprawną', () => {
    const set = buildOptions(target, LEXICON, 4, null, new Map(), () => 0.5)!
    expect(set.options).toHaveLength(4)
    expect(set.options[set.correct]!.id).toBe('woda')
    expect(new Set(set.options.map((o) => o.id)).size).toBe(4)
  })

  it('poprawna odpowiedź nie stoi dwa razy z rzędu w tym samym miejscu — bramka M2', () => {
    const last = { correctAt: 2, distractorIds: ['d1', 'd2', 'd3'] }
    for (let i = 0; i < 30; i++) {
      const set = buildOptions(target, LEXICON, 4, last, new Map(), () => i / 30)!
      expect(set.correct).not.toBe(2)
    }
  })

  it('nie powtarza zestawu dystraktorów z poprzedniej powtórki', () => {
    const first = buildOptions(target, LEXICON, 4, null, new Map(), () => 0.5)!
    const shown = first.options.filter((_, i) => i !== first.correct).map((o) => o.id)
    const second = buildOptions(
      target,
      LEXICON,
      4,
      { correctAt: first.correct, distractorIds: shown },
      new Map(),
      () => 0.5,
    )!
    const again = second.options.filter((_, i) => i !== second.correct).map((o) => o.id)
    expect(again).not.toEqual(shown)
  })

  it('dystraktor, na który użytkownik się nabrał, wraca z pierwszeństwem', () => {
    const confusions = new Map([['woda', new Map([['d6', 5]])]])
    const set = buildOptions(target, LEXICON, 4, null, confusions, () => 0.5)!
    expect(set.options.map((o) => o.id)).toContain('d6')
  })

  it('odmawia, gdy kandydatów nie starcza — wtedy karta spada na `reveal`', () => {
    const thin = { ...target, distractors: ['d1'] }
    expect(buildOptions(thin, LEXICON, 4, null, new Map())).toBeNull()
  })

  it('odmawia dla pozycji oznaczonej w buildzie jako bez quizu', () => {
    expect(buildOptions({ ...target, quiz: false }, LEXICON, 4, null, new Map())).toBeNull()
  })

  it('sześć opcji też działa, gdy kandydatów starcza', () => {
    const set = buildOptions(target, LEXICON, 6, null, new Map(), () => 0.5)!
    expect(set.options).toHaveLength(6)
  })
})

describe('mylone pary z logu', () => {
  const correctOf = (id: string) => (id === 's1' ? 'woda' : undefined)

  it('zlicza, co z czym się myli', () => {
    const pairs = buildConfusions(
      [
        { id: 's1', chosen: 'd1', grade: 0 },
        { id: 's1', chosen: 'd1', grade: 0 },
        { id: 's1', chosen: 'd2', grade: 0 },
      ],
      correctOf,
    )
    expect(pairs.get('woda')!.get('d1')).toBe(2)
    expect(pairs.get('woda')!.get('d2')).toBe(1)
  })

  it('po serii trafień para schodzi z listy', () => {
    const pairs = buildConfusions(
      [
        { id: 's1', chosen: 'd1', grade: 0 },
        { id: 's1', chosen: 'woda', grade: 2 },
        { id: 's1', chosen: 'woda', grade: 2 },
        { id: 's1', chosen: 'woda', grade: 2 },
      ],
      correctOf,
    )
    expect(pairs.has('woda')).toBe(false)
  })

  it('pomija wpisy bez wybranej opcji — produkcja i `reveal` nie mają czego mylić', () => {
    expect(buildConfusions([{ id: 's1', grade: 0 }], correctOf).size).toBe(0)
  })
})
