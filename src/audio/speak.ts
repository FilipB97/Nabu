/**
 * Warstwa mowy — sekcja 11 planu i M5.
 *
 * Jeden interfejs `speak(text, opts)` przed całą resztą aplikacji. Nie dlatego, że
 * spodziewamy się zmiany ścieżki — `speechSynthesis` jest rozstrzygnięty w ADR-001 —
 * tylko dlatego, że tempo mowy jest jednocześnie parametrem adaptera i ustawieniem
 * użytkownika, a wybór głosu wymaga wiedzy, której komponent nie ma mieć.
 *
 * Trzy rzeczy, które w tej warstwie muszą działać, bo inaczej dźwięk zawodzi cicho:
 *
 * 1. **Lista głosów zapełnia się asynchronicznie.** Safari zwraca z `getVoices()` pustą
 *    tablicę przy pierwszym wywołaniu i dosyła głosy zdarzeniem `voiceschanged`.
 *    Pytanie „czy jest głos japoński" zadane za wcześnie odpowiada „nie".
 * 2. **iOS wymaga gestu.** Pierwsze `speak()` musi wyjść z dotknięcia użytkownika,
 *    inaczej kolejne wywołania programowe są ignorowane — bez błędu, bez zdarzenia.
 *    Stąd `primeSpeech()`, wołane z przycisku „Zacznij".
 * 3. **Wypowiedź trzeba przerwać, zanim zacznie się następna.** Bez `cancel()` szybkie
 *    przejścia między kartami ustawiają wypowiedzi w kolejce i użytkownik słyszy zdanie
 *    sprzed trzech kart.
 */

export type SpeakOptions = {
  /** Kod BCP 47 z adaptera, np. `ja-JP`. */
  locale: string
  /** Tempo 0.3–1.0. Adapter podaje domyślne, użytkownik może zmienić. */
  rate: number
}

/** Czy przeglądarka w ogóle ma syntezę mowy. */
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Głosy pasujące do locale, od najlepszego. Dopasowanie jest dwustopniowe: najpierw pełny
 * kod (`ja-JP`), potem sam język (`ja`). Drugi stopień jest konieczny, bo systemy podają
 * warianty regionalne, których nie da się przewidzieć — `zh-CN` bywa `zh-Hans-CN`.
 */
export function voicesFor(locale: string): SpeechSynthesisVoice[] {
  if (!speechSupported()) return []
  const all = window.speechSynthesis.getVoices()
  const exact = all.filter((voice) => voice.lang.replace('_', '-') === locale)
  if (exact.length > 0) return exact

  const language = locale.slice(0, 2).toLowerCase()
  return all.filter((voice) => voice.lang.slice(0, 2).toLowerCase() === language)
}

/**
 * Czy system ma czym przeczytać ten język. Wynik zmienia się w czasie — na iOS głosy
 * pobiera się na żądanie — więc pytający powinien nasłuchiwać `onVoicesChanged`.
 */
export function hasVoice(locale: string): boolean {
  return voicesFor(locale).length > 0
}

/** Subskrypcja zmian listy głosów. Zwraca funkcję odsubskrybowania. */
export function onVoicesChanged(listener: () => void): () => void {
  if (!speechSupported()) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', listener)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', listener)
}

/**
 * Odblokowanie syntezy pierwszym gestem użytkownika. Pusta wypowiedź nie jest słyszalna,
 * ale przestawia iOS w stan, w którym późniejsze wywołania programowe działają.
 * Wołane z przycisku rozpoczynającego sesję — jedynego dotknięcia, które na pewno
 * poprzedza jakiekolwiek czytanie.
 */
export function primeSpeech(): void {
  if (!speechSupported()) return
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
  } catch {
    // Brak mowy nie jest powodem, żeby sesja się nie zaczęła.
  }
}

export function stopSpeaking(): void {
  if (!speechSupported()) return
  window.speechSynthesis.cancel()
}

/**
 * Czyta tekst i kończy się, gdy wypowiedź dobiegnie końca — albo natychmiast, gdy nie ma
 * czym czytać. Obietnica NIGDY nie jest odrzucana: brak głosu to stan aplikacji,
 * a nie wyjątek, i wywołujący ma go obsłużyć widokiem, nie blokiem `catch`.
 */
export function speak(text: string, { locale, rate }: SpeakOptions): Promise<void> {
  if (!speechSupported() || text.length === 0) return Promise.resolve()

  stopSpeaking()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = locale
  utterance.rate = rate

  const voice = voicesFor(locale)[0]
  if (voice) utterance.voice = voice

  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    utterance.onend = finish
    utterance.onerror = finish

    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      finish()
    }
  })
}
