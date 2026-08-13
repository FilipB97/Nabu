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

/**
 * Pozycja etapu 0 — pojedynczy znak pisma wraz z czytaniem.
 *
 * Inwentarz pisma jest zbiorem zamkniętym i nie ma go w żadnym korpusie: kana i hangul
 * to po kilkadziesiąt znaków, które trzeba wypisać raz. Dlatego etap 0 nie pochodzi
 * z pipeline'u danych, tylko z adaptera — to jest wiedza o języku, więc mieszka tam,
 * gdzie reszta wiedzy o języku.
 */
export type ScriptItem = {
  /** Znak w piśmie docelowym — to jest przód karty. */
  s: string
  /** Czytanie w transkrypcji łacińskiej — to jest odpowiedź. */
  r: string
  /**
   * Zbiór, z którego w pierwszej kolejności biorą się dystraktory. Ma grupować znaki
   * MYLONE, a nie pokrewne systematycznie: dla kany jest to kolumna samogłoski
   * (か / さ / た różnią się spółgłoską przy tej samej samogłosce), dla hangulu klasa
   * litery. Bez tego opcje są losowe i karta sprowadza się do rozpoznania kształtu.
   */
  group: string
}

/**
 * Porcja etapu 0 — tyle znaków, ile wprowadzamy naraz.
 *
 * Pismo poznaje się grupami, nie pojedynczo: `か き く け こ` to jedna spółgłoska
 * i pięć samogłosek, więc pokazane razem uczą TABELI, a rozdzielone na pięć sesji
 * uczą pięciu niepowiązanych obrazków. To jest różnica między zapamiętaniem systemu
 * a wkuwaniem inwentarza.
 */
export type ScriptBatch = {
  /** Identyfikator porcji — po nim wiemy, że była już pokazana. */
  id: string
  /** Nazwa, np. „hiragana · rząd K". */
  label: string
  /** Co łączy znaki w tej porcji i czego można się z niej domyślić. */
  note: string
  items: ScriptItem[]
}

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
    font: 'ui' | 'display' | 'ja' | 'ko' | 'ar'
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

  /**
   * Inwentarz pisma dla etapu 0, w kolejności wprowadzania. Obecny dokładnie wtedy,
   * gdy `hasScriptStage` jest prawdą — pilnuje tego test kontraktu adapterów.
   */
  scriptItems?: () => ScriptItem[]

  /**
   * Jak działa to pismo — dwa, trzy zdania na ekranie głównym przez cały etap 0.
   *
   * Quiz uczy rozpoznawania, ale nie powie, że kana jest sylabiczna, a hangul składa
   * się w bloki. Bez tej wiedzy użytkownik zapamiętuje 92 obrazki zamiast systemu,
   * którego 92 znaki są tylko spisem.
   */
  scriptAbout?: string

  /**
   * Zdanie o konkretnym znaku, pokazywane przy PIERWSZYM spotkaniu, zanim padnie
   * pytanie. Ma powiedzieć, do czego znak należy i z czego się bierze jego czytanie —
   * inaczej wybór spośród czterech nieznanych sylab jest losowaniem, a nie nauką.
   */
  scriptNote?: (item: ScriptItem) => string

  /**
   * Zaczep pamięciowy: co ten kształt przypomina. Metoda słowa-klucza jest najlepiej
   * udokumentowanym sposobem na obce pismo — kształt bez skojarzenia jest kreską,
   * ze skojarzeniem staje się obrazkiem, który da się przywołać.
   */
  scriptMnemonic?: (item: ScriptItem) => string | undefined

  /**
   * Inwentarz pisma podzielony na porcje do wprowadzania, w kolejności. Suma porcji
   * musi być równa `scriptItems()` co do kolejności — pilnuje tego test kontraktu.
   */
  scriptBatches?: () => ScriptBatch[]

  /**
   * Czy nad tym tokenem warto pokazać czytanie. Domyślnie: gdy różni się od zapisu.
   *
   * Japoński potrzebuje własnej reguły: czytanie `ねこ` nad `猫` niesie informację,
   * ale to samo `ねこ` nad `ねこ` powtarza to, co użytkownik już widzi, i zjada
   * interlinię w każdej linijce zdania. Chiński jest odwrotny — pinyin jest potrzebny
   * ZAWSZE, bo z samego znaku wymowy nie da się odczytać.
   */
  showReading?: (surface: string, reading: string) => boolean

  /**
   * Klawiatura w aplikacji dla kart produkcji — sekcja 7.2.
   *
   * Obecna tam, gdzie klawiatura systemowa fałszuje test: japoński IME podaje listę
   * kandydatów (użytkownik rozpoznaje zamiast przypominać), a koreańska wymaga osobnej
   * instalacji. Języki łacińskie jej nie mają i mieć nie powinny — tam systemowa
   * klawiatura testuje dokładnie to, co trzeba.
   *
   * `compose` składa naciśnięte klawisze w tekst: dla hangulu to arytmetyka sylab,
   * dla kany doklejenie znaku dźwięczności do poprzedniej sylaby.
   */
  keyboard?: {
    rows: readonly (readonly string[])[]
    compose: (keys: readonly string[]) => string
  }
}

/** Etapy, przez które prowadzimy użytkownika, w kolejności. */
export function stagesFor(adapter: LangAdapter): Stage[] {
  const stages: Stage[] = ['core', 'sentences', 'production']
  return adapter.hasScriptStage ? ['script', ...stages] : stages
}
