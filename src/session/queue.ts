import type { CardState } from '@/srs/types'
import type { DeckItem } from '@/store/decks'

/**
 * Kolejka sesji — sekcja 6 i 8.4 planu.
 *
 * Dwie rzeczy, które muszą działać, żeby sesja miała sens:
 *
 * 1. Karty w krokach minutowych wracają W TEJ SAMEJ SESJI, wepchnięte po odpowiedniej
 *    liczbie innych kart. To jest odpowiedź na pytanie „kiedy to zobaczę znowu",
 *    którą użytkownik odczuwa natychmiast.
 * 2. Nowe pozycje wchodzą metodą i+1 — dokładnie jedno nieznane słowo w zdaniu.
 *    Bez tego zdania są albo trywialne, albo nieczytelne.
 */

/** Po ilu innych kartach wraca karta wepchnięta z powrotem do kolejki. */
const REINSERT_AFTER = 4

export type QueueEntry = {
  card: CardState
  item: DeckItem
  /** Czy pozycja jest wprowadzana po raz pierwszy w tej sesji. */
  fresh: boolean
}

/**
 * Kolejka z możliwością wepchnięcia karty z powrotem. Nie jest to zwykła tablica,
 * bo wepchnięcie „za cztery karty" musi działać także wtedy, gdy do końca sesji
 * zostały dwie — wtedy karta ląduje na końcu, a sesja się o nią przedłuża.
 */
export class SessionQueue {
  private entries: QueueEntry[]
  private answered = 0

  constructor(entries: QueueEntry[]) {
    this.entries = [...entries]
  }

  get remaining(): number {
    return this.entries.length
  }

  get done(): number {
    return this.answered
  }

  /** Łączna długość sesji na teraz — rośnie, gdy karty wracają. */
  get total(): number {
    return this.answered + this.entries.length
  }

  peek(): QueueEntry | undefined {
    return this.entries[0]
  }

  /** Zdejmuje bieżącą kartę. Wołane po odpowiedzi, niezależnie od oceny. */
  take(): QueueEntry | undefined {
    const entry = this.entries.shift()
    if (entry) this.answered += 1
    return entry
  }

  /**
   * Wpycha kartę z powrotem, za `REINSERT_AFTER` innych kart. Gdy tyle ich nie ma,
   * karta idzie na koniec — sesja się przedłuża, ale karta nie znika.
   */
  reinsert(entry: QueueEntry): void {
    const at = Math.min(REINSERT_AFTER, this.entries.length)
    this.entries.splice(at, 0, { ...entry, fresh: false })
  }
}

/**
 * Dobór nowych pozycji metodą i+1 — sekcja 3.1.
 *
 * Szukamy zdań, w których dokładnie jedno słowo jest spoza zbioru znanych. Zbiór
 * znanych bierze się z kalibracji (M7) i z kart już wprowadzonych; dopóki kalibracji
 * nie ma, startuje pusty i i+1 sprowadza się do „najłatwiejsze najpierw", co jest
 * właściwym zachowaniem dla konta od zera.
 */
export function selectFresh(
  items: readonly DeckItem[],
  known: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  limit: number,
): DeckItem[] {
  if (limit <= 0) return []

  const scored: { item: DeckItem; unknown: number }[] = []

  for (const item of items) {
    if (seen.has(item.id)) continue
    const target = item.tokens[item.cloze]
    if (!target) continue

    const lemmas = new Set(item.tokens.map((token) => token.lemma ?? token.s.toLocaleLowerCase()))
    let unknown = 0
    for (const lemma of lemmas) if (!known.has(lemma)) unknown += 1

    scored.push({ item, unknown })
  }

  // Dokładnie jedno nowe słowo jest ideałem; przy jego braku bierzemy najbliższe,
  // a przy remisie łatwiejsze pasmo. Sortowanie zamiast twardego filtra, bo talia
  // nie zawsze ma idealnego kandydata i lepiej dać zdanie z dwoma nowymi słowami
  // niż nie dać żadnego.
  scored.sort((a, b) => {
    const da = Math.abs(a.unknown - 1)
    const db = Math.abs(b.unknown - 1)
    if (da !== db) return da - db
    return a.item.band - b.item.band
  })

  return scored.slice(0, limit).map((entry) => entry.item)
}

/**
 * Zbiór lematów, które użytkownik zna. Karta wprowadzona i utrwalona liczy się jako
 * znana; karta w krokach nauki jeszcze nie — inaczej i+1 uznałoby za znane wszystko,
 * co użytkownik zobaczył raz i zaraz zapomniał.
 */
export function knownLemmas(cards: readonly CardState[], items: ReadonlyMap<string, DeckItem>): Set<string> {
  const known = new Set<string>()
  for (const card of cards) {
    if (card.interval < 1) continue
    const item = items.get(card.id)
    const target = item?.tokens[item.cloze]
    if (target) known.add(target.lemma ?? target.s.toLocaleLowerCase())
  }
  return known
}
