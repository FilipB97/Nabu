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
  covered: ReadonlySet<string> = new Set(),
  knownBand = 0,
): DeckItem[] {
  if (limit <= 0) return []

  const scored: { item: DeckItem; lemma: string; unknown: number }[] = []

  for (const item of items) {
    if (seen.has(item.id)) continue
    const target = item.tokens[item.cloze]
    if (!target) continue

    // Jeden lemat, jedna karta. Talia ma po kilkanaście zdań na słowo, więc bez tego
    // filtra „samochód" wchodzi jako nowa pozycja tyle razy, ile jest zdań z 車 —
    // za każdym razem wyglądając na nowe słowo, choć uczy dokładnie tego samego.
    const lemma = target.lemma ?? target.s.toLocaleLowerCase()
    if (covered.has(lemma)) continue

    // Luka MUSI być słowem nieznanym. Kalibracja mówi, dokąd sięga słownictwo
    // użytkownika — pytanie o słowo z tego pasma jest stratą sesji i dokładnie tym,
    // na co skarży się każdy, kto zadeklarował poziom zaawansowany.
    if (knownBand > 0 && target.b > 0 && target.b <= knownBand) continue

    // Słowo jest znane, gdy użytkownik ma na nie utrwaloną kartę ALBO gdy mieści się
    // w paśmie oszacowanym kalibracją (sekcja 3.1). Bez tego drugiego warunku konto
    // zaawansowane widzi w każdym zdaniu pięć nowych słów i i+1 nie ma czego wybierać.
    const seenLemmas = new Set<string>()
    let unknown = 0
    for (const token of item.tokens) {
      const lemma = token.lemma ?? token.s.toLocaleLowerCase()
      if (seenLemmas.has(lemma)) continue
      seenLemmas.add(lemma)
      if (known.has(lemma)) continue
      if (knownBand > 0 && token.b > 0 && token.b <= knownBand) continue
      unknown += 1
    }

    scored.push({ item, lemma, unknown })
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

  // Ten sam filtr w obrębie jednej partii: dwa zdania z tym samym słowem w luce nie mogą
  // wejść razem do sesji.
  const picked: DeckItem[] = []
  const taken = new Set<string>()
  for (const entry of scored) {
    if (taken.has(entry.lemma)) continue
    taken.add(entry.lemma)
    picked.push(entry.item)
    if (picked.length === limit) break
  }

  return picked
}

/**
 * Lematy, na które użytkownik ma już kartę — niezależnie od tego, jak dobrze je zna.
 * To NIE to samo co `knownLemmas`: tam chodzi o wiedzę (i+1), tutaj o to, żeby nie
 * wprowadzić drugi raz słowa, które jest już w harmonogramie.
 */
export function cardedLemmas(
  cards: readonly CardState[],
  items: ReadonlyMap<string, DeckItem>,
): Set<string> {
  const out = new Set<string>()
  for (const card of cards) {
    if (card.lemma) {
      out.add(card.lemma)
      continue
    }
    // Karty sprzed pola `lemma` — do odzyskania tylko wtedy, gdy zdanie i tak jest wczytane.
    const item = items.get(card.id)
    const target = item?.tokens[item.cloze]
    if (target) out.add(target.lemma ?? target.s.toLocaleLowerCase())
  }
  return out
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
    if (card.lemma) {
      known.add(card.lemma)
      continue
    }
    const item = items.get(card.id)
    const target = item?.tokens[item.cloze]
    if (target) known.add(target.lemma ?? target.s.toLocaleLowerCase())
  }
  return known
}
