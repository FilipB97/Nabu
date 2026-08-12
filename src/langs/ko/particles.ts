import { decompose } from './hangul.ts'

/**
 * Rozdzielanie cząstek gramatycznych od rdzenia — sekcja 10.1a.
 *
 * Po co: tokenizer `space` widzi koreański wyraz fonetyczny w całości, więc luka
 * wypadała na `일을` albo `밤은` — rzeczownik zrośnięty z partykułą. Karta uczyła wtedy
 * złej jednostki, a cztery opcje mieszały formy gołe z partykułowymi, co jest silną
 * wskazówką gramatyczną: użytkownik odgaduje po kształcie, nie po znaczeniu.
 *
 * Po rozdzieleniu partykuła zostaje widoczna w zdaniu, a luka obejmuje sam rzeczownik:
 * „나는 해야할 ___을 했다". To jest lepsze niż samo naprawienie tokenu, bo partykuła
 * niesie funkcję składniową i jest podpowiedzią, którą uczący się ma umieć czytać.
 *
 * To nadal nie jest analizator morfologiczny. Nie rozbija form czasownikowych (od tego
 * jest `lemma.ts`), nie rozstrzyga niejednoznaczności i działa na zamkniętej liście
 * partykuł. Właściwym rozwiązaniem jest mecab-ko po v1.
 */

/**
 * Partykuły, od najdłuższej. Kolejność ma znaczenie: `에서` musi zostać rozpoznane
 * przed `에`, inaczej zostawimy `서` przyklejone do rdzenia.
 */
const PARTICLES = [
  '에서는',
  '에서도',
  '으로는',
  '에게서',
  '한테서',
  '으로',
  '에서',
  '에게',
  '한테',
  '부터',
  '까지',
  '보다',
  '처럼',
  '마다',
  '조차',
  '까지도',
  '와의',
  '과의',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '에',
  '의',
  '도',
  '만',
  '와',
  '과',
  '로',
  '나',
]

/**
 * Rdzeń musi mieć co najmniej tyle sylab, żeby odcięcie miało sens. Jednosylabowe
 * rzeczowniki istnieją (`물`, `밤`), więc próg jest niski, ale zerowy rdzeń odpada.
 */
const MIN_STEM = 1

function isHangul(text: string): boolean {
  return [...text].every((char) => decompose(char) !== null)
}

/**
 * Rozdziela wyraz na rdzeń i partykułę. Zwraca jeden element, gdy nie ma czego dzielić —
 * dzięki temu wywołujący nie musi rozgałęziać.
 */
export function splitParticle(surface: string): Array<{ s: string; pos?: string }> {
  if (!isHangul(surface) || surface.length <= MIN_STEM) return [{ s: surface }]

  for (const particle of PARTICLES) {
    if (!surface.endsWith(particle)) continue
    const stem = surface.slice(0, surface.length - particle.length)
    if (stem.length < MIN_STEM) continue

    // Czasowniki kończą się na `다` i to nie jest partykuła — `있다` nie dzieli się
    // na `있` + `다`. Ten sam problem dotyczy końcówek zbieżnych kształtem z partykułą.
    if (surface.endsWith('다')) return [{ s: surface }]

    // Partykuła dostaje część mowy `particle`, przez co nie może zostać luką.
    // Bez tego powstawały karty z luką na samym `이` albo `만`.
    return [{ s: stem }, { s: particle, pos: 'particle' }]
  }

  return [{ s: surface }]
}
