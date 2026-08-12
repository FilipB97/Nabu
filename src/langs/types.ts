/**
 * Kontrakt adaptera językowego — sekcja 2.1 planu.
 *
 * Rdzeń nie wie, jakiego języka uczy. Cała wiedza o języku siedzi w `src/langs/{code}/`
 * i w danych wyprodukowanych przez build. Dodanie języka klasy A to nowy katalog,
 * przebieg builda i ręcznie przetłumaczony rdzeń słownictwa — zero zmian w silniku,
 * zero zmian w komponentach.
 *
 * Reguła ESLint pilnuje, żeby kod języka nie wyciekł poza ten katalog.
 */

/** Sposób podziału tekstu na tokeny — sekcja 10.1a. */
export type Tokenizer = 'space' | 'dict' | 'morph'

/**
 * Wtyczka podobieństwa kształtu przy doborze dystraktorów — sekcja 10.1b.
 * Dobiera błędne opcje quizu tak, żeby myliły się realnie, a nie losowo.
 */
export type ShapeSimilarity = 'edit' | 'kanji-components' | 'jamo'

/**
 * Tryb produkcji, czyli odtworzenia z pamięci — sekcja 7. Kolejność w tablicy
 * jest priorytetem: bierzemy pierwszy wykonalny dla danej pozycji.
 *
 * Japoński celowo nie ma `type`: wpisywanie kanji przez systemowy IME jest testem
 * pozornym, bo listę kandydatów podaje IME (sekcja 7.2).
 */
export type ProductionMode = 'type' | 'kana' | 'jamo' | 'draw'

/** Etapy nauki — sekcja 2a. */
export type Stage = 'script' | 'core' | 'sentences' | 'production'

export type LangAdapter = {
  /** Kod ISO 639-1, ten sam co katalog w `data/`. */
  code: string
  /** Nazwa po polsku, małą literą — tak jak pojawia się w zdaniu. */
  name: string
  /** Kod trzyliterowy w Tatoeba, do kroku `01-fetch`. */
  tatoeba: string
  /** Kod listy częstości FrequencyWords, do kroku `03-frequency`. */
  freq: string
  /** Dozwolony zestaw znaków. Zdanie z czymkolwiek spoza niego odrzuca krok `05`. */
  script: RegExp
  rtl: boolean
  /** Czy istnieje etap 0 — alfabet, kana, hangul. */
  hasScriptStage: boolean
  /** Czy tokeny niosą czytanie odrębne od zapisu (pole `r` w danych). */
  needsReading: boolean
  /** Czy pokazujemy transkrypcję łacińską na etapach 0–1. */
  needsTranslit: boolean
  tokenizer: Tokenizer

  display: {
    /** Nazwa rodziny z `@theme` w `index.css`, nie konkretny krój. */
    font: 'ui' | 'display' | 'ja' | 'ko'
    /** Stopień pisma tekstu docelowego w px, przy domyślnym ustawieniu wielkości. */
    size: number
    /**
     * Interlinia. Dla japońskiego znacząco większa, bo nad znakami staje furigana,
     * a miejsce na nią rezerwujemy z góry — układ nie może skakać przy jej pojawieniu.
     */
    lineHeight: number
  }

  tts: {
    locale: string
    /** Tempo mowy 0.3–1.0. Wolniej tam, gdzie gęstość informacji na sekundę jest większa. */
    rate: number
  }

  sentence: { minTokens: number; maxTokens: number }

  quiz: {
    shape: ShapeSimilarity
    /**
     * Poniżej tylu sensownych opcji pozycja dostaje `quiz: false` w buildzie
     * i spada na kartę `reveal` z samooceną — po cichu, bez komunikatu (sekcja 7.1).
     */
    minOptions: number
  }

  production: ProductionMode[]
}

/** Etapy, przez które prowadzimy użytkownika, w kolejności. */
export function stagesFor(adapter: LangAdapter): Stage[] {
  const stages: Stage[] = ['core', 'sentences', 'production']
  return adapter.hasScriptStage ? ['script', ...stages] : stages
}
