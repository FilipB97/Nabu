# Nabu — specyfikacja produktu i plan wdrożenia

> Dokument wejściowy dla sesji Claude Code. Zawiera decyzje produktowe, model danych,
> architekturę, wytyczne UI dla Claude Design i kolejność prac z bramkami.
> Wszystko, co jest tu opisane jako **decyzja**, jest przesądzone — nie negocjuj tego od nowa.
> Wszystko, co jest opisane jako **do sprawdzenia**, wymaga eksperymentu przed implementacją.

### Rewizja z 12 sierpnia 2026

Po sesji Claude Design (makieta w `docs/design/`) zmieniła się podstawowa mechanika karty
i wszystko, co z niej wynika. Pierwsza wersja dokumentu opisywała klasyczne odsłonięcie
z czterema ocenami wystawianymi przez użytkownika. Obowiązuje wersja poniżej:

| decyzja | gdzie |
|---|---|
| Karta to **quiz** — wybór jednej z 3/4/6 opcji, nie samoocena | 7 |
| Dojrzała karta wchodzi w **produkcję**: wpisanie, klawiatura jamo, klawiatura kana, rysowanie | 6.4, 7.2, 7.3 |
| Samoocena zostaje **wyłącznie** na karcie `reveal`, jako cichy fallback | 7.1 |
| Dystraktory liczone w buildzie, ze słownictwa talii; nowy krok `06` | 5.1, 10.1b |
| Log zapisuje, **co** użytkownik wybrał — bez tego nie ma mylonych par | 5.3, 8.6 |
| Motyw to warstwa tokenów i presety barw, z testem kontrastu w CI | 9.1 |
| Kroje pisma hostowane u siebie i subsetowane; nowy krok `07` | 9.2 |
| Test audio przechodzi z M5 do M0, bo jego wynik zmienia pipeline — **wykonany, mowa działa** | 11 |

Szacunek czasu rośnie z ~8,5 do ~12 dni. Kolejność etapów w sekcji 12 jest zaktualizowana.

---

## 0. Nazwa

**Nabu** — mezopotamski bóg pisma, patron skrybów i języków.

Cztery litery, dwie sylaby, żadnych znaków diakrytycznych. Wymawia się identycznie po polsku,
angielsku, hiszpańsku, portugalsku i szwedzku — co przy aplikacji wielojęzycznej nie jest
drobiazgiem. Dla użytkownika nazwa jest pusta, więc nie obiecuje niczego i nie zawęża
produktu do jednego języka ani jednej metody. Historia jest w zapasie, gdyby ktoś zapytał.

**Wskazówka wizualna dla identyfikacji.** Nazwa jest pusta semantycznie, więc znak musi
nieść znaczenie sam. Kierunek: pismo klinowe redukowane do kilku kresek — pierwszy system
pisma w historii, a jednocześnie forma na tyle abstrakcyjna, że nie jest przebraniem
za Mezopotamię. Ten sam motyw równo rozłożonych znaczników działa jako pasek postępu sesji.
Sygnatura marki i główny element interfejsu to jeden rysunek w dwóch skalach.

```
   ▬ ▬ ▬        pasek sesji = znak marki
```

Czego unikać w identyfikacji: skrzydlatych byków, tabliczek glinianych, ornamentu
bliskowschodniego, sepii. Nazwa ma być punktem wyjścia, nie tematem przewodnim.

Repo: `nabu`. Pakiet: `nabu`. Domena docelowa: GitHub Pages, później `nabu.app`
albo `getnabu.app` / `nabu.study`, jeśli krótka wersja zajęta.

**Do sprawdzenia przed publikacją repo:** dostępność domeny oraz kolizje znaków towarowych
w EUIPO. Nazwa jest krótka i mitologiczna, czyli statystycznie chętnie używana — istnieje
realna szansa, że coś już się tak nazywa w sąsiedniej branży.

Odrzucone alternatywy: **Mora** (jednostka rytmu i łacińska zwłoka — trafne, ale po polsku
ociera się o zmorę), **Tala** (mowa po szwedzku, cykl rytmiczny w muzyce indyjskiej),
**Takt**, **Pauza**, **Glosa**.

---

## 1. Czym to jest i czym nie jest

**Jednozdaniowo:** trener języków obcych dla Polaków, który uczy zdaniami z prawdziwego
korpusu, z poprawnymi czytaniami i wymową, działa offline i mieści się w 10 minutach dziennie.

### Zasady, od których nie odchodzimy

1. **Aplikacja nie generuje języka obcego.** Zdania pochodzą z korpusu, czytania z analizy
   morfologicznej, wymowa z TTS. Model językowy pracuje wyłącznie w kroku build (tłumaczenia
   na polski) i opcjonalnie przy ocenie odpowiedzi otwartych.
2. **Local-first.** Cała sesja działa offline. Chmura to synchronizacja, nie zależność.
3. **Telefon nic nie liczy.** Segmentacja, furigana, poziomy trudności, tłumaczenia — wszystko
   policzone w buildzie i wrzucone jako statyczny JSON.
4. **Nie ma streaków, serc, walut ani rankingów.** Mechaniki nacisku psują naukę u dorosłych,
   którzy i tak wracają, bo chcą. Jedyna metryka na wierzchu: ile dziś zostało.

### Czego v1 nie robi

Konwersacji, rozpoznawania mowy, gramatyki wykładanej wprost, gier, społeczności.

---

## 2. Języki

**To jest aplikacja wielojęzyczna od pierwszego dnia, a nie aplikacja do japońskiego
z dodatkami.** Japoński pojawia się w tym dokumencie często wyłącznie dlatego, że jest
najtrudniejszym przypadkiem i dobrze testuje kontrakt adaptera. Jeśli gdziekolwiek
w implementacji zobaczysz `if (lang === 'ja')` poza katalogiem adapterów — to jest błąd.

### 2.1 Kontrakt adaptera

Rdzeń nie wie, jakiego języka uczy. Cała wiedza o języku siedzi w jednym katalogu
`src/langs/{code}/` i w danych wyprodukowanych przez build.

```ts
type LangAdapter = {
  code: string;              // 'es'
  name: string;              // 'hiszpański'
  tatoeba: string;           // 'spa'
  freq: string;              // kod listy częstości
  script: RegExp;            // dozwolony zestaw znaków
  rtl: boolean;
  hasScriptStage: boolean;   // czy etap 0 istnieje
  needsReading: boolean;     // czy tokeny niosą czytanie odrębne od zapisu
  needsTranslit: boolean;    // czy pokazujemy transkrypcję łacińską
  tokenizer: 'space' | 'dict' | 'morph';
  display: { font: string; size: number; lineHeight: number };
  tts: { locale: string; rate: number };
  sentence: { minTokens: number; maxTokens: number };

  quiz: {
    shape: 'edit' | 'kanji-components' | 'jamo';  // wtyczka podobieństwa kształtu
    minOptions: number;        // poniżej tego → karta spada na `reveal`
  };
  production: Array<'type' | 'kana' | 'jamo' | 'draw'>;  // tryby recall, kolejność = priorytet
};
```

| język | `quiz.shape` | `production` |
|---|---|---|
| es, pt, sv | `edit` | `['type']` |
| ko | `jamo` | `['jamo']` |
| ja | `kanji-components` | `['draw', 'kana']` |

Adapter jest katalogiem, a nie pojedynczym plikiem, bo poza konfiguracją mieści też pomocniki
pisma: składanie i rozkład sylab hangulu (`ko/hangul.ts`), układ gojūon i normalizacja kany
(`ja/kana.ts`). Reguła „zero rozgałęzień językowych poza adapterami" zostaje bez zmian, tylko
celuje w katalog. Pilnuje jej reguła ESLint, nie `grep` po fakcie.

Dodanie języka to nowy katalog adaptera, przebieg builda i ręcznie przetłumaczony rdzeń
słownictwa. Zero zmian w silniku, zero zmian w komponentach.

### 2.2 Poziomy trudności adaptera

| Poziom | Języki | Co je wyróżnia | Koszt |
|---|---|---|---|
| **A** | hiszpański, portugalski, szwedzki, włoski, niemiecki, norweski | alfabet łaciński, spacje, brak czytań i transkrypcji | ~1 h każdy |
| **B** | koreański | hangul jest w pełni fonetyczny, spacje są; potrzebna tylko etap 0 i opcjonalna romanizacja | ~3 h |
| **C** | japoński, chiński | brak spacji → segmentacja; japoński dodatkowo ma niejednoznaczne czytania kanji | 1–2 dni |
| **D** | arabski, hebrajski | spacje są, ale zapis bez wokalizacji — z tekstu nie da się wyprowadzić wymowy; do tego RTL | 1 dzień + decyzja produktowa |

Uwaga do poziomu D: dla arabskiego **dźwięk nie jest dodatkiem, tylko warunkiem
sensowności** — TTS Apple ma model wokalizacji, którego nie ma w tekście z korpusu.
Nie wprowadzaj arabskiego, zanim warstwa audio nie będzie pewna (sekcja 11).

### 2.3 Zakres v1

Startujemy z **pięcioma językami**: hiszpański, portugalski, szwedzki, koreański, japoński.

Cztery pierwsze kosztują razem mniej niż jeden japoński, a dają natychmiastowy dowód,
że rdzeń jest neutralny językowo. Japoński wchodzi jako piąty, dopiero gdy pozostałe działają
— odwrotna kolejność prowadzi do systemu, który przypadkiem został zbudowany wokół furigany.

Chiński i arabski dokładamy po v1, każdy jako osobne, zamknięte zadanie.

### 2.4 Wielojęzyczność w interfejsie

- Przełączanie języka jest zawsze o jedno dotknięcie — pasek na górze ekranu startu,
  nie ukryte w ustawieniach.
- Każdy język ma własny stan, własny poziom, własne pasmo i własny budżet dzienny.
- **Języki aktywne kontra utrzymywane:** aktywne dostają nowe pozycje, utrzymywane tylko
  zaległe powtórki. Domyślnie dwa aktywne. Bez tego pięć języków to 100+ kart dziennie
  i porzucenie aplikacji w drugim tygodniu.
- Ostrzeżenie przy jednoczesnym uruchomieniu hiszpańskiego i portugalskiego: to języki
  na tyle bliskie, że interferencja jest realna. Nie blokujemy, ale mówimy o tym raz
  i proponujemy rozdzielenie w czasie.

## 2a. Etapy nauki (wspólne dla wszystkich języków)

| Etap | Nazwa | Treść | Warunek wejścia |
|---|---|---|---|
| 0 | `script` | alfabet / kana / hangul | tylko języki z obcym pismem |
| 1 | `core` | 60–100 słów rdzenia z polskim tłumaczeniem | etap 0 opanowany |
| 2 | `sentences` | zdania z korpusu, cloze | etap 1 opanowany |
| 3 | `production` | odtworzenie z pamięci: wpisanie, rysowanie | dojrzałość karty, nie ukończenie etapu |

**Opanowany** = 90% pozycji etapu ma `interval >= 7` dni.

