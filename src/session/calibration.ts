import type { Lexicon } from '@/store/decks'
import type { GatedStage } from './stages'

/**
 * Kalibracja zasięgu słownictwa — sekcja 3.1 planu.
 *
 * Odpowiada na jedno pytanie: **dokąd sięga słownictwo użytkownika**. Nie jest testem
 * i nie stawia oceny — 25 pytań „znasz to słowo?" z odpowiedzią tak/nie/niepewny, minuta
 * pracy. Bez tego dobór zdań metodą i+1 nie ma od czego zacząć: każde zdanie wygląda
 * na pełne nowych słów i aplikacja przez pierwszy tydzień podaje materiał na chybił trafił.
 *
 * WYNIKIEM NIE JEST LISTA SŁÓW, tylko **granica pasma**. Dwadzieścia pięć odpowiedzi
 * nie wystarczy na listę, ale w zupełności wystarczy na granicę: częstość jest uporządkowana,
 * więc znajomość słowa o randze 3 000 mówi coś o wszystkich słowach częstszych. Zbiór
 * znanych lematów rośnie potem sam, z kart, które użytkownik rzeczywiście przerobił.
 */

export type Probe = {
  /** Lemat — identyfikator w leksykonie talii. */
  id: string
  /** Słowo w piśmie docelowym. */
  s: string
  band: number
}

export type Answer = 'known' | 'unsure' | 'unknown'

/** Ile pozycji ma kalibracja. Sekcja 3.1: „25 słów, trwa minutę". */
export const PROBE_COUNT = 25

/**
 * Odpowiedzi ważone. „Niepewny" liczy się za pół, bo w praktyce znaczy „widziałem,
 * nie użyję" — to jest połowa drogi do znajomości i zaokrąglanie tego w którąkolwiek
 * stronę psuje oszacowanie.
 *
 * Nazwy są `known` / `unknown`, a nie `yes` / `no`, bo reguła ESLint słusznie widzi
 * w literale `'no'` kod języka norweskiego. Nazwa opisowa jest tu i tak lepsza.
 */
const WEIGHT: Record<Answer, number> = { known: 1, unsure: 0.5, unknown: 0 }

/**
 * Ile odpowiedzi w paśmie musi wypaść na „tak", żeby uznać pasmo za pokryte.
 * Nie 100%: użytkownik ma prawo nie znać pojedynczego pospolitego słowa, a jeden
 * fałszywy „nie" nie może zawalić całego oszacowania.
 */
const COVERAGE = 0.7

/**
 * Sondy rozłożone logarytmicznie po paśmie. Rozkład równomierny byłby bezużyteczny:
 * różnica między rangą 100 a 600 jest dla uczącego się przepaścią, a między 11 000
 * a 11 500 — niczym.
 */
export function pickProbes(lexicon: Lexicon, maxBand: number, count = PROBE_COUNT): Probe[] {
  const entries = Object.entries(lexicon)
    .map(([id, entry]) => ({ id, s: entry.s, band: entry.b }))
    .filter((probe) => probe.band > 0 && probe.band <= maxBand)
    .sort((a, b) => a.band - b.band)

  if (entries.length === 0) return []

  const lowest = entries[0]!.band
  const highest = entries.at(-1)!.band
  const probes: Probe[] = []
  const used = new Set<string>()

  for (let i = 0; i < count; i++) {
    // Skala logarytmiczna od najczęstszego do najrzadszego słowa talii.
    const ratio = count === 1 ? 0 : i / (count - 1)
    const target = lowest * (highest / lowest) ** ratio

    // Najbliższa nieużyta pozycja. Liniowe przeszukanie jest tu tańsze niż indeks:
    // leksykon ma kilka tysięcy pozycji, a sond jest dwadzieścia pięć.
    let best: Probe | null = null
    let bestDistance = Infinity
    for (const entry of entries) {
      if (used.has(entry.id)) continue
      const distance = Math.abs(Math.log(entry.band) - Math.log(target))
      if (distance < bestDistance) {
        bestDistance = distance
        best = entry
      }
    }

    if (!best) break
    used.add(best.id)
    probes.push(best)
  }

  return probes.sort((a, b) => a.band - b.band)
}

