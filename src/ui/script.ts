import type { LangAdapter } from '@/langs'

/**
 * Jak renderować tekst w piśmie docelowym — krój i kierunek, w jednym miejscu.
 *
 * Mapowanie kroju powtarzało się w pięciu plikach, więc dodanie arabskiego znaczyłoby
 * pięć identycznych poprawek i piątą okazję, żeby o którejś zapomnieć. Kierunek pisma
 * dochodzi tu z tego samego powodu: `dir` musi stać dokładnie tam, gdzie stoi krój,
 * bo dotyczy dokładnie tej samej treści.
 *
 * `dir="rtl"` na elemencie, a nie na całej stronie: interfejs zostaje polski i lewostronny,
 * a prawostronne jest tylko zdanie, słowo i opcja quizu. Przełączenie całego układu
 * przesunęłoby nawigację, przyciski i liczniki — czyli rzeczy, których język docelowy
 * nie dotyczy.
 */

const FONT: Record<LangAdapter['display']['font'], string> = {
  ui: 'font-ui',
  display: 'font-display',
  ja: 'font-ja',
  ko: 'font-ko',
  ar: 'font-ar',
}

export function fontClassOf(adapter: LangAdapter): string {
  return FONT[adapter.display.font]
}

export function fontClassFor(font: LangAdapter['display']['font']): string {
  return FONT[font]
}

/**
 * Kierunek pisma dla tekstu docelowego. `undefined` zostawia dziedziczenie, więc
 * w językach lewostronnych nie wypisujemy atrybutu bez potrzeby.
 */
export function dirOf(adapter: LangAdapter): 'rtl' | undefined {
  return adapter.rtl ? 'rtl' : undefined
}