Etapy nie blokują sztywno — użytkownik może je odblokować ręcznie w ustawieniach,
ale domyślnie prowadzimy go po kolei i mówimy dlaczego.

Etap 3 różni się od pozostałych: nie jest bramą, którą się przechodzi, tylko trybem, w który
wchodzi **pojedyncza karta**, gdy dojrzeje (`interval >= 21`). Ta sama pozycja jest więc
najpierw quizem, a potem produkcją, i nie ma momentu „odblokowania produkcji" dla całego
języka. Szczegóły w sekcjach 6.4 i 7.

Etap 0 istnieje tylko tam, gdzie adapter ma `hasScriptStage: true` — czyli dla japońskiego
(kana) i koreańskiego (hangul). Języki łacińskie startują od `core`.

---

## 3. Poziom trudności

Trzy niezależne pokrętła. Nie mieszać ich w jedno.

### 3.1 Poziom wejściowy — wybierany raz, przy dodaniu języka

| Wybór | Co robi |
|---|---|
| Zaczynam od zera | start od etapu 0, pasmo częstości 1–500 |
| Znam podstawy | pomija etap 0, pasmo 1–1500, uruchamia kalibrację |
| Radzę sobie | pasmo 500–4000, kalibracja |
| Zaawansowany | pasmo 2000–12000, kalibracja |

