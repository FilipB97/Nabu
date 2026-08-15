import { useCallback, useEffect, useRef, useState } from 'react'
import { en, de, ja, LANG_CODES, adapterFor } from '@/langs'
import { Mono } from '@/ui/Mono'

/**
 * Sonda mowy z mikrofonu — materiał do `docs/ADR-003-mowa.md`.
 *
 * Pytanie brzmi „czy da się oceniać wymowę", a odpowiedź zależy od trzech rzeczy,
 * których nie da się sprawdzić na desktopie i których żadna dokumentacja nie mówi
 * pewnie dla PWA na iOS:
 *
 * 1. **Czy `SpeechRecognition` w ogóle istnieje** na tym urządzeniu i czy działa
 *    z ikony na ekranie głównym, a nie tylko w Safari. To samo pytanie co przy
 *    ADR-001, bo to ta sama pułapka: standalone bywa innym środowiskiem niż karta.
 * 2. **Czy mikrofon jest dostępny w standalone.** `getUserMedia` w PWA na iOS było
 *    zepsute do 14.3 i nadal potrafi zwrócić strumień bez ścieżek dźwięku.
 * 3. **Czy z nagrania da się wyciągnąć wysokość dźwięku.** To jest osobna ścieżka
 *    niż rozpoznawanie tekstu: kontur F0 wystarcza do oceny TONU po chińsku i liczy
 *    się lokalnie, bez sieci i bez modelu, w dwustu linijkach.
 *
 * Sonda niczego nie ocenia. Zbiera fakty, na których dopiero da się oprzeć decyzję,
 * bo każda z trzech ścieżek kosztuje inaczej — od jednego dnia do kilku tygodni.
 */

type Probe = { label: string; value: string }

/** Konstruktor rozpoznawania mowy; w Safari i Chrome nadal pod prefiksem. */
type RecognitionCtor = new () => SpeechRecognitionLike

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>>
}

function recognitionCtor(): RecognitionCtor | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

/**
 * Częstotliwość podstawowa metodą autokorelacji.
 *
 * Prosta i wystarczająca: nie potrzebujemy dokładności do herca, tylko KSZTAŁTU —
 * czy głos idzie w górę, w dół, czy siada i wraca. Właśnie tym różnią się chińskie
 * tony, więc ta jedna funkcja odpowiada na pytanie, czy ocena tonu jest wykonalna
 * offline. Zwraca `null` dla ciszy i dla fragmentów bezdźwięcznych.
 */
function pitchOf(samples: Float32Array, rate: number): number | null {
  const SIZE = samples.length
  let power = 0
  for (const sample of samples) power += sample * sample
  if (Math.sqrt(power / SIZE) < 0.01) return null

  // Interesuje nas zakres głosu ludzkiego: 70–400 Hz.
  const minLag = Math.floor(rate / 400)
  const maxLag = Math.floor(rate / 70)

  let bestLag = -1
  let bestScore = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0
    for (let i = 0; i < SIZE - lag; i++) score += samples[i]! * samples[i + lag]!
    score /= SIZE - lag
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }

  if (bestLag < 0 || bestScore < 0.002) return null
  return Math.round(rate / bestLag)
}

