import type { LangAdapter, ProductionMode } from '@/langs'
import { isMature } from '@/srs/sm2'
import type { CardState } from '@/srs/types'
import type { DeckItem } from '@/store/decks'

/**
 * Produkcja — sekcja 6.4 i 7 planu, M8.
 *
 * Karta dojrzała przestaje być quizem i zaczyna wymagać ODTWORZENIA z pamięci. To jest
 * jedyny moment, w którym aplikacja sprawdza wiedzę czynną, i dlatego jest wart osobnego
 * trybu: rozpoznanie jednej z czterech opcji da się wyćwiczyć, nie znając słowa.
 *
 * Produkcja nie jest etapem, przez który przechodzi język, tylko trybem POJEDYNCZEJ karty.
 * Ta sama pozycja jest najpierw quizem, potem produkcją, i nie ma momentu „odblokowania".
 */

export type Production = {
  mode: ProductionMode
  /** Czego oczekujemy — zapis docelowy albo czytanie. */
  expected: string
  /** Co pokazujemy na przodzie. */
  prompt: string
  /** Podpowiedź drugiego rzędu: zdanie, w którym słowo wystąpiło. */
  context?: string
}

/**
 * Czy ta karta ma iść w produkcję i w jakim trybie.
 *
 * Kolejność w `adapter.production` jest priorytetem, ale nie każdy tryb da się wykonać
 * na każdej pozycji: `kana` wymaga czytania, `draw` wymaga danych o kreskach (M8, dalej),
 * `type` wymaga zapisu, który da się wpisać z klawiatury systemowej. Bierzemy pierwszy
 * wykonalny; gdy żaden nie jest — karta zostaje quizem, po cichu.
 */
export function productionFor(
  adapter: LangAdapter,
  card: CardState,
  item: DeckItem,
  setting: 'off' | 'mature' | 'always',
  /**
   * Czy da się teraz słuchać mikrofonu. Sprawdza to `canRecognize()` z warstwy dźwięku,
   * a nie ten plik — funkcja ma zostać czysta i testowalna, a dostępność rozpoznawania
   * zależy od przeglądarki, zgody na mikrofon i tego, czy jest sieć.
   */
  canSpeak = false,
): Production | null {
  if (setting === 'off') return null
  if (setting === 'mature' && !isMature(card)) return null
  // Nawet przy „zawsze" pierwsze spotkanie nie jest produkcją. Pozycja właśnie została
  // pokazana na karcie wprowadzenia, więc wpisanie jej z pamięci nie byłoby odtworzeniem,
  // tylko przepisaniem tego, co widać było przed sekundą. Odtwarzanie zaczyna się przy
  // pierwszej POWTÓRCE — a ta przy kartach nowych wraca jeszcze w tej samej sesji.
  if (card.reps === 0) return null

  const target = item.tokens[item.cloze]
  if (!target?.gloss) return null

  /**
   * Mówienie wchodzi co drugą powtórkę i ma wtedy PIERWSZEŃSTWO nad zapisem.
   *
   * Kolejność w `adapter.production` opisuje priorytet trybów PISANIA — rysowanie przed
   * kaną, kana przed wpisaniem. Mówienie nie jest kolejnym z nich, tylko przeplotem nad
   * nimi: dlatego decyzja zapada przed pętlą, a nie w niej. Wewnątrz pętli `type`
   * wygrywałoby zawsze i tryb mówienia nigdy by się nie pojawił.
   *
   * Parzystość, nie losowanie: ta sama karta zachowuje się przewidywalnie, a użytkownik
   * wie, czego się po niej spodziewać.
   */
  if (canSpeak && adapter.production.includes('speak') && card.reps % 2 === 1) {
    return {
      mode: 'speak',
      expected: target.s,
      prompt: target.gloss,
      ...(item.pl ? { context: item.pl } : {}),
    }
  }

  for (const mode of adapter.production) {
    // Mówienie jest rozstrzygane wyżej; tutaj przechodzimy do trybów zapisu.
    if (mode === 'speak') continue

    if (mode === 'kana') {
      if (!target.r) continue
      return {
        mode,
        expected: target.r,
        prompt: target.s,
        ...(item.pl ? { context: item.pl } : {}),
      }
    }

    if (mode === 'type' || mode === 'jamo') {
      return {
        mode,
        expected: target.s,
        prompt: target.gloss,
        ...(item.pl ? { context: item.pl } : {}),
      }
    }

    // `draw` wymaga `data/{lang}/strokes.json` — dopóki go nie ma, tryb jest pomijany
    // i karta spada na kolejny z listy albo zostaje quizem.
  }

  return null
}

/** Same litery i znaki pisma: odrzucamy spacje, interpunkcję i różnice wielkości. */
function normalize(text: string): string {
  return text.trim().toLocaleLowerCase().replace(/\s+/g, '')
}

/**
 * Forma bez znaków diakrytycznych. `café` i `cafe` to nie jest to samo słowo, ale też
 * nie jest to pomyłka tego samego rodzaju co `mesa` zamiast `casa` — sekcja 6.4 nazywa
 * to `nearMiss` i ocenia jako „Trudne", nie „Nie pamiętam".
 */
function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export type ProductionCheck = { correct: boolean; nearMiss: boolean }

export function checkProduction(given: string, expected: string): ProductionCheck {
  const a = normalize(given)
  const b = normalize(expected)
  if (a === b) return { correct: true, nearMiss: false }
  if (a.length > 0 && stripDiacritics(a) === stripDiacritics(b)) {
    return { correct: true, nearMiss: true }
  }
  return { correct: false, nearMiss: false }
}
