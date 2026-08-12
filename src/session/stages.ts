import { stagesFor, type LangAdapter, type Stage } from '@/langs'
import type { CardState } from '@/srs/types'
import type { DeckMeta } from '@/store/decks'

/**
 * Etapy nauki i brama między nimi — sekcja 2a planu.
 *
 * **Opanowany = 90% pozycji etapu ma `interval >= 7` dni.** Mianownikiem jest liczebność
 * etapu w talii, a nie liczba kart użytkownika — inaczej konto bez ani jednej karty
 * spełniałoby warunek (0 z 0 to 100%) i brama przepuszczałaby wszystkich od razu.
 *
 * Etap 3 (produkcja) nie jest tu obecny celowo: to nie jest brama, przez którą przechodzi
 * język, tylko tryb, w który wchodzi pojedyncza dojrzała karta.
 */

/** Ile dni interwału znaczy „to już siedzi". */
export const MASTERY_INTERVAL = 7

/** Jaki odsetek etapu musi tam dojść. */
export const MASTERY_SHARE = 0.9

/** Etapy, przez które prowadzimy: produkcja jest trybem karty, nie bramą języka. */
export type GatedStage = Extract<Stage, 'script' | 'core' | 'sentences'>

export function gatedStages(adapter: LangAdapter): GatedStage[] {
  return stagesFor(adapter).filter((stage): stage is GatedStage => stage !== 'production')
}

/** Ile pozycji liczy etap w talii. Zdania są niewyczerpalne, więc bramy za nimi nie ma. */
export function stageSize(meta: DeckMeta, stage: GatedStage): number {
  if (stage === 'script') return meta.script ?? 0
  if (stage === 'core') return meta.core ?? 0
  return meta.sentences
}

export function isMastered(cards: readonly CardState[], meta: DeckMeta, stage: GatedStage): boolean {
  const size = stageSize(meta, stage)
  if (size === 0) return true

  const solid = cards.filter(
    (card) => card.stage === stage && !card.suspended && card.interval >= MASTERY_INTERVAL,
  ).length
  return solid >= size * MASTERY_SHARE
}

/**
 * Etap, na którym stoi użytkownik: pierwszy nieopanowany. Zdania są ostatnim etapem
 * z bramą, więc gdy wszystko wcześniejsze jest opanowane, zostajemy na nich na stałe.
 */
export function currentStage(
  adapter: LangAdapter,
  cards: readonly CardState[],
  meta: DeckMeta,
  override: GatedStage | null = null,
): GatedStage {
  const stages = gatedStages(adapter)
  if (override && stages.includes(override)) return override

  for (const stage of stages) {
    if (!isMastered(cards, meta, stage)) return stage
  }
  return stages.at(-1) ?? 'sentences'
}

/** Postęp etapu do pokazania na ekranie startu: ile pozycji siedzi, ile trzeba. */
export function stageProgress(
  cards: readonly CardState[],
  meta: DeckMeta,
  stage: GatedStage,
): { solid: number; needed: number } {
  const size = stageSize(meta, stage)
  const solid = cards.filter(
    (card) => card.stage === stage && !card.suspended && card.interval >= MASTERY_INTERVAL,
  ).length
  return { solid, needed: Math.ceil(size * MASTERY_SHARE) }
}
