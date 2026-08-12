import type { DeckItem, DeckToken } from '@/store/decks'

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

/**
 * Kawałek zdania: tekst, który stoi PRZED tokenem (spacja, przecinek, cudzysłów),
 * i sam token. Dzięki temu da się renderować czytania nad wyrazami, nie tracąc niczego,
 * co jest między nimi — a to jest cały powód, dla którego zdanie wycinamy z oryginału.
 */
export type Piece = { glue: string; token: DeckToken }

export type Layout = {
  before: Piece[]
  after: Piece[]
  /** Tekst po ostatnim tokenie — zwykle kropka albo znak zapytania. */
  tail: string
  /** `false`, gdy tokenów nie dało się odnaleźć w zdaniu i trzeba sklejać. */
  exact: boolean
}

/**
 * Rozkłada zdanie na kawałki wokół luki. To jest wersja `splitAroundCloze` dla ekranu,
 * który chce renderować czytania: zamiast dwóch napisów dostaje listę tokenów wraz
 * z tym, co je rozdziela.
 */
export function layoutAroundCloze(item: DeckItem, joinWith: string): Layout {
  const before: Piece[] = []
  const after: Piece[] = []
  let at = 0
  let clozeEnd = -1

  for (let i = 0; i < item.tokens.length; i++) {
    const token = item.tokens[i]!
    const found = item.text.indexOf(token.s, at)
    if (found < 0) {
      // Ta sama ścieżka odwrotu co w `splitAroundCloze`: zdanie uboższe o interpunkcję,
      // ale kompletne.
      const glue = (index: number) => (index === 0 ? '' : joinWith)
      return {
        before: item.tokens.slice(0, item.cloze).map((t, index) => ({ glue: glue(index), token: t })),
        after: item.tokens.slice(item.cloze + 1).map((t, index) => ({ glue: glue(index), token: t })),
        tail: '',
        exact: false,
      }
    }

    const glue = item.text.slice(at, found)
    at = found + token.s.length

    if (i < item.cloze) before.push({ glue, token })
    else if (i > item.cloze) after.push({ glue, token })
    else clozeEnd = at
  }

  // Tekst tuż za luką należy do pierwszego kawałka po niej; gdy luka jest ostatnia,
  // zostaje w ogonie.
  if (clozeEnd >= 0 && after.length === 0) {
    return { before, after, tail: item.text.slice(clozeEnd), exact: true }
  }
  return { before, after, tail: item.text.slice(at), exact: true }
}

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
