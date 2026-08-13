import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { adapterFor } from '@/langs'
import {
  PROBE_COUNT,
  estimateKnownBand,
  pickProbes,
  type Answer,
  type Probe,
} from '@/session/calibration'
import { loadLexicon } from '@/store/decks'
import { settingsFor, updateSettings } from '@/store/db'
import { Button } from '@/ui/Button'
import { Mono } from '@/ui/Mono'
import { Progress } from '@/ui/Ticks'

/**
 * Kalibracja zasięgu słownictwa — sekcja 3.1 planu, M7.
 *
 * **To nie jest test i nie wolno go tak pokazać.** Nie ma dobrych i złych odpowiedzi,
 * nie ma wyniku, nie ma pasków postępu z procentami. Jest dwadzieścia pięć słów i jedno
 * pytanie: znasz to słowo? Użytkownik, który poczuje się egzaminowany, zacznie zgadywać
 * na korzyść — a wtedy dostanie materiał za trudny i porzuci aplikację, nie wiedząc dlaczego.
 *
 * Dlatego: brak licznika trafień, brak informacji zwrotnej po odpowiedzi, jawne
 * „możesz pominąć" i zdanie o tym, po co to jest.
 */

export function Calibration() {
  const { lang = '' } = useParams()
  const navigate = useNavigate()
  const adapter = adapterFor(lang)

  const [probes, setProbes] = useState<Probe[] | null>(null)
  const [at, setAt] = useState(0)
  const [answers, setAnswers] = useState<{ probe: Probe; answer: Answer }[]>([])

  useEffect(() => {
    let cancelled = false
    void loadLexicon(lang).then((lexicon) => {
      if (!cancelled) setProbes(pickProbes(lexicon, adapter.maxBand, PROBE_COUNT))
    })
    return () => {
      cancelled = true
    }
  }, [lang, adapter])

  const finish = useCallback(
    async (collected: { probe: Probe; answer: Answer }[]) => {
      const knownBand = estimateKnownBand(collected)
      const settings = await settingsFor(lang)
      await updateSettings(lang, {
        knownBand,
        calibrated: true,
        // Pasmo doboru startuje od granicy znajomości: uczyć trzeba tego, czego
        // użytkownik jeszcze nie zna, a nie tego, co już umie.
        bandFrom: Math.max(settings.bandFrom, knownBand + 1),
        bandTo: Math.max(settings.bandTo, knownBand + 1500),
      })
      navigate('/start', { replace: true })
    },
    [lang, navigate],
  )

  const answer = useCallback(
    (value: Answer) => {
      if (!probes) return
      const probe = probes[at]
      if (!probe) return

      const collected = [...answers, { probe, answer: value }]
      setAnswers(collected)

      if (at + 1 >= probes.length) void finish(collected)
      else setAt(at + 1)
    },
    [answers, at, probes, finish],
  )

  const skip = useCallback(async () => {
    // Pominięcie nie jest tym samym co odpowiedź „nie znam" na wszystko: zostawiamy
    // pasmo z poziomu wejściowego i zapisujemy, że pytania już nie wrócą.
    await updateSettings(lang, { calibrated: true })
    navigate('/start', { replace: true })
  }, [lang, navigate])

  if (!probes) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Mono tone="normal">wczytuję słownictwo…</Mono>
      </div>
    )
  }

  const probe = probes[at]
  if (!probe) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Mono tone="normal">zapisuję…</Mono>
      </div>
    )
  }

  const fontClass = { ui: 'font-ui', display: 'font-display', ja: 'font-ja', ko: 'font-ko' }[
    adapter.display.font
  ]

  return (
    <div className="flex flex-1 flex-col gap-5 pb-[env(safe-area-inset-bottom)]">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/start')}
            className="nabu-press font-mono flex min-h-[44px] items-center gap-2 rounded-[10px]
              border border-border-quiet px-3 text-[11px] tracking-[0.12em] text-text-2 uppercase"
          >
            ‹ Przerwij
          </button>
          <Mono tone="normal" className="hidden sm:block">
            {adapter.name} · zasięg
          </Mono>
          <Mono tone="normal">
            {at + 1} / {probes.length}
          </Mono>
        </div>
        <Progress total={probes.length} done={at} label={`słowo ${at + 1} z ${probes.length}`} />
      </header>

      <section
        className="nabu-card flex flex-col items-center justify-center gap-5 rounded-[22px]
          px-6 py-10 min-h-[240px] md:min-h-[280px]"
      >
        <p
          className={`${fontClass} text-center leading-[1.25] text-text
            text-[clamp(48px,10vw,72px)]`}
        >
          {probe.s}
        </p>
        <p className="font-ui max-w-[440px] text-center text-[14px] leading-[1.6] text-text-2">
          Znasz to słowo? Nie sprawdzamy Cię — szukamy tylko miejsca, od którego zacząć.
        </p>
      </section>

      <div className="mt-auto flex flex-col gap-[10px] pt-2">
        <div className="flex gap-[10px]">
          <Button full onClick={() => answer('unknown')}>
            Nie
          </Button>
          <Button full onClick={() => answer('unsure')}>
            Niepewnie
          </Button>
          <Button variant="primary" full onClick={() => answer('known')}>
            Tak
          </Button>
        </div>
        <Button variant="ghost" full onClick={() => void skip()}>
          pomiń kalibrację
        </Button>
      </div>
    </div>
  )
}
