import { describe, expect, it } from 'vitest'
import type { Lexicon } from '@/store/decks'
import { PROBE_COUNT, estimateKnownBand, pickProbes, type Probe } from './calibration.ts'

/**
 * Kalibracja — sekcja 3.1 planu, M7.
 *
 * Dwie rzeczy warte testu, bo obie łatwo zepsuć w sposób niewidoczny: rozkład sond
 * po paśmie i sposób, w jaki z odpowiedzi powstaje granica.
 */

const LEXICON: Lexicon = Object.fromEntries(
  Array.from({ length: 4000 }, (_, i) => [
    `w${i + 1}`,
    { s: `słowo${i + 1}`, pl: `glosa${i + 1}`, pos: 'noun', b: i + 1 },
  ]),
)

const probe = (band: number): Probe => ({ id: `w${band}`, s: `słowo${band}`, band })

describe('dobór sond kalibracji', () => {
  it('daje żądaną liczbę różnych słów', () => {
    const probes = pickProbes(LEXICON, 4000)
    expect(probes).toHaveLength(PROBE_COUNT)
    expect(new Set(probes.map((p) => p.id)).size).toBe(PROBE_COUNT)
  })

  it('rozkłada je logarytmicznie, nie równomiernie', () => {
    const probes = pickProbes(LEXICON, 4000)
    // Połowa sond ma trafić w pierwszy tysiąc rang. Przy rozkładzie równomiernym
    // byłaby to jedna czwarta, a kalibracja nie odróżniałaby początkującego
    // od średnio zaawansowanego — czyli tego, po co w ogóle istnieje.
    const easy = probes.filter((p) => p.band <= 1000).length
    expect(easy).toBeGreaterThanOrEqual(probes.length / 2)
  })

  it('nie wychodzi poza próg pasma języka', () => {
    const probes = pickProbes(LEXICON, 500)
    expect(Math.max(...probes.map((p) => p.band))).toBeLessThanOrEqual(500)
  })

  it('pusty leksykon nie wywraca kalibracji', () => {
    expect(pickProbes({}, 4000)).toEqual([])
  })
})

describe('oszacowanie granicy znajomości', () => {
  it('same odpowiedzi „nie znam" dają zero, czyli nic nie zakładamy', () => {
    const answers = [100, 500, 2000].map((b) => ({ probe: probe(b), answer: 'unknown' as const }))
    expect(estimateKnownBand(answers)).toBe(0)
  })

  it('granica idzie tam, gdzie kończą się odpowiedzi twierdzące', () => {
    const answers = [
      { probe: probe(100), answer: 'known' as const },
      { probe: probe(400), answer: 'known' as const },
      { probe: probe(900), answer: 'known' as const },
      { probe: probe(2500), answer: 'unknown' as const },
      { probe: probe(6000), answer: 'unknown' as const },
    ]
    expect(estimateKnownBand(answers)).toBe(900)
  })

  it('pojedynczy fałszywy „nie" nie zawala oszacowania', () => {
    const answers = [
      { probe: probe(100), answer: 'known' as const },
      { probe: probe(200), answer: 'unknown' as const },
      { probe: probe(300), answer: 'known' as const },
      { probe: probe(400), answer: 'known' as const },
      { probe: probe(500), answer: 'known' as const },
    ]
    expect(estimateKnownBand(answers)).toBe(500)
  })

  it('trafienie w rzadkim paśmie nie unieważnia niewiedzy w częstym', () => {
    // To jest cały powód, dla którego pokrycie liczymy narastająco. Punktowo jedno
    // „tak" przy randze 9 000 uznałoby za znane wszystko poniżej.
    const answers = [
      { probe: probe(100), answer: 'unknown' as const },
      { probe: probe(300), answer: 'unknown' as const },
      { probe: probe(9000), answer: 'known' as const },
    ]
    expect(estimateKnownBand(answers)).toBe(0)
  })

  it('„niepewnie" liczy się za pół', () => {
    const half = [
      { probe: probe(100), answer: 'unsure' as const },
      { probe: probe(200), answer: 'unsure' as const },
    ]
    // Pół punktu na pozycję to 50% pokrycia, czyli poniżej progu 70%.
    expect(estimateKnownBand(half)).toBe(0)

    const mixed = [
      { probe: probe(100), answer: 'known' as const },
      { probe: probe(200), answer: 'unsure' as const },
      { probe: probe(300), answer: 'known' as const },
      { probe: probe(400), answer: 'known' as const },
    ]
    expect(estimateKnownBand(mixed)).toBe(400)
  })
})
