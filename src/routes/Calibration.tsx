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
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Mono tone="normal">wczytuję słownictwo…</Mono>
      </div>
    )
  }

  const probe = probes[at]
  if (!probe) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Mono tone="normal">zapisuję…</Mono>
      </div>
    )
  }

  const fontClass = { ui: 'font-ui', display: 'font-display', ja: 'font-ja', ko: 'font-ko' }[
    adapter.display.font
  ]

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col bg-bg">
      <header className="px-6 pt-[calc(env(safe-area-inset-top)+18px)]">
        <Progress total={probes.length} done={at} label={`słowo ${at + 1} z ${probes.length}`} />
        <div className="mt-[14px] flex items-center justify-between gap-3">
          <Mono>{adapter.name} · zasięg słownictwa</Mono>
          <Mono tone="normal">
            {at + 1} / {probes.length}
          </Mono>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-6 px-7 py-6">
        <p className={`${fontClass} text-center text-[54px] leading-[1.25] text-text`}>{probe.s}</p>
        <p className="font-ui text-center text-[14px] leading-[1.6] text-text-2">
          Znasz to słowo? Nie sprawdzamy Cię — szukamy tylko miejsca, od którego zacząć.
        </p>
      </main>

      <div className="flex flex-col gap-[10px] px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
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