export function SpeechTest() {
  const [probes, setProbes] = useState<Probe[]>([])
  const [log, setLog] = useState<string[]>([])
  const [contour, setContour] = useState<(number | null)[]>([])
  const [recording, setRecording] = useState(false)
  const audio = useRef<string | null>(null)

  const note = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString('pl-PL')
    setLog((l) => [`${stamp} ${line}`, ...l])
  }, [])

  useEffect(() => {
    const Recognition = recognitionCtor()
    const media = navigator.mediaDevices as MediaDevices | undefined
    setProbes([
      { label: 'SpeechRecognition', value: Recognition ? 'dostępne' : 'BRAK' },
      { label: 'getUserMedia', value: media?.getUserMedia ? 'dostępne' : 'BRAK' },
      {
        label: 'MediaRecorder',
        value: typeof MediaRecorder === 'undefined' ? 'BRAK' : 'dostępne',
      },
      {
        label: 'tryb wyświetlania',
        value: matchMedia('(display-mode: standalone)').matches
          ? 'standalone (z ikony)'
          : 'przeglądarka',
      },
      { label: 'online', value: navigator.onLine ? 'tak' : 'nie' },
    ])
  }, [])

  /** Krok 1: czy rozpoznawanie w ogóle rusza i co zwraca. */
  const listen = useCallback(
    (code: string) => {
      const Recognition = recognitionCtor()
      if (!Recognition) {
        note('SpeechRecognition: BRAK — ta ścieżka odpada na tym urządzeniu')
        return
      }
      const { tts, name } = adapterFor(code)
      const recognition = new Recognition()
      recognition.lang = tts.locale
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 3

      recognition.onresult = (event) => {
        const alternatives = event.results[0]
        if (!alternatives) return
        for (let i = 0; i < alternatives.length; i++) {
          const guess = alternatives[i]
          if (!guess) continue
          note(`${name}: „${guess.transcript}" (pewność ${guess.confidence.toFixed(2)})`)
        }
      }
      recognition.onerror = (event) => note(`${name}: BŁĄD ${event.error}`)
      recognition.onend = () => note(`${name}: koniec nasłuchu`)

      note(`${name} (${tts.locale}): start nasłuchu — mów teraz`)
      recognition.start()
    },
    [note],
  )

  /** Krok 2: nagranie, odsłuch i kontur wysokości — bez sieci i bez modelu. */
  const record = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      note(`mikrofon: ścieżek dźwięku ${stream.getAudioTracks().length}`)
      setRecording(true)

      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (event) => chunks.push(event.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)

        const blob = new Blob(chunks, { type: recorder.mimeType })
        if (audio.current) URL.revokeObjectURL(audio.current)
        audio.current = URL.createObjectURL(blob)
        note(`nagranie: ${Math.round(blob.size / 1024)} kB, typ ${recorder.mimeType || 'nieznany'}`)

        const AudioCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioCtor) return
        const context = new AudioCtor()
        const decoded = await context.decodeAudioData(await blob.arrayBuffer())
        const data = decoded.getChannelData(0)

        // Okno 40 ms co 20 ms — dość gęsto, żeby zobaczyć ruch głosu w sylabie.
        const window40 = Math.floor(decoded.sampleRate * 0.04)
        const step = Math.floor(decoded.sampleRate * 0.02)
        const points: (number | null)[] = []
        for (let at = 0; at + window40 < data.length; at += step) {
          points.push(pitchOf(data.slice(at, at + window40), decoded.sampleRate))
        }
        setContour(points)
        const voiced = points.filter((p): p is number => p !== null)
        note(
          voiced.length
            ? `wysokość: ${Math.min(...voiced)}–${Math.max(...voiced)} Hz w ${voiced.length} oknach`
            : 'wysokość: nie wykryto dźwięcznych fragmentów',
        )
        void context.close()

        new Audio(audio.current).play().catch(() => note('odsłuch: nie udało się odtworzyć'))
      }

      recorder.start()
      setTimeout(() => recorder.stop(), 3000)
    } catch (error) {
      setRecording(false)
      note(`mikrofon: BŁĄD ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [note])

  const voiced = contour.filter((p): p is number => p !== null)
  const low = voiced.length ? Math.min(...voiced) : 0
  const span = voiced.length ? Math.max(...voiced) - low || 1 : 1

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8 py-4 text-text">
      <div className="flex flex-col gap-3">
        <Mono tone="accent">sonda mowy · ADR-003</Mono>
        <h1 className="font-display text-[26px] leading-[1.3]">
          Czy da się słuchać użytkownika na tym urządzeniu?
        </h1>
        <p className="font-ui text-[14px] leading-[1.6] text-text-2">
          Sprawdź w Safari, potem dodaj aplikację do ekranu głównego i powtórz z ikony. Wynik
          wpisz do <span className="font-mono text-text-3">docs/ADR-003-mowa.md</span>.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Mono>1. rozpoznawanie mowy — powiedz zdanie w tym języku</Mono>
        {[en, de, ja].map((adapter) => (
          <button
            key={adapter.code}
            type="button"
            onClick={() => listen(adapter.code)}
            className="flex min-h-[62px] items-center justify-between border border-border px-[18px] text-start"
          >
            <span className="font-ui text-[15px]">{adapter.name}</span>
            <span className="font-mono text-[12px] text-text-2">{adapter.tts.locale}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Mono>2. mikrofon i wysokość dźwięku — trzy sekundy, potem odsłuch</Mono>
        <button
          type="button"
          onClick={() => void record()}
          disabled={recording}
          className="flex min-h-[62px] items-center justify-between border border-border px-[18px] text-start"
        >
          <span className="font-ui text-[15px]">{recording ? 'nagrywam…' : 'nagraj 3 sekundy'}</span>
          <span className="font-mono text-[12px] text-text-2">
            {LANG_CODES.length} języków w aplikacji
          </span>
        </button>

        {voiced.length > 0 && (
          <div className="flex h-[64px] items-end gap-[2px] border border-border-quiet p-2">
            {contour.map((point, i) => (
              <span
                key={i}
                className={point === null ? 'w-[3px] bg-tick-future' : 'w-[3px] bg-accent'}
                style={{ height: point === null ? '2px' : `${((point - low) / span) * 44 + 4}px` }}
              />
            ))}
          </div>
        )}
      </div>

      <dl className="flex flex-col gap-3 border-t border-border-quiet pt-6">
        {probes.map((probe) => (
          <div key={probe.label} className="flex flex-wrap justify-between gap-2">
            <dt>
              <Mono tone="normal">{probe.label}</Mono>
            </dt>
            <dd className="font-mono text-[12px] text-text">{probe.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2 border-t border-border-quiet pt-6">
        <Mono>dziennik zdarzeń</Mono>
        {log.length === 0 ? (
          <p className="font-ui text-[13px] text-text-3">Nic jeszcze nie sprawdzono.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {log.map((line, i) => (
              <li key={i} className="font-mono text-[12px] text-text-2">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
