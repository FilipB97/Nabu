import type { DeckItem } from '@/store/decks'

/**
 * Zdanie wokół luki — do wyświetlenia na karcie.
 *
 * Sklejanie form powierzchniowych tokenów wygląda na oczywiste i jest błędne: tokenizery
 * odrzucają interpunkcję, więc „Lo hecho, hecho está." renderowało się jako „Lo hecho hecho
 * está", a chińskie `那人是谁？` traciło znak zapytania. Zdanie na karcie ma być tym, które
 * napisał człowiek — inaczej uczymy interpunkcji, której w materiale nie ma.
 *
 * Zamiast sklejać, wycinamy: szukamy tokenów po kolei w oryginalnym tekście i bierzemy
 * wszystko przed tokenem luki i po nim. Wszystko, co między tokenami — spacje, przecinki,
 * cudzysłowy, `¿` — zostaje na swoim miejscu, bo nigdy stamtąd nie znika.
 */
export type Around = { before: string; after: string }

export function splitAroundCloze(item: DeckItem, joinWith: string): Around {
  const target = item.tokens[item.cloze]

  if (target) {
    let from = 0
    let found = -1
    for (let i = 0; i <= item.cloze; i++) {
      const at = item.text.indexOf(item.tokens[i]!.s, from)
      if (at < 0) {
        found = -1
        break
      }
      if (i === item.cloze) {
        found = at
        break
      }
      from = at + item.tokens[i]!.s.length
    }

    if (found >= 0) {
      return {
        before: item.text.slice(0, found),
        after: item.text.slice(found + target.s.length),
      }
    }
  }

  // Awaryjnie sklejamy tokeny. Dzieje się tak tylko wtedy, gdy forma powierzchniowa tokenu
  // nie występuje w zdaniu — czyli gdy tokenizer coś znormalizował. Zdanie jest wtedy uboższe
  // o interpunkcję, ale nadal poprawne.
  return {
    before: item.tokens
      .slice(0, item.cloze)
      .map((t) => t.s)
      .join(joinWith),
    after: item.tokens
      .slice(item.cloze + 1)
      .map((t) => t.s)
      .join(joinWith),
  }
}