**Kalibracja** (dla wszystkich poza „od zera"): 25 słów rozłożonych po pasmach częstości,
pytanie „znasz to słowo?" z odpowiedzią tak/nie/niepewny. Trwa minutę.

Efekt kalibracji jest kluczowy technicznie: buduje początkowy zbiór *znanych słów*, dzięki
czemu dobór zdań metodą **i+1** (dokładnie jedno nowe słowo w zdaniu) działa od pierwszej
sesji. Bez tego trzeba stosować obejścia, które psują dobór materiału.

### 3.2 Intensywność sesji — zmienialna zawsze, widoczna na ekranie startu

| Tryb | Powtórki | Nowe | Czas |
|---|---|---|---|
| Krótka | 10 | 3 | ~4 min |
| Normalna | 25 | 8 | ~10 min |
| Długa | 50 | 15 | ~20 min |

### 3.3 Adaptacja — automatyczna, w tle

Po każdej sesji liczymy skuteczność (odsetek ocen ≥ 3) z ostatnich 100 odpowiedzi:

- **> 92%** przez 3 sesje → podnieś górną granicę pasma częstości o 500, pokaż subtelną informację
- **< 75%** przez 2 sesje → obniż liczbę nowych pozycji o połowę na 3 sesje, nie zmieniaj pasma
- Nigdy nie obniżamy pasma automatycznie — to frustruje bardziej, niż pomaga

---

## 4. Architektura

```
┌─────────────── build (laptop, ręcznie / GitHub Action) ────────────────┐
│  Tatoeba  →  kuromoji/MeCab  →  furigana  →  pasma częstości          │
│  glosy EN  →  LLM (Gemini/Claude)  →  glosy PL  →  weryfikacja        │
│                              ↓                                         │
│                    /data/{lang}/*.json  (commit)                       │
└────────────────────────────────────────────────────────────────────────┘
                               ↓  GitHub Pages (statyczne)
┌─────────────────────── PWA (przeglądarka) ────────────────────────────┐
│  UI  →  silnik SRS  →  IndexedDB (źródło prawdy lokalnie)             │
│                              ↕  sync (debounce, na końcu sesji)        │
│                        Firebase Auth + Firestore                       │
└────────────────────────────────────────────────────────────────────────┘
```

### Stack — decyzje

- **Vite + React + TypeScript.** Nie Next.js: nie potrzebujemy SSR, a Pages lubi statyk.
- **Tailwind** + tokeny CSS (patrz sekcja 9). Bez bibliotek komponentów — UI ma być własne.
- **Dexie.js** na IndexedDB. Ręczne IDB to niepotrzebny ból.
- **Firebase**: Auth + Firestore. Bez Functions, bez Storage — wszystko mieści się w free tier.
- **Workbox** na service workera, strategia: precache całej aplikacji + `/data`, stale-while-revalidate.
- **Vitest** na logikę SRS. Testy tylko tam, gdzie błąd jest niewidoczny gołym okiem.

### Struktura repo

```
nabu/
├─ build/                   skrypty Node (nie wchodzą do bundla)
│  ├─ 01-fetch-tatoeba.ts
│  ├─ 02-tokenize.ts        wtyczki: space | dict | morph
│  ├─ 03-frequency.ts
│  ├─ 04-glosses.ts         LLM: EN → PL
│  ├─ 05-assemble.ts        składa talie, liczy pasma
│  ├─ 06-distractors.ts     kandydaci na opcje quizu + flaga `quiz`
│  ├─ 07-fonts.ts           subset krojów do znaków obecnych w data/
│  ├─ 08-strokes.ts         subset KanjiVG → data/ja/strokes.json
│  └─ cache/                surowe pobrania, .gitignore
├─ data/                    WYNIK builda, commitowany
│  ├─ es/  pt/  sv/        core.json  sentences.json  meta.json
│  ├─ ko/                  + script.json  (hangul)
│  └─ ja/                  + script.json  (kana)  + strokes.json
├─ src/
│  ├─ app/                  routing, layout, providers
│  ├─ session/              silnik sesji + komponenty kart
│  ├─ srs/                  algorytm, czysty TS, bez zależności
│  ├─ store/                Dexie, sync, model
│  ├─ langs/                adaptery: es/ pt/ sv/ ko/ ja/ + index.ts
│  ├─ audio/                TTS + fallback
│  ├─ theme/                tokeny, presety, provider, test kontrastu
│  └─ ui/                   prymitywy: Button, Sheet, Ticks, QuizOption…
├─ public/                  manifest, ikony, sw, kroje pisma
└─ docs/                    ten plik, ADR-y
```

---

## 5. Model danych

### 5.1 Talia statyczna — `data/{lang}/sentences.json`

```jsonc
{
  "lang": "ja",
  "version": "2026-08-11",
  "license": "Tatoeba CC BY 2.0 FR; FrequencyWords CC BY-SA 3.0",
  "items": [
    {
      "id": "ja-s-82931",
      "text": "水をください。",
      "tokens": [
        { "s": "水", "r": "みず", "b": 412, "pos": "noun", "lemma": "水" },
        { "s": "を", "r": "を", "b": 3,   "pos": "part" },
        { "s": "ください", "r": "ください", "b": 380, "pos": "verb", "lemma": "くださる" }
      ],
      "en": "Water, please.",
      "pl": "Poproszę wodę.",
      "band": 412,
      "audio": null,
      "cloze": "ja-w-mizu",
      "distractors": ["ja-w-koori", "ja-w-yu", "ja-w-kome", "ja-w-sake", "ja-w-cha", "ja-w-yuki"],
      "quiz": true
    }
  ]
}
```

`b` = ranga częstości lematu. `band` = maksimum z tokenów, czyli trudność zdania.
`tokens` niosą wszystko, czego potrzebuje UI: furiganę (`<ruby>s<rt>r</rt></ruby>`),
segmentację do cloze i informację, które słowo jest nowe.

**`r` podajemy tylko wtedy, gdy różni się od `s`** — dla kany i alfabetu łacińskiego jest `null`,
co oszczędza ~40% wagi pliku.

Zapis na dysku różni się od powyższego w trzech drobiazgach, które warto znać:
`cloze` jest **indeksem tokenu**, nie identyfikatorem; glosa polska siedzi na tokenie luki
(reszta jej nie potrzebuje); pole `src` mówi, czy tłumaczenie jest bezpośrednie, czy przez
angielski. Talia leży w paczkach `sentences-NNN.json` po 500 zdań, a `meta.json` trzyma
indeks paczek z zakresem pasm — dzięki temu pierwsze uruchomienie ściąga kilkaset kilobajtów,
nie kilkanaście megabajtów. Osobny `lexicon.json` mapuje lemat na glosę, część mowy i pasmo;
`distractors` to lematy, które runtime rozwiązuje przez ten plik.

`cloze` wskazuje słowo, które zasłaniamy luką. `distractors` to 6–8 kandydatów na błędne opcje
policzonych w buildzie (sekcja 10.1b); runtime losuje z nich `n − 1`, więc zestaw opcji nie
powtarza się między powtórkami tej samej karty. `quiz: false` ustawia build, gdy kandydatów
jest mniej niż `adapter.quiz.minOptions − 1` — taka pozycja spada na kartę `reveal`
z samooceną, po cichu, bez komunikatu dla użytkownika.

### 5.2 Talia słów — `data/{lang}/core.json`

```jsonc
{
  "items": [
    { "id": "ja-w-mizu", "term": "水", "reading": "みず", "romaji": "mizu",
      "pl": "woda", "en": "water", "band": 412, "stage": "core", "pos": "noun",
      "examples": ["ja-s-82931"],
      "distractors": ["ja-w-koori", "ja-w-yu", "ja-w-kome", "ja-w-sake"],
      "quiz": true }
  ]
}
```

`pos` jest potrzebne do doboru dystraktorów (rzeczownik mylimy z rzeczownikiem), więc
tokenizer musi je przekazać także dla języków łacińskich, gdzie dotąd mogło być `null`.

### 5.3 Stan użytkownika — IndexedDB, mirror w Firestore

```ts
type CardState = {
  id: string;            // ja-w-mizu
  lang: string;
  stage: 'script' | 'core' | 'sentences' | 'production';
  due: string;           // ISO date
  interval: number;      // dni; 0 = w trakcie nauki
  step: number;          // krok nauki w minutach, gdy interval === 0
  ease: number;
  reps: number;
  lapses: number;
  suspended: boolean;
  updatedAt: number;     // epoch ms — klucz do rozstrzygania konfliktów
};
```

Log odpowiedzi osobno, append-only, miesięczne partycje:

```ts
type LogEntry = {
  ts: number;
  id: string;
  grade: 0 | 1 | 2 | 3;   // nie pamiętam / trudne / dobrze / łatwe
  ms: number;             // czas odpowiedzi, patrz sekcja 6.2
  mode: CardType;         // 'quiz-cloze' | 'produce-draw' | …
  chosen?: string;        // TYLKO quiz: id wybranej opcji, także gdy trafiona
  options?: string[];     // TYLKO quiz: cały pokazany zestaw, w kolejności wyświetlenia
};
```

Służy statystykom i przyszłemu FSRS.

**`chosen` i `options` nie są opcjonalnym dodatkiem.** Bez nich nie da się zrobić ekranu
„najczęściej mylone pary" (sekcja 8.6) ani reguły „mylona para wraca częściej jako dystraktor"
(sekcja 10.1b), a danych zebranych wstecz nie ma skąd wziąć. Muszą być w schemacie od
pierwszego zapisu, nawet jeśli ekran statystyk powstanie dopiero w M8.

### 5.4 Firestore — układ dokumentów

```
users/{uid}
  profile              { langs, level, intensity, settings, createdAt }
  decks/{lang}-{n}     { cards: { [id]: CardState }, updatedAt }   ← paczki po 400
  log/{yyyy-MM}        { entries: [...] }
```

Paczkowanie po 400 kart trzyma dokument poniżej 1 MB i sprawia, że jedna sesja to
1–2 zapisy, nie 30. Przy 20 tysiącach zapisów dziennie w darmowym planie to margines,
którego nie da się przekroczyć w normalnym użyciu.

**Reguły bezpieczeństwa** (mają być w repo, nie klikane w konsoli):

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

### 5.5 Synchronizacja

- Zapis lokalny natychmiast, po każdej odpowiedzi. Sesja nigdy nie czeka na sieć.
- Push do Firestore: na końcu sesji, przy `visibilitychange` i co 5 minut w tle.
- Konflikt rozstrzygamy per karta przez `updatedAt` — wygrywa nowszy.
- Offline: kolejka w IndexedDB, wysyłka przy powrocie sieci.
- **Eksport i import całego stanu do pliku JSON jest funkcją v1, nie „kiedyś".**
  Safari potrafi czyścić IndexedDB, a Firestore może nie być jedynym zabezpieczeniem.

---

## 6. Silnik SRS

**Decyzja: SM-2 z krokami nauki w minutach.** FSRS dopiero przy 1000+ powtórkach w logu —
wcześniej nie ma z czego liczyć parametrów, a złożoność kosztuje.

To, czego brakowało w wersji na Scriptable i co trzeba zrobić dobrze: **kroki nauki
wewnątrz sesji**. Nowa karta nie może iść od razu na 2 dni.

```
Nowa karta:      kroki [1 min, 10 min]
  „Nie pamiętam" → wróć do kroku 1
  „Trudne"       → powtórz bieżący krok
  „Dobrze"       → następny krok; po ostatnim → interwał 1 dzień
  „Łatwe"        → od razu 4 dni

Karta w powtórkach (interval ≥ 1):
  Nie pamiętam → lapse: interval = 0, wraca do kroków, ease −0.20
  Trudne       → interval × 1.2, ease −0.15
  Dobrze       → interval × ease
  Łatwe        → interval × ease × 1.3, ease +0.15
  ease ∈ [1.3, 3.0], rozrzut losowy ±5% żeby uniknąć kumulacji terminów
```

Karty w krokach minutowych wracają **w tej samej sesji**, wpychane do kolejki po
odpowiedniej liczbie innych kart. To odpowiada na pytanie „kiedy to zobaczę znowu"
w sposób, który użytkownik odczuwa od razu.

**Limit zaległości:** jeśli liczba kart z `reps === 0` przekracza 20, nie wprowadzamy
nowych, tylko mówimy o tym wprost na ekranie startu.

### 6.1 Skąd bierze się ocena

Użytkownik nie wystawia sobie oceny — poza kartą `reveal`, która jest fallbackiem
(sekcja 7). Silnik dostaje wynik obiektywny i sam mapuje go na jedną z czterech ocen SM-2.

| karta | co silnik dostaje |
|---|---|
| `quiz-*` | indeks wybranej opcji + czas odpowiedzi |
| `produce-type` / `produce-kana` / `produce-jamo` | wpisany ciąg + liczba prób |
| `produce-draw` | liczba poprawionych kresek i użytych podpowiedzi |
| `reveal` | ocena użytkownika (jedyny przypadek subiektywny) |

### 6.2 Quiz → ocena, z ochroną przed strzałem

Przy czterech opcjach czysty strzał trafia w 25% przypadków, a każde takie trafienie
podbija interwał. Samo „trafienie = Dobrze" rozjeżdża harmonogram w kilka tygodni.
Reguły w kolejności sprawdzania:

| sytuacja | ocena | uwaga |
|---|---|---|
| pudło | Nie pamiętam | karta wraca do kroku 1 min, zapisujemy `chosen` |
| trafienie przy `reps <= 1` | Dobrze, ale tylko **następny krok nauki** | nigdy skok na 1 dzień |
| trafienie wolniejsze niż 2,5× mediany użytkownika dla tego typu karty | Trudne | mediana krocząca z ostatnich 200 odpowiedzi |
| trafienie poniżej 2 s przy `interval >= 21` | Łatwe | |
| pozostałe trafienia | Dobrze | |

**Skreślone 12.08.2026: „było trudne" po trafieniu.** Reguła była w tabeli od pierwszej
rewizji i miała pozwalać użytkownikowi zgłosić, że trafił z trudem. Przy pierwszym użyciu
okazało się, że przycisk stoi obok „Dalej" na najczęściej dotykanym ekranie aplikacji
i przeczy zasadzie, dla której cały ten quiz powstał: **ocenę wystawia silnik, nie
użytkownik**. Do tego dubluje sygnał, który i tak mierzymy — trafienie wolniejsze niż
2,5× mediany schodzi do „Trudne" samo. Samoocena zostaje wyłącznie na karcie `reveal`.

**Pomiar `ms` jest elementem nośnym**, a nie statystyką: liczymy od wyrenderowania karty
do dotknięcia, odejmujemy czas automatycznego odtworzenia dźwięku, obcinamy wartości
powyżej 60 s (telefon odłożony na stół) i wykluczamy je z mediany.

### 6.3 Zasady prezentacji, bez których quiz uczy układu przycisków

- Pozycja poprawnej odpowiedzi jest losowa i **inna niż przy poprzedniej powtórce tej karty**.
- Zestaw dystraktorów nie powtarza się dwa razy z rzędu — losujemy `n − 1` z listy 6–8.
- Dystraktor, na który użytkownik już się nabrał (z `chosen` w logu), wraca z podwyższonym
  prawdopodobieństwem, dopóki para nie zostanie trafiona trzy razy z rzędu.

### 6.4 Produkcja → ocena

| wynik | ocena |
|---|---|
| dokładne trafienie za pierwszym razem, bez podpowiedzi | Dobrze (Łatwe, jeśli poniżej 2 s i `interval >= 21`) |
| trafienie po poprawce, po jednej podpowiedzi, albo różnica tylko w diakrytykach | Trudne |
| druga podpowiedź, rezygnacja albo błędna odpowiedź | Nie pamiętam |

Porównanie tekstu: dla `type` normalizujemy wielkość liter i białe znaki; różnica wyłącznie
w znakach diakrytycznych to Trudne z pokazaniem różnicy, nie pudło. Dla `kana` normalizujemy
hiraganę i katakanę do jednej postaci. Dla `jamo` porównujemy po złożeniu sylab.

**Kiedy karta idzie w produkcję zamiast quizu:** domyślnie przy `interval >= 21`.
Ustawienie per język: `wyłączona / od dojrzałych (domyślnie) / zawsze`. Gdy adapter podaje
kilka trybów (japoński: `['draw','kana']`), wybieramy pierwszy wykonalny dla danej pozycji —
rysowanie tam, gdzie znak jest w `strokes.json`, wpisanie czytania w pozostałych przypadkach.

---

## 7. Typy kart

**Decyzja: podstawową mechaniką jest quiz — wybór jednej z kilku opcji, nie samoocena.**
Użytkownik dotyka opcji, odpowiedź jest natychmiast rozstrzygnięta, bez potwierdzania i bez
możliwości zmiany wyboru. Samoocena zostaje w jednym miejscu: karcie `reveal`, która jest
cichym zapasem dla pozycji, dla których quiz nie ma sensu.

| Typ | Przód | Odpowiedź | Ocena | Etap |
|---|---|---|---|---|
| `quiz-word` | słowo w piśmie docelowym | 1 z 3/4/6 glos polskich | obiektywna | 1 |
| `quiz-cloze` | zdanie z luką + tłumaczenie PL | 1 z 3/4/6 słów w piśmie docelowym | obiektywna | 2 |
| `quiz-listen` | tylko dźwięk, przycisk „powtórz" | 1 z 3/4/6 | obiektywna | 2 |
| `produce-type` | słowo albo zdanie po polsku | wpisanie, klawiatura systemowa | porównanie tekstu | 3 |
| `produce-kana` | słowo w kanji + kontekst | wpisanie czytania, klawiatura kana w aplikacji | dokładne dopasowanie | 3 |
| `produce-jamo` | słowo po polsku | wpisanie, klawiatura jamo w aplikacji | dokładne dopasowanie | 3 |
| `produce-draw` | glosa PL + czytanie | narysowanie znaku | kreska po kresce | 3 |
| `script` | znak: あ | 1 z 4 czytań albo narysowanie | obiektywna | 0 |
| `reveal` | jak dotąd | odsłonięcie + cztery oceny | **subiektywna** | fallback |

**Każda karta musi zadawać pytanie, na które da się odpowiedzieć z pamięci, a odpowiedź musi
ujawnić coś, czego nie było widać na przodzie.** To brzmi banalnie, ale to jest dokładnie ten
warunek, który łatwo złamać, budując kartę „pokaż zdanie → pokaż słowo z tego zdania".

### 7.1 Kiedy quiz nie działa i co wtedy

Karta spada na `reveal`, gdy build nie znalazł dość sensownych dystraktorów
(`quiz: false`, sekcja 5.1). Użytkownik nie dostaje o tym komunikatu — widzi po prostu kartę
z przyciskiem „Odsłoń". To zapasowy tryb dla brzegów słownika, nie osobna funkcja.

Karty `script` dla pojedynczych znaków kany są tu przypadkiem granicznym: cztery sensowne
dystraktory dla あ istnieją (podobne kształtem お, ぬ, め), więc quiz działa. Dla hangulu
podobnie. Ale wszędzie, gdzie zabraknie kandydatów, obowiązuje ta sama ścieżka odwrotu.

### 7.2 Dlaczego japoński nie ma `produce-type`

Wpisywanie kanji przez systemowy IME jest testem pozornym: użytkownik wpisuje `mizu`, IME
podaje listę kandydatów, użytkownik **rozpoznaje** 水 na liście. Pracę pamięciową wykonał IME.
Stąd dla japońskiego wyłącznie `produce-kana` (wpisanie czytania z klawiatury w aplikacji,
bez podpowiedzi kandydatów) i `produce-draw`.

Dla koreańskiego problem jest inny — systemowa klawiatura hangul istnieje, ale wymaga, żeby
użytkownik ją sobie zainstalował i przełączał. Hangul składa się z jamo arytmetycznie
(`0xAC00 + 초성 × 588 + 중성 × 28 + 종성`), więc własna klawiatura jamo to kilkadziesiąt linii
i pełna kontrola nad tym, czego test dotyczy.

Karta `quiz-listen` jest tania w implementacji i bardzo mocna dla początkujących — ta sama
treść co `quiz-cloze`, inny kanał. Wprowadzać ją, gdy karta ma `reps >= 3`.

### 7.3 `produce-draw` — rysowanie znaków

- **Dane**: KanjiVG (CC BY-SA 3.0), ścieżki SVG osobno dla każdej kreski. Subset do znaków
  obecnych w `data/ja/` → `data/ja/strokes.json` (krok `08-strokes.ts`). KanjiVG pokrywa też
  kanę, więc ten sam komponent obsługuje etap 0.
- **Wejście**: `pointer events` na płótnie, każda kreska jako polilinia.
- **Ocena bez uczenia maszynowego**: dla oczekiwanej kreski próbkujemy ścieżkę wzorca przez
  `getPointAtLength`, porównujemy punkt startu, punkt końca, kierunek i średnią odległość
  od wzorca; tolerancja skalowana do pola znaku. Kolejność kresek jest częścią oceny.
- **Podpowiedź**: po pierwszej nieudanej próbie pokazujemy kontur bieżącej kreski.
  Konsekwencje dla oceny — sekcja 6.4.

---

## 8. UX — przepływy i stany

### 8.1 Pierwsze uruchomienie

1. Ekran powitalny: jedno zdanie, co to jest. Przycisk „Zacznij".
2. Wybór języka — kafle z nazwą i przykładowym zdaniem w tym języku (nie flagi;
   flagi to nie języki).
3. Wybór poziomu (sekcja 3.1).
4. Kalibracja, jeśli poziom > zero.
5. **Od razu pierwsza karta.** Bez zakładania konta, bez maila, bez zgód.
   Logowanie proponujemy dopiero po pierwszej ukończonej sesji.

### 8.2 Logowanie

- Start jako **konto anonimowe Firebase**. Użytkownik uczy się od pierwszej sekundy.
- Po pierwszej sesji: „Zapisz postęp na innych urządzeniach" → Google albo link mailowy.
- Upgrade konta anonimowego zachowuje cały stan (`linkWithCredential`).
- Wylogowanie ostrzega, że dane lokalne zostaną wyczyszczone, i proponuje eksport.

### 8.3 Ekran startu sesji

Ma odpowiadać na trzy pytania w jednym spojrzeniu: ile jest do zrobienia, ile to potrwa,
co się dzieje dalej.

```
        japoński
        ─────────
           23        do powtórki
           + 8       nowych

        [ Zacznij ]

        krótka · normalna · długa
        
        Kana: 38 / 46 opanowane
```

### 8.4 Sesja

- Postęp: pasek segmentów, jeden na kartę. Pudła oznaczone **kolorem akcentu**, nie czerwienią
  — w tej aplikacji nie ma koloru błędu (sekcja 9.1).
- Odpowiedź: jedno dotknięcie opcji kończy kartę. Bez potwierdzania, bez zmiany wyboru.
- Po trafieniu karta może przejść dalej sama po 900 ms (ustawienie, domyślnie włączone).
  **Pudło zawsze czeka na dotknięcie „Dalej"** i pokazuje, czym wybrane słowo różni się
  od poprawnego.
- Tłumaczenia przy opcjach są ukryte do momentu wyboru — inaczej karta jest testem czytania
  po polsku. Furigana pojawia się dopiero w odsłoniętym zdaniu.
- **Cofnij ostatnią odpowiedź** — nietrafione dotknięcie jest normalne, a bez cofania
  psuje harmonogram i frustruje. Jeden poziom cofnięcia wystarczy.
- Dźwięk: automatycznie po odpowiedzi, z możliwością wyłączenia. Przycisk „posłuchaj"
  zawsze dostępny.
- Przerwanie sesji jest bezpieczne: stan zapisany po każdej odpowiedzi, powrót wznawia.
- Ekran końcowy: liczba kart, trafienia za pierwszym razem, pudła, ile wróci jutro,
  prognoza 14 dni. Bez konfetti.

**Klawiatura na desktopie jest obowiązkowa, nie dodatkiem.** Aplikacja działa jako PWA także
na laptopie, gdzie sięganie myszą do opcji jest wolniejsze od dotknięcia na telefonie:

| klawisz | działanie |
|---|---|
| `1`–`6` | wybór opcji quizu |
| `Enter` / `Spacja` | „Dalej", a na karcie produkcji zatwierdzenie odpowiedzi |
| `Z` | cofnij ostatnią odpowiedź |
| `P` | posłuchaj ponownie |

Fokus klawiatury musi być widoczny — obrys w kolorze akcentu na aktywnej opcji.

### 8.5 Ustawienia (per język, poza motywem)

- **Liczba opcji w quizie**: 3 / 4 / 6, domyślnie 4. Sześć opcji przy dłuższych słowach
  spycha zdanie za wysoko na ekranie — dlatego to wybór, a nie stała.
- **Przejdź dalej po trafieniu**: włącznik, domyślnie włączony, 900 ms. Pudło zawsze czeka.
- **Produkcja**: wyłączona / od dojrzałych (domyślnie) / zawsze.
- **Furigana**: zawsze / dopiero po odpowiedzi / nigdy. Domyślnie „po odpowiedzi"
  dla etapu 2, „zawsze" dla etapu 1.
- **Romaji**: włączone tylko na etapie 0–1, potem domyślnie wyłączone z komunikatem
  wyjaśniającym dlaczego (transkrypcja przestaje pomagać, a zaczyna blokować).
- Tempo mowy: suwak 0.3–1.0, domyślnie 0.4 dla japońskiego, 0.6 dla szwedzkiego.
- Wielkość tekstu docelowego: trzy stopnie.
- **Motyw** — jedyne ustawienie globalne, nie per język: preset barw plus przełącznik
  ciemny / jasny / systemowy (sekcja 9.1).

### 8.6 Statystyki

Jeden ekran, cztery rzeczy: prognoza powtórek na 14 dni (słupki), trafienia za pierwszym
razem w czasie (linia), liczba dojrzałych kart (`interval >= 21`) obok liczby wszystkich
pozycji, oraz **najczęściej mylone pary**.

Para, a nie pojedyncze słowo: quiz wie nie tylko, że użytkownik się pomylił, ale też z czym
— `水 → 氷`, `7 ×`. To jest informacja, której klasyczna samoocena nie potrafi dać, i to jest
główny argument za quizem poza obiektywnością oceny. Lista jest jednocześnie wejściem do
zawieszenia karty i do reguły z sekcji 6.3.

### 8.7 Stany brzegowe — zaprojektować, nie zostawiać

| Stan | Co pokazujemy |
|---|---|
| Brak powtórek na dziś | Ile wróci jutro + przycisk „ucz się do przodu" |
| Brama etapu | Ile znaków zostało do odblokowania zdań |
| Zaległości > 20 nowych | Wyjaśnienie, czemu nie dokładamy nowych |
| Offline | Dyskretny znacznik, sesja działa normalnie — dystraktory są w pobranej talii, quiz nie potrzebuje sieci |
| Sync nie działa | Znacznik + „ostatnia synchronizacja: …", nigdy modal |
| Talia nie pobrana | Pobierz teraz (rozmiar w MB), wymaga sieci |
| Interferencja es / pt | Moduł przy dodawaniu drugiego z pary, „dodaję mimo to" / „później". Mówimy raz |
| Za mało dystraktorów | **Nic nie pokazujemy.** Karta po cichu spada na `reveal` (sekcja 7.1) |

Żaden z tych stanów nie jest modalem i żaden nie blokuje sesji — to moduły w miejscu treści
ekranu startu.

---

## 9. Brief dla Claude Design

### Kontekst

Aplikacja do nauki języków, używana codziennie po 10 minut, najczęściej w ruchu, jedną ręką,
często wieczorem. Odbiorca: dorosły, techniczny, uczy się z własnej woli, nie znosi
infantylizacji. Ekran ma jedno zadanie: **treść ma być czytelna i nic nie może odciągać
uwagi od słowa na środku.**

### Kierunek

Punktem wyjścia jest **rytm i zapis**: stały puls, przewidywalne odstępy, treść w centrum,
wszystko inne cofnięte o krok. Bliżej marginesu rękopisu niż pulpitu aplikacji.

Motyw równo rozłożonych znaczników (pasek postępu sesji, wykres prognozy, znak marki)
niech będzie jednym powtarzającym się elementem, a nie trzema różnymi rozwiązaniami.
Nazwa jest pusta semantycznie — patrz sekcja 0 po kierunek dla znaku i po listę rzeczy,
których w identyfikacji nie chcemy.

**Typografia jest tu produktem, nie dekoracją.** Tekst w języku docelowym to bohater ekranu.

Aplikacja obsługuje pięć języków i trzy systemy pisma, więc krój tekstu docelowego jest
**parametrem adaptera**, nie stałą w arkuszu stylów. Potrzebna jest jedna skala typograficzna,
która działa dla wszystkich, oraz nadpisania per pismo:

- **łacińskie** (es, pt, sv) — szeryfowy tekstowy, normalna interlinia
- **hangul** (ko) — krój z pełnym pokryciem hangul, nieco większa interlinia
- **kana i kanji** (ja) — szeryfowy japoński (Mincho / Serif JP) zamiast domyślnego
  bezszeryfowego; tak wygląda tekst w książkach, a nie w aplikacjach, i to jest świadoma
  różnica. Interlinia znacząco większa, bo nad znakami staje furigana.

Furigana ustawiana przez `<ruby>`, nie przez ręczne pozycjonowanie. Układ nie może
skakać w momencie jej pojawienia się — miejsce na nią rezerwujemy z góry.

Zaprojektuj kartę tak, żeby wyglądała dobrze **dla wszystkich pięciu języków**: pokaż
ten sam ekran z hiszpańskim zdaniem, koreańskim i japońskim z furiganą. Jeśli którykolwiek
wymaga innego układu, to znaczy, że układ jest za sztywny.

Przewidz też kierunek RTL w strukturze komponentów (arabski dochodzi po v1) — chodzi
o użycie właściwości logicznych CSS zamiast `left` i `right`, nie o pełne wsparcie teraz.

### Ograniczenia

- Ciemne tło domyślnie, jasny motyw jako opcja. Nie czysta czerń — atramentowy granat.
- **Dokładnie jeden kolor akcentu** i użyty oszczędnie: luka w zdaniu, nowe słowo, trafienie.
- Zero ilustracji, maskotek, emoji w UI, gradientów na przyciskach.
- Opcje quizu muszą być rozróżnialne pozycją i kształtem, nie samym kolorem — używane setki
  razy, często bez patrzenia. Ten sam wymóg dotyczy stanów po odpowiedzi: trafiona opcja
  niesie znak `✓`, wybrana błędnie `×`, a nie tylko inny odcień obrysu.
- Strefy dotyku minimum 44 px, dolna trzecia ekranu zarezerwowana na akcje (zasięg kciuka).
- Animacja tylko w jednym miejscu: moment ujawnienia odpowiedzi. Reszta bez ruchu.
  `prefers-reduced-motion` respektowane.
- Kontrast AA na wszystkim, łącznie z tekstem pomocniczym.

### Ekrany — stan po sesji Claude Design

Zaprojektowane i zamknięte, w `docs/design/nabu-wariant-quizowy.html`:
karta `quiz-cloze` w trzech stanach (przed wyborem, trafienie, pudło) w trzech systemach
pisma, desktop 1280, wariant jasny, start i koniec sesji, onboarding, kalibracja, statystyki,
ustawienia oraz komplet stanów brzegowych z tabeli 8.7.

Do zaprojektowania później, przy odpowiednich etapach:

1. Karty produkcji: wpisywanie, klawiatura jamo, klawiatura kana, płótno do rysowania
   z podpowiedzią konturu (M8)
2. Karta `reveal` — fallback z samooceną, w tym samym kierunku co reszta (M2)
3. Ekran wyboru presetu motywu (M9)

### Elementy, których nie chcemy

Kart z cieniami i zaokrągleniami rodem z szablonu, pasków postępu z procentami,
odznak, pochwał („Świetnie!"), liczników serii, dużych kolorowych nagłówków sekcji.

---

## 9.1 Motywy — kontrakt tokenów

Makieta (`docs/design/nabu-wariant-quizowy.html`) ma wszystkie kolory wpisane na sztywno
w atrybutach `style`. Do odtworzenia jest z niej **dokładnie trzynaście wartości
semantycznych** i to jest cały kontrakt motywu. Żaden komponent nie zna wartości heksowej.

| token | Atrament ciemny | Atrament jasny | użycie |
|---|---|---|---|
| `--bg` | `#0F1622` | `#F3F2EE` | tło ekranu |
| `--surface` | `#131C2B` | `#E9E7E0` | tło trafionej opcji |
| `--text` | `#E7EAF2` | `#1B2233` | tekst docelowy i główny |
| `--text-2` | `#8A94A9` | `#6A7080` | tłumaczenia, opisy |
| `--text-3` | `#4C5670` | `#9A9FAC` | etykiety mono, opcje wygaszone |
| `--border` | `#2C3852` | `#C9C5BB` | obrys opcji przed wyborem |
| `--border-quiet` | `#1D2739` | `#E0DDD5` | linie, opcje po odpowiedzi |
| `--accent` | `#8FA8F0` | `#4358C9` | luka, nowe słowo, trafienie, pudła na pasku |
| `--tick-done` | `#5A6580` | `#9AA0AE` | karty zrobione |
| `--tick-future` | `#222C40` | `#DCD9D1` | karty przed nami |
| `--tick-current` | `#E7EAF2` | `#1B2233` | bieżąca karta |
| `--wrong-border` | `#3A2A33` | `#D8C9C4` | obrys błędnie wybranej opcji |
| `--wrong-text` | `#6E7788` | `#8A8078` | tekst błędnie wybranej opcji |

**Rozszerzenie z 12.08.2026 — cztery tokeny materiału.** Wygląd poszedł w stronę
„nowocześnie, lekko": zaokrąglenia, wypełnienia i cień zamiast samych obrysów. Trzy rzeczy,
których powyższa lista nie potrafiła wyrazić, dostały własne tokeny, bo każda z nich
potrzebuje wartości koloru — a kolor nie może wyjść poza warstwę motywu.

| token | ciemny (Atrament) | jasny (Atrament) | użycie |
|---|---|---|---|
| `--surface-2` | `#222A39` | `#F6F7F9` | warstwa nad kartą: trafiona opcja, arkusz |
| `--accent-2` | `#A09FF4` | `#4434C4` | drugi kraniec gradientu akcentu |
| `--accent-text` | `#000000` | `#FFFFFF` | tekst na wypełnieniu akcentem |
| `--shadow` | `#000000` | `#171D2B` | baza cienia, zawsze z przezroczystością |

Gradient nie łamie zasady jednego akcentu: `--accent-2` to ten sam akcent obrócony o 16°
i przesunięty jasnością, konsekwentnie w stronę oddalającą od czerwieni. Kontrakt liczy
teraz siedemnaście wartości, a bramka 178 asercji — szczegóły i granice w `docs/ADR-002-motywy.md`.

**Czego w tej liście nie ma: czerwieni.** Pudło jest oznaczone znakiem `×`, wygaszeniem
i ledwie ciepłym obrysem, a błędy na pasku postępu mają kolor akcentu. Zasada „dokładnie
jeden kolor akcentu" jest w makiecie dotrzymana i preset jej nie łamie — **preset to inna
rampa neutralna i inna barwa akcentu, nic więcej.**

**Presety v1** (nazwy robocze, do zmiany bez konsekwencji technicznych): Atrament (z makiety,
domyślny), Grafit, Mech, Piasek, Wysoki kontrast. Każdy w wariancie jasnym i ciemnym.
Przełącznik `ciemny / jasny / systemowy` działa niezależnie od wyboru presetu, więc
„systemowy" oznacza po prostu wybór wariantu przez `prefers-color-scheme`.

**Bramka jakości.** Test w Vitest przechodzi po wszystkich presetach × oba warianty i liczy
kontrast każdej pary tekst-na-tle. Preset łamiący AA (4.5:1 dla tekstu, 3:1 dla elementów
nietekstowych) nie przechodzi CI. To jest tańsze i pewniejsze niż oglądanie kolorów okiem,
a brief i tak wymaga AA na wszystkim, łącznie z tekstem pomocniczym.

Poza CSS zmiana motywu aktualizuje jeszcze `<meta name="theme-color">` i właściwość
`color-scheme`, żeby pasek stanu w zainstalowanym PWA i kontrolki systemowe nie zostały
przy poprzednim motywie.

## 9.2 Kroje pisma — waga jest tu wymaganiem, nie optymalizacją

Makieta używa Spectral, Archivo, IBM Plex Mono, Noto Serif JP i Noto Serif KR, i wciąga je
z `fonts.gstatic.com`. **Aplikacja ma działać w samolocie, więc `preconnect` do Google Fonts
nie może przetrwać przeniesienia do kodu.** Kroje hostujemy u siebie i subsetujemy w buildzie
(krok `07-fonts.ts`):

| krój | subset | szacowana waga |
|---|---|---|
| Spectral, Archivo, IBM Plex Mono | latin + latin-ext (polskie znaki) | 30–60 kB każdy |
| Noto Serif KR | sylaby hangul obecne w `data/ko/` + pełne jamo | 200–400 kB |
| Noto Serif JP | kana + kanji obecne w `data/ja/` + interpunkcja | 200–500 kB |

Subset liczymy z zawartości `data/{lang}/`, więc regeneruje się przy każdym przebiegu danych.
Bez tego kroku samo Noto Serif JP waży kilka megabajtów i psuje precache — a bramka M0
„otwiera się offline" przechodzi wtedy tylko pozornie, bo pierwsze uruchomienie bez sieci
pokazuje tekst japoński krojem systemowym albo nie pokazuje go wcale.

---

## 10. Pipeline budowania danych

### 10.1 Kroki

| Skrypt | Wejście | Wyjście | Uwagi |
|---|---|---|---|
| `01-fetch` | Tatoeba downloads (bz2) | surowe TSV w `cache/` | na laptopie, nie w przeglądarce — CORS znika |
| `02-tokenize` | zdania + kod języka | tokeny, czytania, lematy | wtyczka wg `adapter.tokenizer` (poniżej) |
| `03-frequency` | FrequencyWords `{lang}_50k` **albo korpus** | mapa lemat → ranga | patrz `freqSource` poniżej |
| `04-glosses` | polski Wikisłownik | glosy PL + części mowy | **bez modelu językowego**, patrz 10.3 |
| `05-assemble` | powyższe | `data/{lang}/*.json` | filtry jakości, sortowanie po `band` |
| `06-distractors` | złożona talia | `distractors[]` + flaga `quiz` | część mowy, pasmo, kształt (10.1b) |
| `07-fonts` | zestaw znaków z `data/` | `public/fonts/*.woff2` | subset, patrz 9.2 |
| `08-strokes` | KanjiVG | `data/ja/strokes.json` | tylko japoński, do `produce-draw` |

### 10.1a Tokenizery — trzy wtyczki, nie trzy pipeline'y

| `adapter.tokenizer` | Implementacja | Języki |
|---|---|---|
| `space` | podział regexem `\p{L}+`, lemat = forma z małej litery | es, pt, sv, ko (z hakami adaptera) |
| `dict` | dopasowanie dwukierunkowe do słownika CC-CEDICT | zh |
| `morph` | analizator morfologiczny | ja (kuromoji + IPADIC) |

**Korekta wobec pierwszej wersji planu.** Pisało tu, że koreański obsłuży `space`, bo
formalnie ma spacje, a aglutynacja tylko „obniża trafność dopasowania". Pomiar pokazał
19 zdań przy bramce 400 — nie obniża trafności, likwiduje materiał. `space` wystarcza,
ale dopiero z trzema hakami w adapterze:

- `splitToken` — rozdziela wyraz na rdzeń i partykułę. Bez tego luka wypadała na `일을`
  albo `밤은`, czyli na rzeczowniku zrośniętym z końcówką: karta uczyła złej jednostki,
  a różnica kształtu między opcjami była wskazówką gramatyczną.
- `lemmaCandidates` — heurystycznie sprowadza formę odmienioną do postaci słownikowej,
  bo Wikisłownik ma wyłącznie te ostatnie. Obsługuje też ściągnięcia (`했` → `하`),
  co pokrywa całą klasę czasowników na `하다`.
- `quiz.clozePos` — zawęża luki do form nieodmiennych.

Podniesienie koreańskiego do `morph` (mecab-ko) zostaje zadaniem po v1. Te haki
doprowadzają go do stanu używalnego, ale nie zastępują analizy morfologicznej.

**Chiński: dopasowanie musi być dwukierunkowe.** Zachłanne dopasowanie od lewej myli się
przewidywalnie i zawsze w tę samą stronę: w `打网球` („grać w tenisa") bierze rzadkie `打网`
i zostawia `球` („kula") jako osobne słowo, które trafia potem do luki w zdaniu o tenisie.
Tniemy więc raz od lewej, raz od prawej i wybieramy wynik z mniejszą liczbą tokenów, potem
z mniejszą liczbą tokenów jednoznakowych (pojedynczy znak zwykle jest resztką po złym cięciu),
a przy remisie rozstrzygamy częstością słów. Bez tego ostatniego kroku `马上去` tnie się na
`马` + `上去` zamiast `马上` + `去` — oba warianty mają po dwa tokeny, różnią się tym, że
`马上` jest słowem pospolitym.

Wtyczka zwraca zawsze ten sam kształt: `{ s, r, b, pos, lemma }`. Dla języków łacińskich
`r` jest `null` — pipeline i UI muszą to znosić bez rozgałęzień. `pos` przestaje być
opcjonalne: dobór dystraktorów wymaga zgodności części mowy, więc wtyczka `space` też musi
je podać. Dla klasy A wystarczy prosty tagger albo część mowy z listy częstości; przy braku
danych wpisujemy `unk` i taka pozycja dobiera dystraktory wyłącznie po znaczeniu i paśmie.

### 10.1b Dystraktory — `06-distractors`

Quiz stoi na jakości błędnych opcji. Losowe słowa zamieniłyby kartę w test czytania, więc
kandydaci muszą być z tego samego pasma częstości i pola znaczeniowego, a przy CJK dodatkowo
podobni kształtem.

**Zakres: wyłącznie słownictwo talii.** Kandydatów szukamy pośród lematów obecnych już
w `core.json` i `sentences.json` danego języka. Te mają polską glosę z kroku `04`, więc
dystraktory nie kosztują ani jednego dodatkowego wywołania modelu. Jest to też sensowniejsze
dydaktycznie: błędna opcja jest słowem, którego użytkownik i tak się uczy.

Dla każdego lematu mogącego być odpowiedzią:

- **filtr**: ta sama część mowy, ranga w oknie 0,5–2× rangi celu, inna glosa PL
  (odrzucamy synonimy — dwie poprawne odpowiedzi to zepsuta karta)
- **wynik** = `w₁ · podobieństwo znaczeniowe + w₂ · podobieństwo kształtu + w₃ · bliskość pasma`
- bierzemy 8 najlepszych → `distractors[]`; jeśli powyżej progu jest ich mniej niż
  `adapter.quiz.minOptions − 1`, ustawiamy `quiz: false`

**Podobieństwo znaczeniowe bez wywołań API.** Model osadzeń uruchamiany lokalnie w Node
(`@xenova/transformers`, `paraphrase-multilingual-MiniLM`) po glosach polskich. Kilka tysięcy
glos na język liczy się w sekundy, deterministycznie, offline, bez klucza. To ważne, bo krok
`06` przebiega przy każdej zmianie talii — gdyby kosztował wywołania API, przestalibyśmy go
uruchamiać.

**Podobieństwo kształtu** to wtyczka wybierana przez `adapter.quiz.shape`, dokładnie tym samym
wzorcem co tokenizery wyżej:

| wtyczka | jak liczy | efekt |
|---|---|---|
| `edit` | odległość edycyjna na formie zapisanej, waga niska | dla es/pt/sv decyduje znaczenie: `agua` / `leche` / `pan` / `tiempo` |
| `kanji-components` | Jaccard po rozkładzie na komponenty z KRADFILE, z mapą aliasów `水 ↔ 氵 ↔ 汁` | `水` / `氷` / `湯` |
| `jamo` | odległość edycyjna po rozłożeniu sylab na jamo | `물` / `불` / `말` |

Funkcja rozkładu hangulu jest ta sama, której używa klawiatura jamo z sekcji 7.2 — jedna
implementacja, dwa zastosowania, w katalogu adaptera.

**Bramka**: po pierwszym przebiegu na język przejrzyj ręcznie 20 losowych zestawów. Szukasz
dwóch rzeczy — czy wśród dystraktorów nie ma drugiej poprawnej odpowiedzi i czy nie są
tak odległe, że karta rozwiązuje się sama. Odsetek `quiz: false` zapisz do `build/report.json`;
powyżej 15% oznacza za ostry próg albo za małą talię.

### 10.1c Skąd biorą się rangi częstości

Adapter wybiera źródło polem `freqSource`:

- **`list`** — gotowa lista FrequencyWords. Właściwa wszędzie tam, gdzie da się ją
  sensownie podzielić na słowa, czyli w językach ze spacjami.
- **`corpus`** — liczymy sami, tokenizując korpus tym samym analizatorem, którego używa
  pipeline.

Japoński wymusił drugą ścieżkę. Lista FrequencyWords dla japońskiego powstała z naiwnego
podziału, więc jej czoło to pojedyncze kany (い, の, は, て), a **formy słownikowe
czasowników i przymiotników w ogóle w niej nie występują**: `食べる`, `起きる`, `大きい`,
`くださる` — wszystkie nieobecne, choć rzeczowniki (`水` 485, `建物` 1255) są w porządku.
Ranga liczona z korpusu ma dodatkowo tę zaletę, że opisuje dokładnie ten materiał,
którego uczymy.

Przy liczeniu z korpusu pomijamy cząstki gramatyczne i końcówki posiłkowe — zdominowałyby
czoło listy tak samo, jak psują listę gotową. **Nie znaczy to, że są „nieznane":** dostają
pasmo 0 i nie liczą się do limitu `maxUnknown`. Bez tego rozróżnienia każde japońskie
zdanie miało po kilka tokenów bez pasma i wypadało na filtrze — pierwszy przebieg odrzucał
86% materiału właśnie z tego powodu.

### 10.2 Filtry jakości w `05-assemble`

Odrzucamy zdanie, jeśli: krótsze niż `minTokens` lub dłuższe niż `maxTokens`; zawiera nazwę
własną; zawiera znaki spoza zestawu języka; trafia w `adapter.blocklist` albo w listę
wulgaryzmów po stronie polskiej; nie ma tłumaczenia polskiego; któryś token nie dostał
czytania ani rangi; `band` przekracza 12000; nie ma w nim słowa nadającego się na lukę.

**Luka musi być najrzadszym słowem zdania** i mieć glosę. To jest zasada i+1 z sekcji 3.1
przeniesiona do builda: skoro zdanie ma zawierać jedno nowe słowo, to pytanie musi dotyczyć
właśnie jego. Gdyby luka wypadła na słowie łatwiejszym, trudność karty byłaby gdzie indziej
niż pytanie. Liczebniki wykluczamy — Wikisłownik tagguje je jako przymiotniki, przez co
powstawały karty rozwiązywalne samą składnią.

**Odrzuty dzielą się na trzy rodzaje i mieszanie ich czyni bramkę bezużyteczną:**

| rodzaj | co znaczy | mierzone |
|---|---|---|
| poza zasięgiem | korpus nie ma polskiego tłumaczenia | nie, to granica źródła |
| jakość | zdanie jest wadliwe: obce znaki, nazwa własna, wulgaryzm, zbyt rzadkie słowo | **tak, bramka M1** |
| przydatność | zdanie poprawne, ale nie nadaje się na tę kartę | nie, to świadomy wybór |

Raport `build/report-{lang}.json` podaje wszystkie trzy osobno, wraz z próbką dwunastu
zdań rozłożoną po całym paśmie — po pierwszym przebiegu trzeba go przejrzeć ręcznie.

### 10.3 Tłumaczenia i glosy — bez modelu językowego

**ZMIANA WZGLĘDEM PIERWOTNEGO PLANU, potwierdzona danymi w M1.** Plan zakładał, że model
tłumaczy glosy z angielskiego na polski, wsadowo, z walidacją liczby linii i ponowieniami.
Okazało się to niepotrzebne — oba potrzebne teksty istnieją już po polsku, napisane
przez ludzi:

**Tłumaczenia zdań pochodzą z samej Tatoeby**, w dwóch warstwach zaufania:

| warstwa | co to | es | pt | sv |
|---|---|---|---|---|
| `direct` | zdanie ma wprost powiązanie z polskim | 11 336 | 1 550 | 2 421 |
| `pivot` | powiązanie przez angielski, **tylko gdy prowadzi do dokładnie jednego** zdania polskiego | +31 800 | +30 600 | +5 760 |

Łańcuchy prowadzące do kilku zdań polskich odrzucamy w całości. To 13–15% puli i akurat
te przypadki, w których angielski jest wieloznaczny, czyli gdzie znaczenie najłatwiej
dryfuje. Bez warstwy `pivot` portugalski miałby 1 550 zdań i dobór i+1 nie miałby z czego
wybierać — to jest jedyny powód, dla którego ją wprowadzamy.

**Glosy słów pochodzą z polskiego Wikisłownika** (przez kaikki.org): zawiera hasła
obcojęzyczne z polskimi definicjami — `hund` → `pies`, `agua` → `woda` — i pokrywa wszystkie
pięć języków v1 oraz chiński i arabski na później. Daje przy okazji część mowy, bez której
nie da się dobierać dystraktorów.

**Wybór znaczenia jest zależny od kontekstu.** Wikisłownik podaje kilka znaczeń; bierzemy
to, które pojawia się w polskim tłumaczeniu danego zdania (porównanie po rdzeniu, bo polski
odmienia), a przy braku lub wielu dopasowaniach — pierwsze. Bez tego szwedzkie `slav`
w zdaniu „Jag är en slav" dostaje glosę „Słowianin" zamiast „niewolnik". Nie ujednoznaczniamy
na siłę: błędny wybór jest gorszy od domyślnego.

Co odpada razem z modelem: klucz API, koszt wywołań, walidacja odpowiedzi, ponowienia,
ryzyko jakości tłumaczeń z sekcji 14, a przede wszystkim **niemożność powtórzenia builda
przez kogokolwiek bez własnego klucza**.

Rdzeń słownictwa (etap 1, ~80 pozycji na język) nadal **tłumaczymy ręcznie i commitujemy**.
Definicja słownikowa bywa dla tych słów za szeroka, a użytkownik zobaczy je setki razy.

### 10.4 Licencje

`docs/ATTRIBUTION.md` w repo (krok `05` kopiuje go do `data/`), link ze stopki aplikacji:
Tatoeba — CC BY 2.0 FR; FrequencyWords — CC BY-SA 3.0; **polski Wikisłownik — CC BY-SA 3.0**;
JMdict/EDRDG — CC BY-SA; KRADFILE/EDRDG — CC BY-SA; KanjiVG — CC BY-SA 3.0;
kuromoji i IPADIC — Apache 2.0. Dane pochodne dziedziczą SA — dotyczy to katalogu `data/`,
nie kodu aplikacji.

Kroje pisma mają własne licencje i też trafiają do pliku: Spectral, Archivo, Noto Serif JP,
Noto Serif KR — SIL OFL 1.1; IBM Plex Mono — SIL OFL 1.1. Subsetowanie jest przez OFL
dozwolone; nazwy plików pochodnych nie mogą sugerować, że to oryginalne kroje.

---

## 11. Dźwięk — sprawdzone, ścieżka rozstrzygnięta

**Wynik: `speechSynthesis` działa w Safari i w PWA dodanym do ekranu głównego
(test z 12.08.2026, `docs/ADR-001-audio.md`). Plan B odpada.**

Znaczy to, że pipeline nie dostaje kroku generowania audio, talia nie rośnie
o pliki dźwiękowe, a M5 sprowadza się do implementacji `speak()` i karty
`quiz-listen`. Reszta tej sekcji zostaje jako zapis tego, czego szukaliśmy
i dlaczego test stał w M0 — gdyby kiedyś pojawiła się regresja w iOS,
procedura jest gotowa do powtórzenia.

Test stał pierwotnie przed M5, bo dotyczy warstwy dźwięku. To był błąd w kolejności:
plan B (audio generowane w buildzie) dokłada krok do pipeline'u i zmienia wagę talii,
czyli wpływa na decyzje podejmowane w M1 — pakowanie `sentences.json`, budżet precache'a,
rozmiar podawany na ekranie „talia niepobrana". Test trwa dziesięć minut, więc nie ma
powodu trzymać go dłużej.

Są świeże zgłoszenia, że w PWA dodanym do ekranu głównego na iOS 26.x odtwarzanie audio
przestaje działać, mimo że w Safari działa poprawnie (`AudioContext` zostaje w stanie
`suspended`). Dla tej aplikacji to ryzyko krytyczne.

Test: minimalna strona z manifestem na Pages, przycisk wywołujący `speechSynthesis.speak()`
z japońskim `lang`. Sprawdź w Safari i po dodaniu do ekranu głównego.

- **Działa w obu** → `speechSynthesis`, ścieżka podstawowa.
- **Działa tylko w Safari** → plan B: audio wygenerowane w buildzie (`data/{lang}/audio/`),
  odtwarzane elementem `<audio>` z pliku, precache w service workerze. Waży więcej,
  ale jest przewidywalne. Generowanie: dowolne TTS na laptopie, format `.m4a` albo `.opus`.
- **Nie działa nigdzie** → wracamy do rozmowy o architekturze.

Warstwa audio ma być za interfejsem `speak(text, lang, rate)`, żeby zmiana ścieżki
nie dotykała komponentów.

---

## 12. Kolejność prac z bramkami

Każdy etap kończy się warunkiem. Nie przechodź dalej bez spełnienia.

### M0 — szkielet (1 dzień)
Vite + React + TS, Tailwind mapowany na tokeny z sekcji 9.1, presety motywów z testem
kontrastu, prymitywy UI z makiety, kroje hostowane lokalnie, routing, PWA manifest,
service worker, deploy na Pages przez GitHub Action, reguła ESLint pilnująca adapterów,
**oraz test audio z sekcji 11**.

**Bramka:** aplikacja instaluje się na iPhonie i otwiera offline; trzy stany karty z makiety
renderują się poprawnie w każdym presecie i obu wariantach; test kontrastu przechodzi;
`docs/ADR-001-audio.md` ma wynik, nie pustą sekcję.

### M1 — pipeline i trzy języki klasy A (1,5 dnia)
Cały pipeline uruchomiony na hiszpańskim, portugalskim i szwedzkim — żadnej segmentacji,
żadnych czytań, sam rdzeń mechaniki. `data/{es,pt,sv}/*.json` w repo, razem z dystraktorami
z kroku `06` i zsubsetowanymi krojami z kroku `07`.

Trzy języki naraz, a nie jeden, bo **trzeci kosztuje dziesięć minut i natychmiast ujawnia
wszystko, co zostało zaszyte na sztywno** w pierwszym.

**Bramka:** po 400 zdań na język, `report-{lang}.json` przejrzany, **odrzuty jakościowe**
poniżej 30% (nie mylić z odrzutami przydatności — patrz 10.2), `quiz: false` poniżej 15%,
20 losowych zestawów dystraktorów na język przejrzanych ręcznie (10.1b), `05-assemble`
uruchamiany tą samą komendą z innym kodem języka.

**Wynik (12.08.2026):**

| | zdań | leksykon | odrzuty jakościowe | nieprzydatne na kartę | `quiz: false` | pasma |
|---|---|---|---|---|---|---|
| hiszpański | 10 949 | 2 445 | 25% | 50% | 0 | 63–11 998 |
| portugalski | 8 423 | 1 771 | 24% | 50% | 0 | 57–11 978 |
| szwedzki | 2 323 | 974 | 15% | 56% | 1 | 50–11 973 |
| koreański | 761 | 301 | 16% | 79% | 4% | 85–29 831 |
| japoński | 16 699 | 1 323 | 8% | 55% | 0% | 57–19 998 |
| chiński | 1 481 | 416 | 18% | 58% | 1% | 72–12 000 |

Bramka przechodzi we wszystkich sześciu językach. Talia waży 22 MB w paczkach po 500 zdań;
kroje zsubsetowane do znaków z `data/` mieszczą się w 1,34 MB, z czego Noto Serif JP
970 kB przy 2539 znakach (pełny krój ma 12,9 MB).

Chiński ma osobną kategorię odrzutu, której nie ma nigdzie indziej: **5 219 zdań w zapisie
tradycyjnym**. Tatoeba trzyma oba warianty pisma pod jednym kodem `cmn`, a uczący się wybiera
jeden — talia z obydwoma naraz uczyłaby dwóch systemów pod jedną nazwą. Odrzut idzie do
`innyZapis`, obok `pozaZasięgiem`, a nie do jakości: to nie jest wada zdania (patrz 10.2).

Koreański i japoński weszły wcześniej, niż przewidywał plan (M3 i M4), i to celowo:
uruchomienie pipeline'u na obcym piśmie ujawniło osiem założeń zaszytych pod klasę A,
z których każde poprawiono w adapterze, a nie w rdzeniu. To jest ta sama logika,
dla której M1 bierze trzy języki naraz zamiast jednego — tylko zastosowana o poziom wyżej.
Co z M3 i M4 zostaje: etapy i bramy dla obcego pisma, renderowanie `<ruby>` w sesji
oraz karty `script`.

### M2 — silnik SRS + sesja quizowa (2 dni)
Czysty TS, testy jednostkowe na kroki nauki, przejścia interwałów **oraz mapowanie wyniku
quizu na ocenę wraz z ochroną przed strzałem** (sekcja 6.2). Dexie. Sesja z kartami
`quiz-word` i `quiz-cloze`, `reveal` jako fallback. Przełącznik języka.
Bez logowania, bez dźwięku, bez produkcji.

**Bramka:** testy przechodzą; trzy dni realnego używania na dwóch językach naraz; interwały
rosną; karty z pudłem wracają w tej samej sesji; przełączenie języka nie miesza stanów;
poprawna odpowiedź nie stoi dwa razy z rzędu w tym samym miejscu; log zawiera `chosen`.

**Wynik (12.08.2026):** 48 testów jednostkowych na silnik i kolejkę, przepływ sprawdzony
w przeglądarce od pierwszego uruchomienia do zapisu w IndexedDB. Karty z pudłem wracają
(sesja 8 kart rozrosła się do 14), log zapisuje `chosen` przy każdej odpowiedzi.
Zostaje do sprawdzenia jedyna rzecz, której nie da się zasymulować: trzy dni realnego
używania na dwóch językach naraz.

Przy okazji wyszła wada danych niewidoczna w samych danych: zdanie „Lo hecho, hecho está"
z luką na pierwszym `hecho` zostawiało drugie widoczne obok — odpowiedź stała w pytaniu.
Krok `05` odrzuca teraz zdania, w których lemat luki nie jest jedyny.

**Poprawka po pierwszym użyciu na telefonie (12.08.2026).** Sesja przechodziła do następnej
karty natychmiast po dotknięciu opcji. Testy tego nie łapały, bo zapis, ocena i kolejka
działały poprawnie — brakowało jedynej rzeczy, dla której ten quiz w ogóle istnieje:
**odsłonięcia**. Użytkownik nie widział, czy trafił, co znaczyło słowo ani czym różniło się
od tego, które wybrał, więc karta nie uczyła niczego, a nieznajomość języka czyniła wynik
nierozpoznawalnym. Trzy zmiany:

- między odpowiedzią a następną kartą jest stan pośredni: luka wypełnia się poprawnym słowem,
  opcje przechodzą w stany `correct` / `chosen-wrong` / `dimmed`, pod zdaniem pojawia się
  czytanie i glosa. Dalej idzie się dotknięciem;
- `autoAdvance` domyślnie **wyłączone** (było `true` z czasów, gdy ekran nie miał odsłonięcia,
  czyli oznaczało „przewiń natychmiast"); migracja bazy do wersji 2 zeruje je także tam,
  gdzie zdążyło się zapisać. Przy włączonym trafienie znika po 1,4 s, pudło zawsze czeka;
- „było trudne" po trafieniu wróciło i zaraz wypadło. Zbudowane zgodnie z sekcją 6.2,
  odrzucone po jednym spojrzeniu na ekran: samoocena wraca tylnymi drzwiami, a „Trudne"
  i tak powstaje z czasu odpowiedzi. Reguła skreślona w 6.2.

Druga wada z tej samej sesji: dwa zdania z tym samym słowem w luce weszły jako dwie osobne
nowe pozycje. Karta niesie lemat (`CardState.lemma`), a dobór nowych pozycji pomija lematy,
na które karta już istnieje — także takie w krokach nauki, które `knownLemmas` celowo pomija.

To już czwarty raz, gdy wada widoczna wyłącznie na wyrenderowanej karcie przechodzi przez
dane i testy (poprzednie: `見 = けん opinia`, „Lo ___ hecho está", CC-CEDICT z CRLF).
Ręczny przegląd na urządzeniu jest osobną bramką, nie formalnością.

### M3 — koreański: etap 0 i obce pismo (0,5 dnia)
Karty `script` (hangul), etapy i bramy, `hasScriptStage` w adapterze.
Koreański jest tu celowo przed japońskim: wprowadza obcy alfabet, ale bez segmentacji
i bez problemu czytań. Rozdziela dwie trudności, które inaczej debugowałbyś naraz.
**Bramka:** nowe konto koreańskie przechodzi hangul → rdzeń → zdania, bramy działają,
język łaciński nadal startuje od `core`.

**Wynik (12.08.2026):** etapy 0 i 1 powstają w buildzie, bez nowego pobrania. Inwentarz
pisma jest w adapterze (`scriptItems`), bo kana i hangul to zbiory zamknięte, których nie ma
w żadnym korpusie: 92 znaki kany (46 hiragany + 46 katakany, bez dakuten — `が` to `か`
ze znakiem dźwięczności, czyli reguła, nie osobna pozycja) i 40 liter hangulu w romanizacji
poprawionej. Rdzeń to setka najczęstszych słów talii, wzięta z puli luk — ma już glosę,
część mowy, pasmo i czytanie, więc nie kosztuje nic. Cena: dziedziczy `clozePos`, czyli
dla japońskiego i chińskiego są to same rzeczowniki.

Etap wyznacza brama „90% pozycji etapu ma `interval >= 7`", z liczebnością etapu jako
mianownikiem — bez tego konto bez ani jednej karty spełniałoby warunek (0 z 0 to 100%).
Powtórki przychodzą ze wszystkich etapów naraz, nowe pozycje tylko z bieżącego.
Ręczne odblokowanie jest w ustawieniach języka, zgodnie z sekcją 2a.

Dwie wady wyszły dopiero na kartach:

- **token bez rangi trafiał do luki z pasmem 0.** Sekcja 10.1 mówi wprost, że słowo spoza
  listy częstości nie może być luką, ale kod podstawiał za brak rangi zero — a zero jest
  w tej skali NAJCZĘSTSZYM słowem. Na zdaniach było niewidoczne; rdzeń, który sortuje
  po paśmie, otwierał się na `홈페이지` i `통역사` jako najpospolitszych słowach koreańskiego;
- **okno pasma dla dystraktorów jest mnożnikowe**, więc na czele listy niemal puste:
  dla słowa o randze 14 zakres 0,4–2,5× to rangi 6–35. Rdzeń składa się dokładnie z takich
  słów, więc pierwsza karta etapu 1 (`人`) miała jednego dystraktora i spadła na samoocenę.
  Doszedł próg bezwzględny: rozpiętość do 60 rang jest zawsze dopuszczalna.

### M4 — japoński: segmentacja i furigana (1,5 dnia)
kuromoji jako wtyczka `morph` w `02-tokenize`, czytania, renderowanie `<ruby>`.
**Bramka — najważniejsza w projekcie:** ręcznie sprawdź 20 losowych zdań z `data/ja/sentences.json`.
Każdy token ma poprawne czytanie w kontekście, segmentacja daje słowa a nie pojedyncze znaki,
furigana renderuje się nad właściwymi znakami. Jeśli nie — popraw wtyczkę, zanim pójdziesz
dalej. Wszystko późniejsze stoi na tych danych.

Druga bramka, równie ważna: **przejrzyj `src/` pod kątem `if (lang === 'ja')`.**
Każde takie miejsce poza `src/langs/` przenieś do adaptera. To moment, w którym
wielojęzyczność albo przetrwa, albo zacznie się osypywać. Od M0 pilnuje tego reguła ESLint,
więc bramka jest przeglądem tego, co reguła przepuściła, a nie szukaniem od zera.

Trzecia: dystraktory `kanji-components` na 20 losowych kartach. To jedyny język, w którym
podobieństwo kształtu naprawdę decyduje o trudności karty.

**Wynik (12.08.2026):** furigana renderuje się przez `<ruby>`, nad wyrazami w zdaniu i nad
odsłoniętą luką. Kiedy się pojawia, decyduje ustawienie `furigana`: `always` od razu,
`after` (domyślnie) dopiero po odpowiedzi — inaczej czytanie jest ściągą, a nie nauką.
Nad CZYM się pojawia, decyduje adapter (`showReading`): japoński pokazuje je tylko nad kanji,
bo `ねこ` nad `ねこ` powtarza to, co widać; chiński nad wszystkim, bo pinyinu nie da się
odczytać ze znaku. Interlinia adaptera rezerwuje miejsce z góry, więc pojawienie się czytania
nie przesuwa zdania.

Wymagało to zmiany sposobu składania zdania: zamiast dwóch napisów wokół luki ekran dostaje
listę tokenów wraz z tym, co je rozdziela (`layoutAroundCloze`). Interpunkcja zostaje na
swoim miejscu, a każdy wyraz może dostać własne czytanie.

Przegląd dwunastu zdań rozłożonych po całym paśmie: czytania poprawne w kontekście
(`仕事{しごと}`, `歯医者{はいしゃ}`, `頻繁{ひんぱん}`), segmentacja daje słowa a nie znaki
(`両方`, `風景`, `とり上げ`), a dystraktory trafiają w kształt bez wymuszania:
`歯医者` dostaje `医師` i `記者` (wspólny `者`), `地図` dostaje `地面` (wspólny `地`),
`カナダ` dostaje `サッカー` i `コート`, czyli katakanę do katakany.

### M5 — dźwięk (0,5 dnia)
Implementacja `speak(text, lang, rate)` na `speechSynthesis` (ścieżka potwierdzona
w M0, ADR-001), karta `quiz-listen`, wykrycie braku głosu systemowego dla języka
wraz z instrukcją jego pobrania.
**Bramka:** japoński czyta się poprawnie w zainstalowanym PWA.

### M6 — konto i sync (1 dzień)
Firebase Auth anonimowo + upgrade, Firestore, reguły w repo, kolejka offline,
eksport i import JSON.
**Bramka:** wyloguj, zaloguj na drugim urządzeniu, stan się zgadza. Sesja w trybie
samolotowym działa i synchronizuje się po powrocie sieci.

### M7 — poziomy i kalibracja (0,5 dnia)
Wybór poziomu, kalibracja 25 pozycji, adaptacja pasma.
Kalibracja jest bez quizu — pytanie „znasz to słowo?" z odpowiedzią tak/nie/niepewny.
Tu chodzi o zasięg słownictwa, nie o test.
**Bramka:** nowe konto z poziomem „radzę sobie" dostaje zdania i+1 od pierwszej sesji.

### M8 — produkcja (1,5 dnia)
Karty `produce-*` z sekcji 7. Kolejno: `produce-type` dla klasy A (najtańsze, weryfikuje
mapowanie ocen z 6.4), klawiatura jamo i `produce-jamo`, klawiatura kana i `produce-kana`,
na końcu `08-strokes` i `produce-draw`.
**Bramka:** karta z `interval >= 21` wchodzi w produkcję we wszystkich pięciu językach;
japoński rysunek 水 oceniany poprawnie, w tym wykrycie złej kolejności kresek;
klawiatura jamo składa 물 z ㅁ + ㅜ + ㄹ.

### M9 — dopracowanie (1 dzień)
Statystyki z mylonymi parami, pełne ustawienia, wybór presetu motywu, wszystkie stany
brzegowe, cofanie odpowiedzi, obsługa klawiatury na desktopie, dostępność.

### Później
Chiński (tokenizer `dict` + pinyin z CC-CEDICT), arabski (RTL, zależny od pewnej warstwy audio),
kolejne języki klasy A na żądanie, ocena odpowiedzi otwartych przez model, wyjaśnienia różnic
przy mylonych parach („氷 to woda zamarznięta — kreska u góry"), FSRS na zebranym logu,
tryb słuchania w tle.

---

## 13. Definicja ukończenia v1

- Instaluje się na iPhonie, działa w samolocie, dźwięk gra
- **Pięć języków działa: hiszpański, portugalski, szwedzki, koreański, japoński**
- Japoński od zera: kana → rdzeń → zdania z furiganą, bez ręcznej ingerencji
- Przełączanie języka jednym dotknięciem, stany rozdzielone, budżet dzienny per język
- Reguła ESLint na literały językowe przechodzi; poza `src/langs/` nie ma rozgałęzień
- Sesja 10-minutowa kończy się bez wyjątku w konsoli i bez utraty postępu przy przerwaniu
- **Samoocena występuje wyłącznie na karcie `reveal`** — wszędzie indziej ocena jest wynikiem
  quizu albo produkcji
- Karta dojrzała wchodzi w produkcję: wpisanie (es/pt/sv), jamo (ko), kana i rysowanie (ja)
- Wszystkie presety motywu przechodzą test kontrastu AA w CI
- Aplikacja działa i jest obsługiwalna z klawiatury na desktopie 1280
- Logowanie Google, synchronizacja między dwoma urządzeniami, eksport do pliku
- Repo publiczne, README z instrukcją builda, `ATTRIBUTION.md`, reguły Firestore w repo
- **Build danych powtarzalny przez każdego, bez klucza API** — całość ze źródeł otwartych
- **Zero sekretów serwerowych w repo i w bundlu.** Konfiguracja webowa Firebase, w tym
  `apiKey`, jest z założenia publiczna i musi być w kliencie — chronią jej reguły
  bezpieczeństwa, a nie tajność. Dodatkowo App Check, żeby darmowy limit nie był otwarty
  dla dowolnego skryptu

---

## 14. Ryzyka

| Ryzyko | Prawdopodobieństwo | Reakcja |
|---|---|---|
| ~~Audio nie działa w zainstalowanym PWA~~ | **zamknięte** | sprawdzone w M0: działa, ADR-001 |
| Safari czyści IndexedDB | średnie | Firestore + ręczny eksport, oba w v1 |
| kuromoji myli czytania w kontekście | niskie–średnie | bramka M4, ewentualnie MeCab z UniDic |
| Dystraktory za łatwe albo dwuznaczne | **wysokie** | ręczny przegląd 20 zestawów na język (10.1b); odrzucanie synonimów po glosie |
| Quiz podbija interwały przez trafione strzały | średnie | reguły z 6.2, testy jednostkowe w M2, produkcja od `interval >= 21` |
| Waga krojów psuje precache | średnie | subset z kroku `07-fonts`, bramka M0 |
| ~~Jakość glos PL z modelu~~ | **zamknięte** | model nie bierze udziału — glosy z Wikisłownika, tłumaczenia zdań z Tatoeby (10.3) |
| Glosa nie pasuje do kontekstu zdania | średnie | wybór znaczenia po polskim tłumaczeniu zdania (10.3); reszta to znane ograniczenie, `data/ATTRIBUTION.md` |
| Talia rośnie ponad limit cache Safari | niskie | **zrobione w M1** — paczki po 500 zdań plus `meta.json` z indeksem |
| Free tier Firestore | bardzo niskie | paczkowanie po 400 kart, 1–2 zapisy na sesję |
| Kod zaszywa się pod japoński | **wysokie** | trzy języki w M1, przegląd `grep` w M4, procedura z sekcji 15 |
| Brak głosu TTS dla języka w systemie | niskie | **otwarte** — wykrycie przy dodaniu języka + instrukcja pobrania głosu, M5 |

---

## 15. Dodanie nowego języka — procedura

Ma być na tyle mechaniczna, żeby dało się ją wykonać w godzinę dla języka klasy A.
Opisz ją w `docs/ADDING-A-LANGUAGE.md` i utrzymuj aktualną — to jest test na to,
czy architektura naprawdę jest wielojęzyczna.

1. `src/langs/{code}/index.ts` — adapter wg kontraktu z sekcji 2.1, razem z `quiz.shape`
   i `production`
2. Sprawdź dostępność źródeł: kod Tatoeba, lista częstości `{code}_50k`, głos TTS w systemie
3. Przetłumacz ręcznie rdzeń słownictwa (~80 pozycji) → `build/core/{code}.tsv`
4. `npm run build:data {code}` → `data/{code}/`, potem `npm run build:fonts`
5. Przejrzyj `build/report.json`: odrzuty, rozkład pasm, 20 losowych zdań,
   **20 losowych zestawów dystraktorów i odsetek `quiz: false`**
6. Dopisz język do listy w `src/langs/index.ts` i do ekranu wyboru
7. Jeśli pismo jest obce: `hasScriptStage: true` + `data/{code}/script.json`
8. Test akceptacyjny: nowe konto, poziom „od zera", trzy sesje bez wyjątku

Punkt 3 jest jedynym, którego nie da się zautomatyzować i jedynym, którego nie wolno
oddać modelowi. Rdzeń użytkownik zobaczy setki razy.

Dla języka klasy A punkty 1–8 nie wymagają nowego kodu: `quiz.shape: 'edit'`
i `production: ['type']` są obsłużone. Nowa wtyczka kształtu albo nowy tryb produkcji
to osobne zadanie, nie część procedury dodania języka — i sygnał, że dokładany język
nie jest klasy A.

---

## 16. Zasady dla implementacji

- Logika SRS w czystym TypeScripcie, bez importów z React, pokryta testami. Dotyczy to także
  mapowania wyniku quizu na ocenę (6.2) — to jest logika, nie warstwa widoku.
- Żadnych rozgałęzień `if (lang === 'ja')` w komponentach UI. Różnice językowe siedzą
  w konfiguracji adaptera i w danych. Pilnuje tego reguła ESLint od M0, nie `grep` w M4.
- **Żadnych wartości heksowych w komponentach.** Kolor pochodzi z tokenu z sekcji 9.1 albo
  nie istnieje. Nowy token to zmiana kontraktu — dopisz go do wszystkich presetów naraz,
  inaczej test kontrastu tego nie wyłapie.
- Każda operacja zapisu ma działać offline. Sieć jest opcjonalna wszędzie poza logowaniem.
- Teksty interfejsu po polsku, w plikach lokalizacji od początku — nie wplecione w JSX.
- Commituj `data/` jako osobne commity od kodu, z wersją w nazwie, żeby diff kodu był czytelny.
- Makieta z sesji Claude Design leży w `docs/design/`. Jest referencją układu, typografii
  i zachowania, a nie kodem do skopiowania — kolory z niej przechodzą do tokenów, nie do JSX.