/**
 * Granica znanego pasma: najdalsze pasmo, do którego pokrycie odpowiedziami „tak"
 * nie spadło poniżej progu.
 *
 * Idziemy od najczęstszych słów i pilnujemy pokrycia NARASTAJĄCO, a nie punktowo.
 * Punktowo wystarczyłby jeden szczęśliwy strzał w rzadkim paśmie, żeby uznać za znane
 * wszystko poniżej — a to jest dokładnie ten błąd, który zasypuje użytkownika materiałem
 * za trudnym i wygląda jak wada doboru zdań, nie kalibracji.
 */
export function estimateKnownBand(answers: ReadonlyArray<{ probe: Probe; answer: Answer }>): number {
  const sorted = [...answers].sort((a, b) => a.probe.band - b.probe.band)

  let score = 0
  let known = 0

  sorted.forEach((entry, index) => {
    score += WEIGHT[entry.answer]
    // Granica nie może stanąć na słowie, o którym użytkownik powiedział, że go nie zna.
    // Samo pokrycie na to pozwala — trzy „tak" i jedno „nie" to nadal 75% — więc bez
    // tego warunku pierwsze odrzucone słowo wpadało do zbioru znanych razem z całym
    // pasmem poniżej. Wyszło w teście, nie na karcie, i to jest jedyny powód, dla którego
    // ten warunek tu stoi.
    if (entry.answer !== 'unknown' && score / (index + 1) >= COVERAGE) known = entry.probe.band
  })

  return known
}

/** Poziom wejściowy — sekcja 3.1. Wybierany raz, przy dodaniu języka. */
export type Level = 'zero' | 'basics' | 'ok' | 'advanced'

export const LEVELS: ReadonlyArray<{
  id: Level
  label: string
  description: string
  bandFrom: number
  bandTo: number
  /**
   * Od którego etapu zaczynamy. NIE jest to blokada — etapy wcześniejsze uznajemy
   * za zaliczone, a późniejsze odblokowują się normalnie, bramą opanowania.
   *
   * Wcześniej stało tu `skipScript: boolean`, tłumaczone w kodzie ekranu na
   * `stageOverride: 'core'`. To był błąd o dwie warstwy głębszy, niż wyglądał:
   * `stageOverride` jest RĘCZNYM PRZYPIĘCIEM etapu, więc „Zaawansowany" nie tyle
   * pomijał pismo, ile przykuwał użytkownika na stałe do stu najczęstszych słów —
   * czyli do dokładnie tego materiału, którego ten poziom miał nie pokazywać.
   */
  startStage: GatedStage
  /** Czy uruchamiamy kalibrację. Przy „od zera" nie ma czego kalibrować. */
  calibrate: boolean
  /**
   * Domyślny tryb produkcji dla tego poziomu.
   *
   * Wybór jednej z czterech opcji sprawdza wiedzę BIERNĄ i da się go wyćwiczyć, nie
   * znając słowa — dla kogoś, kto zna język, jest to test zbyt łatwy, żeby czegokolwiek
   * uczyć. Konto zaawansowane odtwarza więc słowo z pamięci od razu, a nie dopiero
   * wtedy, gdy karta dojrzeje po trzech tygodniach.
   */
  production: 'mature' | 'always'
}> = [
  {
    id: 'zero',
    label: 'Zaczynam od zera',
    description: 'Od pisma i stu najczęstszych słów.',
    bandFrom: 1,
    bandTo: 500,
    startStage: 'script',
    calibrate: false,
    production: 'mature',
  },
  {
    id: 'basics',
    label: 'Znam podstawy',
    description: 'Pismo znam, słownictwa mam mało.',
    bandFrom: 1,
    bandTo: 1500,
    startStage: 'core',
    calibrate: true,
    production: 'mature',
  },
  {
    id: 'ok',
    label: 'Radzę sobie',
    description: 'Rozumiem proste zdania, brakuje mi zasięgu.',
    bandFrom: 500,
    bandTo: 4000,
    startStage: 'sentences',
    calibrate: true,
    production: 'mature',
  },
  {
    id: 'advanced',
    label: 'Zaawansowany',
    description: 'Szukam słów rzadkich. Odpowiadasz z pamięci, nie z listy.',
    bandFrom: 2000,
    bandTo: 12000,
    startStage: 'sentences',
    calibrate: true,
    production: 'always',
  },
]

export function levelById(id: Level): (typeof LEVELS)[number] {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0]!
}
