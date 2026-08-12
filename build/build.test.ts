import { describe, expect, it } from 'vitest'
import { es, ja, ko, LANG_CODES, adapterFor } from '../src/langs/index.ts'
import { tokenize } from './02-tokenize.ts'
import { senseInContext, type Entry } from './04-glosses.ts'
import { editSimilarity, glossesCollide, jamoSimilarity } from './06-distractors.ts'

/**
 * Testy logiki builda. Nie sprawdzają danych — te ocenia się ręcznie przez `report-*.json`
 * (bramka M1). Sprawdzają reguły, których błąd byłby niewidoczny gołym okiem w talii
 * na dziesięć tysięcy zdań.
 */

describe('tokenizer space', () => {
  it('dzieli po ciągach liter, pomijając interpunkcję', () => {
    expect(tokenize('¿Y por qué no?', es).map((t) => t.s)).toEqual(['Y', 'por', 'qué', 'no'])
  })

  it('zachowuje apostrof wewnątrz wyrazu', () => {
    expect(tokenize("l'aigua és clara", es).map((t) => t.s)).toEqual(["l'aigua", 'és', 'clara'])
  })

  it('lemat to forma z małej litery, dopóki nie poprawi go leksykon', () => {
    expect(tokenize('Todo El Mundo', es).map((t) => t.lemma)).toEqual(['todo', 'el', 'mundo'])
  })

  it('odmawia pracy dla tokenizerów spoza M1, zamiast cicho zwracać śmieci', () => {
    expect(() => tokenize('水をください。', ja)).toThrow(/morph/)
  })
})

describe('wybór znaczenia w kontekście', () => {
  const slav: Entry = { pl: 'Słowianin', senses: ['Słowianin', 'niewolnik'], pos: 'noun' }

  it('bierze znaczenie obecne w polskim tłumaczeniu zdania', () => {
    expect(senseInContext(slav, 'Nie jestem twoim niewolnikiem.')).toBe('niewolnik')
  })

  it('zostaje przy pierwszym, gdy nic nie pasuje', () => {
    expect(senseInContext(slav, 'Zupełnie inne zdanie.')).toBe('Słowianin')
  })

  it('zostaje przy pierwszym, gdy pasuje więcej niż jedno — zgadywanie jest gorsze', () => {
    const both: Entry = { pl: 'kolacja', senses: ['kolacja', 'wieczerza'], pos: 'noun' }
    expect(senseInContext(both, 'Kolacja i wieczerza to to samo.')).toBe('kolacja')
  })

  it('dopasowuje po rdzeniu, bo polski odmienia', () => {
    // „pieska" niesie rdzeń „pies", więc wygrywa nad „kot" mimo innej końcówki.
    const animal: Entry = { pl: 'kot', senses: ['kot', 'pies'], pos: 'noun' }
    expect(senseInContext(animal, 'Widzę psa i pieska.')).toBe('pies')
    expect(senseInContext(animal, 'Widzę kota.')).toBe('kot')

    const baby: Entry = { pl: 'gwóźdź', senses: ['gwóźdź', 'niemowlę'], pos: 'noun' }
    expect(senseInContext(baby, 'To są niemowlęta.')).toBe('niemowlę')
  })
})

describe('podobieństwo kształtu', () => {
  it('rozpoznaje pary różniące się jedną literą', () => {
    expect(editSimilarity('carbón', 'jabón')).toBeGreaterThan(0.6)
    expect(editSimilarity('carbón', 'universidad')).toBeLessThan(0.3)
  })

  it('jest symetryczne i równe 1 dla identycznych', () => {
    expect(editSimilarity('casa', 'casa')).toBe(1)
    expect(editSimilarity('casa', 'caza')).toBe(editSimilarity('caza', 'casa'))
  })

  it('dla hangulu liczy po jamo, nie po sylabach', () => {
    // 물 i 불 różnią się jednym jamo z trzech, ale jako znaki są zupełnie różne.
    expect(jamoSimilarity('물', '불')).toBeGreaterThan(0.6)
    expect(editSimilarity('물', '불')).toBe(0)
  })
})

describe('kolizja glos', () => {
  it('odrzuca identyczne i zawierające się', () => {
    expect(glossesCollide('woda', 'woda')).toBe(true)
    expect(glossesCollide('woda', 'woda mineralna')).toBe(true)
  })

  it('odrzuca glosy dzielące znaczące słowo', () => {
    expect(glossesCollide('samochód osobowy', 'samochód ciężarowy')).toBe(true)
  })

  it('przepuszcza glosy rozłączne', () => {
    expect(glossesCollide('woda', 'chleb')).toBe(false)
    expect(glossesCollide('lód', 'ryż')).toBe(false)
  })

  it('nie myli krótkich słów funkcyjnych', () => {
    // „do" ma mniej niż 4 znaki, więc nie może samo spowodować kolizji.
    expect(glossesCollide('iść do szkoły', 'wracać do domu')).toBe(false)
  })
})

describe('kontrakt adapterów', () => {
  it.each(LANG_CODES)('%s ma komplet pól wymaganych przez pipeline', (code) => {
    const adapter = adapterFor(code)
    expect(adapter.tatoeba).toMatch(/^[a-z]{3}$/)
    expect(adapter.freq.length).toBeGreaterThan(0)
    expect(adapter.quiz.minOptions).toBeGreaterThanOrEqual(3)
    expect(adapter.production.length).toBeGreaterThan(0)
    expect(adapter.blocklist).toBeInstanceOf(RegExp)
    expect(adapter.sentence.minTokens).toBeLessThan(adapter.sentence.maxTokens)
  })

  it('japoński nie ma trybu `type` — systemowy IME podpowiada kanji (sekcja 7.2)', () => {
    expect(ja.production).not.toContain('type')
    expect(ja.production).toContain('draw')
  })

  it('języki z obcym pismem mają etap 0', () => {
    expect(ja.hasScriptStage).toBe(true)
    expect(ko.hasScriptStage).toBe(true)
    expect(es.hasScriptStage).toBe(false)
  })

  it('zestaw znaków odrzuca tekst z innego pisma', () => {
    expect(es.script.test('El árabe no es difícil.')).toBe(true)
    expect(es.script.test('水をください。')).toBe(false)
    expect(ko.script.test('물 좀 주세요.')).toBe(true)
  })

  it('lista wulgaryzmów faktycznie łapie to, co ma łapać', () => {
    expect(es.blocklist.test('Esto es una mierda.')).toBe(true)
    expect(es.blocklist.test('El agua está fría.')).toBe(false)
  })
})
