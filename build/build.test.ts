import { describe, expect, it } from 'vitest'
import { glossSupported } from './05-assemble.ts'
import { es, ja, ko, LANG_CODES, adapterFor } from '../src/langs/index.ts'
import { tokenize } from './02-tokenize.ts'
import { senseInContext, type Entry } from './04-glosses.ts'
import { editSimilarity, glossesCollide, jamoSimilarity } from './06-distractors.ts'
import { needsFurigana, toHiragana } from '../src/langs/ja/kana.ts'
import { posFromIpadic } from '../src/langs/ja/pos.ts'
import { splitParticle } from '../src/langs/ko/particles.ts'
import { lemmaCandidates } from '../src/langs/ko/lemma.ts'
import { syllableToDiacritics, toDiacritics } from '../src/langs/zh/pinyin.ts'

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

  it('analizator morfologiczny odmawia pracy przed zbudowaniem, zamiast zwracać śmieci', () => {
    // Słownik IPADIC waży kilkanaście megabajtów i ładuje się asynchronicznie.
    // Ciche zwrócenie pustej listy byłoby gorsze niż błąd: talia zbudowałaby się
    // bez japońskiego i nikt by tego nie zauważył.
    expect(() => tokenize('水をください。', ja)).toThrow(/prepareTokenizer/)
  })

  it('tokenizer słownikowy odmawia pracy przed wczytaniem słownika', () => {
    expect(() => tokenize('我喜欢', { ...ja, tokenizer: 'dict' })).toThrow(/prepareTokenizer/)
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

describe('kana i furigana', () => {
  it('zamienia katakanę na hiraganę', () => {
    expect(toHiragana('ミズ')).toBe('みず')
    expect(toHiragana('タテモノ')).toBe('たてもの')
  })

  it('zostawia to, co nie jest katakaną', () => {
    expect(toHiragana('水')).toBe('水')
    expect(toHiragana('abc')).toBe('abc')
  })

  it('furigana tylko nad kanji — nad kaną powtarzałaby to, co widać', () => {
    expect(needsFurigana('水', 'ミズ')).toBe(true)
    expect(needsFurigana('建物', 'タテモノ')).toBe(true)
    expect(needsFurigana('ください', 'クダサイ')).toBe(false)
    expect(needsFurigana('ニュース', 'ニュース')).toBe(false)
  })
})

describe('części mowy z IPADIC', () => {
  it('tłumaczy etykiety japońskie na słownik rdzenia', () => {
    expect(posFromIpadic('名詞')).toBe('noun')
    expect(posFromIpadic('動詞')).toBe('verb')
    expect(posFromIpadic('助詞')).toBe('particle')
  })

  it('sufiksy i zaimki nie są słowem, choć formalnie są rzeczownikiem', () => {
    // `屋` w `郵便屋さん` jest sufiksem — zasłonięcie go pyta o gramatykę, nie o słowo.
    expect(posFromIpadic('名詞', '接尾')).toBe('affix')
    expect(posFromIpadic('名詞', '代名詞')).toBe('affix')
    expect(posFromIpadic('名詞', '一般')).toBe('noun')
  })
})

describe('koreański: partykuły i formy słownikowe', () => {
  it('oddziela partykułę i oznacza ją częścią mowy', () => {
    expect(splitParticle('일을')).toEqual([{ s: '일' }, { s: '을', pos: 'particle' }])
    expect(splitParticle('밤은')).toEqual([{ s: '밤' }, { s: '은', pos: 'particle' }])
  })

  it('dłuższa partykuła ma pierwszeństwo przed krótszą', () => {
    // `에서` musi zostać rozpoznane przed `에`, inaczej `서` zostaje przy rdzeniu.
    expect(splitParticle('학교에서')).toEqual([{ s: '학교' }, { s: '에서', pos: 'particle' }])
  })

  it('nie tnie czasowników ani wyrazów niepodzielnych', () => {
    expect(splitParticle('있다')).toEqual([{ s: '있다' }])
    expect(splitParticle('물')).toEqual([{ s: '물' }])
    expect(splitParticle('hello')).toEqual([{ s: 'hello' }])
  })

  it('proponuje formę słownikową dla form odmienionych', () => {
    expect(lemmaCandidates('먹어요')).toContain('먹다')
    expect(lemmaCandidates('했습니다')).toContain('하다')
    expect(lemmaCandidates('없으면')).toContain('없다')
  })

  it('formę słownikową stawia na pierwszym miejscu, żeby wygrała w wyszukiwaniu', () => {
    expect(lemmaCandidates('먹다')[0]).toBe('먹다')
  })

  it('nie skraca po samej końcówce 다 — `했습니다` też ją ma, a jest formą odmienioną', () => {
    expect(lemmaCandidates('했습니다')).toContain('하다')
    expect(lemmaCandidates('갔다')).toContain('가다')
  })
})

describe('chiński: pinyin', () => {
  it('stawia znak tonu na właściwej samogłosce', () => {
    expect(syllableToDiacritics('chuan2')).toBe('chuán')
    expect(syllableToDiacritics('tong3')).toBe('tǒng')
    expect(syllableToDiacritics('hao3')).toBe('hǎo')
    expect(syllableToDiacritics('gou3')).toBe('gǒu')
  })

  it('`a` i `e` mają pierwszeństwo, w `ou` znak idzie na `o`', () => {
    expect(syllableToDiacritics('xiao3')).toBe('xiǎo')
    expect(syllableToDiacritics('bei3')).toBe('běi')
    expect(syllableToDiacritics('dou1')).toBe('dōu')
  })

  it('ton neutralny nie ma znaku — i to jest informacja, nie jego brak', () => {
    expect(syllableToDiacritics('ma5')).toBe('ma')
    expect(syllableToDiacritics('de5')).toBe('de')
  })

  it('rozwija zapis `u:` i `v` na `ü`', () => {
    expect(syllableToDiacritics('nu:3')).toBe('nǚ')
    expect(syllableToDiacritics('lv4')).toBe('lǜ')
  })

  it('składa całe wyrażenie', () => {
    expect(toDiacritics('chuan2 tong3')).toBe('chuán tǒng')
    expect(toDiacritics('tu2 shu1 guan3')).toBe('tú shū guǎn')
  })
})

describe('karta musi być rozstrzygalna', () => {
  it('glosa ma oparcie, gdy polskie zdanie niesie jej rdzeń', () => {
    expect(glossSupported('jeść', 'Co chcesz jeść?')).toBe(true)
    expect(glossSupported('lekarstwo', 'Czy muszę brać to lekarstwo?')).toBe(true)
    expect(glossSupported('założyciel', 'Uniwersytet nosi imię swego założyciela.')).toBe(true)
  })

  it('oboczność rdzenia gubi kartę i to jest znany koszt', () => {
    // `kupować` i `kupić` różnią się na czwartym znaku, więc rdzeń ich nie skleja
    // i karta „Co chcesz kupić?" wypada, choć jest dobra. Rdzeń trzyznakowy złapałby
    // ją razem z fałszywymi trafieniami w rodzaju `prawie` / `praca`. Właściwym
    // lekarstwem jest prawdziwy stemmer polski — zadanie po v1.
    expect(glossSupported('kupować', 'Co chcesz kupić?')).toBe(false)
  })

  it('bez śladu w tłumaczeniu nie ma z czego wywnioskować odpowiedzi', () => {
    // Dokładnie te dwie karty wyszły na telefonie: „Vad vill du ha?" i „Vad vill du då?".
    expect(glossSupported('mieć, posiadać (np. samochód)', 'Czego chcesz?')).toBe(false)
    expect(glossSupported('wtedy, w tamtym czasie', 'Czego zatem chcesz?')).toBe(false)
  })

  it('krótkie słowa nie łapią się przypadkiem', () => {
    // Rdzeń liczy cztery znaki, więc „ma" i „to" nie mogą uzasadnić żadnej glosy.
    expect(glossSupported('to', 'To jest kot.')).toBe(false)
  })

  it('rdzeń łapie odmianę, nie tylko formę słownikową', () => {
    expect(glossSupported('zmęczony', 'Wygląda na zmęczonego.')).toBe(true)
  })
})
