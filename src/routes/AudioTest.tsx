import { useCallback, useEffect, useState } from 'react'
import { es, ja, ko, LANG_CODES, adapterFor } from '@/langs'
import { Mono } from '@/ui/Mono'

/**
 * Test warstwy dźwięku — sekcja 11 planu, bramka M0.
 *
 * Są zgłoszenia, że w PWA dodanym do ekranu głównego na iOS odtwarzanie audio
 * przestaje działać, mimo że w Safari działa poprawnie (`AudioContext` zostaje
 * w stanie `suspended`). Dla aplikacji do nauki wymowy to ryzyko krytyczne, a wynik
 * decyduje o kształcie pipeline'u — dlatego test stoi w M0, nie przed M5.
 *
 * Sposób użycia: otwórz tę stronę w Safari, sprawdź wszystkie trzy języki, potem dodaj
 * aplikację do ekranu głównego i powtórz. Wynik przepisz do `docs/ADR-001-audio.md`.
 */

type Probe = { label: string; value: string }

function useProbes(): Probe[] {
  const [probes, setProbes] = useState<Probe[]>([])

  useEffect(() => {
    const read = () => {
      const synth = window.speechSynthesis as SpeechSynthesis | undefined
      const voices = synth?.getVoices() ?? []
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      let contextState = 'brak AudioContext'
      if (AudioCtor) {
        const context = new AudioCtor()
        contextState = context.state
        void context.close()
      }

      setProbes([
        { label: 'speechSynthesis', value: synth ? 'dostępne' : 'BRAK' },
        { label: 'AudioContext po starcie', value: contextState },
        { label: 'głosów w systemie', value: String(voices.length) },
        ...LANG_CODES.map((code) => {
          const { tts, name } = adapterFor(code)
          const matching = voices.filter((voice) => voice.lang.startsWith(tts.locale.slice(0, 2)))
          return {
            label: `głos dla: ${name}`,
            value: matching.length
              ? matching.map((voice) => voice.name).join(', ')
              : 'BRAK — sekcja 14, ryzyko „brak głosu TTS"',
          }
        }),
        {
          label: 'tryb wyświetlania',
          value: matchMedia('(display-mode: standalone)').matches
            ? 'standalone (dodane do ekranu głównego)'
            : 'przeglądarka',
        },
      ])
    }

    read()
    // Safari zapełnia listę głosów asynchronicznie — bez tego zdarzenia lista bywa pusta.
    window.speechSynthesis?.addEventListener('voiceschanged', read)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', read)
  }, [])

  return probes
}

export function AudioTest() {
  const [log, setLog] = useState<string[]>([])
  const probes = useProbes()

  const say = useCallback((code: string, text: string) => {
    const { tts, name } = adapterFor(code)
    const stamp = new Date().toLocaleTimeString('pl-PL')
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = tts.locale
    utterance.rate = tts.rate
    utterance.onstart = () => setLog((l) => [`${stamp} ${name}: start`, ...l])
    utterance.onend = () => setLog((l) => [`${stamp} ${name}: koniec`, ...l])
    utterance.onerror = (event) => setLog((l) => [`${stamp} ${name}: BŁĄD ${event.error}`, ...l])
    setLog((l) => [`${stamp} ${name}: wywołano speak()`, ...l])
    window.speechSynthesis.speak(utterance)
  }, [])

  const samples = [
    { adapter: ja, text: '水をください。' },
    { adapter: ko, text: '물 좀 주세요.' },
    { adapter: es, text: 'Necesito un poco de agua ahora.' },
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-[640px] flex-col gap-8 bg-bg px-6 py-12 text-text">
      <div className="flex flex-col gap-3">
        <Mono tone="accent">test dźwięku · sekcja 11 planu</Mono>
        <h1 className="font-display text-[26px] leading-[1.3]">
          Czy mowa działa w zainstalowanym PWA?
        </h1>
        <p className="font-ui text-[14px] leading-[1.6] text-text-2">
          Sprawdź trzy przyciski w Safari, potem dodaj aplikację do ekranu głównego i powtórz. Wynik
          wpisz do <span className="font-mono text-text-3">docs/ADR-001-audio.md</span>.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {samples.map(({ adapter, text }) => (
          <button
            key={adapter.code}
            type="button"
            onClick={() => say(adapter.code, text)}
            className="flex min-h-[62px] items-center justify-between border border-border px-[18px] text-start"
          >
            <span className="font-ui text-[15px]">{adapter.name}</span>
            <span className="font-mono text-[12px] text-text-2">{adapter.tts.locale}</span>
          </button>
        ))}
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
          <p className="font-ui text-[13px] text-text-3">Nic jeszcze nie odtworzono.</p>
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
