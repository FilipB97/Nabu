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

  /**
   * Skąd biorą się rangi częstości.
   *
   * `list` — gotowa lista FrequencyWords. Właściwa wszędzie tam, gdzie da się ją
   *   sensownie podzielić na słowa, czyli w językach ze spacjami.
   * `corpus` — liczymy sami, tokenizując korpus tym samym analizatorem, którego używa
   *   pipeline. Konieczne dla japońskiego: lista FrequencyWords powstała z naiwnego
   *   podziału, więc jej czoło to pojedyncze kany (い, の, は), a formy słownikowe
   *   czasowników (`食べる`, `起きる`, `大きい`) w ogóle w niej nie występują.
   *   Ranga z korpusu ma dodatkową zaletę: opisuje dokładnie ten materiał, którego uczymy.
   */
  freqSource: 'list' | 'corpus'
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

  /**
   * Słowa, po których odrzucamy całe zdanie. Tatoeba jest korpusem otwartym i zawiera
   * zdania wulgarne — 0,3% dla hiszpańskiego. Aplikacja ma się nadawać do pokazania
   * komuś przez ramię, więc filtrujemy je w buildzie, a nie tłumaczymy się z nich potem.
   */
  blocklist: RegExp

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

  sentence: {
    minTokens: number
    maxTokens: number
    /**
     * Ile tokenów może wypaść poza listę częstości, zanim odrzucimy zdanie.
     *
     * Dla języków o umiarkowanej fleksji zero jest właściwe — brak słowa na liście
     * 50 tysięcy znaczy, że jest rzadkie. Przy aglutynacji to przestaje działać:
     * koreański tworzy dziesiątki form od jednego rdzenia, więc 48% zdań ma co najmniej
     * jeden token spoza listy, choć same słowa są pospolite. Tokeny nieznane nie liczą
     * się do pasma zdania i nie mogą być luką — pytanie zawsze pada o słowo znane.
     */
    maxUnknown: number

    /**
     * Ile tokenów może być rzadszych od luki.
     *
     * Zero znaczy: luka MUSI być najrzadszym słowem zdania — to zasada i+1 z sekcji 3.1
     * i dla języków klasy A jest właściwa. Dla koreańskiego przestaje działać, bo ranga
     * tokenu kłamie: najrzadszym tokenem bywa pospolity czasownik w odmienionej formie,
     * której nie ma ani w słowniku, ani sensownie na liście częstości. Upieranie się
     * przy nim wycina 90% materiału i nie kupuje za to wierności zasadzie — bo pasmo,
     * na którym ta zasada się opiera, jest tam zawyżone.
     */
    clozeSlack: number
  }

  /**
   * Górna ranga częstości, powyżej której słowo uznajemy za zbyt rzadkie.
   *
   * Nie jest to stała, bo aglutynacja rozprasza częstość między formy: koreańskie
   * `먹다` („jeść", forma słownikowa) ma w liście napisów rangę 28 331, podczas gdy
   * jego forma grzecznościowa `먹어요` — 4 087. Próg 12 000 wycinałby formy podstawowe
   * najpospolitszych czasowników.
   *
   * Konsekwencja, o której trzeba pamiętać: pasma NIE SĄ porównywalne między językami.
   * Nigdy nie były — każdy język ma własną listę częstości — ale przy koreańskim
   * rozjazd jest większy. Właściwym lekarstwem jest tokenizer `morph` (mecab-ko),
   * który sprowadzi formy do rdzenia; do tego czasu podnosimy próg i mówimy o tym wprost.
   */
  maxBand: number

  quiz: {
    /**
     * Części mowy, które mogą być luką. Domyślnie rzeczownik, czasownik, przymiotnik
     * i przysłówek. Koreański zawęża do form nieodmiennych: czasownik pojawiłby się
     * w opcjach w formie odmienionej, a jego glosa opisuje formę słownikową — cztery
     * opcje w różnych formach są wskazówką gramatyczną, nie testem znajomości słowa.
     */
    clozePos?: string[]
    shape: ShapeSimilarity
    /**
     * Poniżej tylu sensownych opcji pozycja dostaje `quiz: false` w buildzie
     * i spada na kartę `reveal` z samooceną — po cichu, bez komunikatu (sekcja 7.1).
     */
    minOptions: number
  }

  production: ProductionMode[]

  /**
   * Rozbija wyraz na mniejsze jednostki — w koreańskim rdzeń i partykułę gramatyczną.
   * Nieobecne oznacza, że wyraz jest jednostką sam w sobie, jak w klasie A.
   */
  splitToken?: (surface: string) => Array<{ s: string; pos?: string }>

  /**
   * Kandydaci na postać słownikową danej formy, od najbardziej prawdopodobnego.
   * Wywołujący bierze pierwszego, który jest w słowniku. Nieobecny oznacza, że sama
   * forma powierzchniowa wystarcza — tak jest dla klasy A.
   */
  lemmaCandidates?: (surface: string) => string[]
}

/** Etapy, przez które prowadzimy użytkownika, w kolejności. */
export function stagesFor(adapter: LangAdapter): Stage[] {
  const stages: Stage[] = ['core', 'sentences', 'production']
  return adapter.hasScriptStage ? ['script', ...stages] : stages
}
