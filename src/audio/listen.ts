/**
 * Nasłuch mikrofonu — druga strona warstwy dźwięku (ADR-003).
 *
 * `speak.ts` mówi do użytkownika, ten plik go słucha. Rozdzielone, bo to dwa różne
 * interfejsy przeglądarki o różnej dostępności: synteza jest wszędzie, rozpoznawanie
 * bywa nieobecne i w Safari, i w Chrome na Linuksie, a w PWA na iOS trzeba je sprawdzić
 * osobno (sonda `#/mowa`).
 *
 * **Czego to NIE robi: nie ocenia wymowy.** Zwraca transkrypcję, czyli odpowiedź na
 * pytanie „czy maszyna mnie zrozumiała". Modele rozpoznawania są trenowane tak, żeby
 * rozumieć mówiących z akcentem, więc nie odróżnią wymowy dobrej od zrozumiałej.
 * Interfejs musi mówić o tym wprost — obiecywanie oceny akcentu byłoby kłamstwem
 * wbudowanym w kartę.
 */

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  abort: () => void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type RecognitionCtor = new () => SpeechRecognitionLike

function ctor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

/**
 * Czy karta mówienia ma się w ogóle pojawić.
 *
 * Wymagamy też sieci: Safari i Chrome wysyłają dźwięk na serwer, więc offline karta
 * skończyłaby się błędem po trzech sekundach nasłuchu. Lepiej jej wtedy nie pokazywać,
 * niż pokazać i zawieść — aplikacja ma działać w samolocie, tylko bez tej jednej rzeczy.
 */
export function canRecognize(): boolean {
  return ctor() !== undefined && (typeof navigator === 'undefined' || navigator.onLine)
}

export type Heard = {
  /** Wszystkie warianty od najlepszego. Porównanie bierze najlepszy PASUJĄCY, nie pierwszy. */
  alternatives: string[]
}

export class RecognitionError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'RecognitionError'
  }
}

/**
 * Jedno podejście: słucha do pierwszej pauzy i zwraca warianty transkrypcji.
 *
 * `maxAlternatives` większe od jednego jest tu istotne. Przy pojedynczym słowie bez
 * kontekstu rozpoznawanie często stawia na pierwszym miejscu wariant, który brzmi
 * podobnie, a właściwy ląduje drugi — odrzucenie go byłoby karą za działanie modelu,
 * nie za wymowę użytkownika.
 */
export function listenOnce(locale: string, timeoutMs = 8000): Promise<Heard> {
  const Recognition = ctor()
  if (!Recognition) return Promise.reject(new RecognitionError('brak-rozpoznawania'))

  return new Promise<Heard>((resolve, reject) => {
    const recognition = new Recognition()
    recognition.lang = locale
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 5

    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    // Bez własnego zegara nasłuch potrafi wisieć w nieskończoność, gdy mikrofon jest
    // wyciszony: `onend` nie przychodzi, `onerror` też nie.
    const timer = setTimeout(() => {
      recognition.abort()
      finish(() => reject(new RecognitionError('cisza')))
    }, timeoutMs)

    recognition.onresult = (event) => {
      const first = event.results[0]
      const alternatives: string[] = []
      for (let i = 0; first && i < first.length; i++) {
        const guess = first[i]
        if (guess) alternatives.push(guess.transcript)
      }
      finish(() => resolve({ alternatives }))
    }

    recognition.onerror = (event) => {
      recognition.abort()
      finish(() => reject(new RecognitionError(event.error)))
    }

    recognition.onend = () => {
      finish(() => reject(new RecognitionError('cisza')))
    }

    recognition.start()
  })
}

/** Komunikat dla użytkownika. Kod błędu z przeglądarki nikomu nic nie mówi. */
export function explain(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Brak zgody na mikrofon. Włącz ją w ustawieniach przeglądarki i spróbuj ponownie.'
  }
  if (code === 'no-speech' || code === 'cisza') return 'Nic nie usłyszałem. Spróbuj jeszcze raz.'
  if (code === 'network') return 'Rozpoznawanie mowy wymaga sieci — offline ta karta nie zadziała.'
  if (code === 'brak-rozpoznawania') return 'To urządzenie nie ma rozpoznawania mowy.'
  return `Nie udało się nasłuchiwać (${code}).`
}
