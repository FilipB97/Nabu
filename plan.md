# Nabu — specyfikacja produktu i plan wdrożenia

> Dokument wejściowy dla sesji Claude Code. Zawiera decyzje produktowe, model danych,
> architekturę, wytyczne UI dla Claude Design i kolejność prac z bramkami.
> Wszystko, co jest tu opisane jako **decyzja**, jest przesądzone — nie negocjuj tego od nowa.
> Wszystko, co jest opisane jako **do sprawdzenia**, wymaga eksperymentu przed implementacją.

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

Rdzeń nie wie, jakiego języka uczy. Cała wiedza o języku siedzi w jednym pliku
`src/langs/{code}.ts` i w danych wyprodukowanych przez build.

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
};
```

Dodanie języka to nowy plik adaptera, przebieg builda i ręcznie przetłumaczony rdzeń
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
| 3 | `production` | tłumaczenie PL → język docelowy, dyktowanie | opcjonalny |

**Opanowany** = 90% pozycji etapu ma `interval >= 7` dni.

Etapy nie blokują sztywno — użytkownik może je odblokować ręcznie w ustawieniach,
ale domyślnie prowadzimy go po kolei i mówimy dlaczego.

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
│  ├─ 02-tokenize-ja.ts     kuromoji + furigana
│  ├─ 03-frequency.ts
│  ├─ 04-glosses.ts         LLM: EN → PL
│  ├─ 05-assemble.ts        składa talie, liczy pasma
│  └─ cache/                surowe pobrania, .gitignore
├─ data/                    WYNIK builda, commitowany
│  ├─ es/  pt/  sv/        core.json  sentences.json  meta.json
│  ├─ ko/                  + script.json  (hangul)
│  └─ ja/                  + script.json  (kana)
├─ src/
│  ├─ app/                  routing, layout, providers
│  ├─ session/              silnik sesji + komponenty kart
│  ├─ srs/                  algorytm, czysty TS, bez zależności
│  ├─ store/                Dexie, sync, model
│  ├─ langs/                adaptery: es.ts pt.ts sv.ts ko.ts ja.ts + index.ts
│  ├─ audio/                TTS + fallback
│  └─ ui/                   prymitywy: Button, Sheet, Ticks…
├─ public/                  manifest, ikony, sw
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
      "audio": null
    }
  ]
}
```

`b` = ranga częstości lematu. `band` = maksimum z tokenów, czyli trudność zdania.
`tokens` niosą wszystko, czego potrzebuje UI: furiganę (`<ruby>s<rt>r</rt></ruby>`),
segmentację do cloze i informację, które słowo jest nowe.

**`r` podajemy tylko wtedy, gdy różni się od `s`** — dla kany i alfabetu łacińskiego jest `null`,
co oszczędza ~40% wagi pliku.

### 5.2 Talia słów — `data/{lang}/core.json`

```jsonc
{
  "items": [
    { "id": "ja-w-mizu", "term": "水", "reading": "みず", "romaji": "mizu",
      "pl": "woda", "en": "water", "band": 412, "stage": "core",
      "examples": ["ja-s-82931"] }
  ]
}
```

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
`{ ts, id, grade, ms, mode }`. Służy statystykom i przyszłemu FSRS.

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

---

## 7. Typy kart

| Typ | Przód | Tył | Etap |
|---|---|---|---|
| `script` | znak: あ | czytanie: *a*, wymowa | 0 |
| `word` | słowo: 水 | czytanie, PL, przykładowe zdanie | 1 |
| `cloze` | zdanie z luką + tłumaczenie PL | pełne zdanie z furiganą, słowo + glosa | 2 |
| `listen` | tylko dźwięk, przycisk „powtórz" | zdanie + tłumaczenie | 2 |
| `produce` | zdanie po polsku | wersja docelowa + dźwięk | 3 |

**Każda karta musi zadawać pytanie, na które da się odpowiedzieć z pamięci, a odsłonięcie
musi pokazać coś, czego nie było widać na przodzie.** To brzmi banalnie, ale to jest
dokładnie ten warunek, który łatwo złamać, budując kartę „pokaż zdanie → pokaż słowo z tego zdania".

Karta `listen` jest tania w implementacji i bardzo mocna dla początkujących — ta sama treść
co `cloze`, inny kanał. Wprowadzać ją, gdy karta ma `reps >= 3`.

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

- Postęp: pasek segmentów, jeden na kartę, czerwony tam, gdzie było „nie pamiętam".
- Odsłonięcie: dotknięcie w dowolnym miejscu karty albo duży przycisk.
- Cztery oceny z przewidywanym interwałem pod etykietą.
- **Cofnij ostatnią odpowiedź** — nietrafione dotknięcie jest normalne, a bez cofania
  psuje harmonogram i frustruje. Jeden poziom cofnięcia wystarczy.
- Dźwięk: automatycznie po odsłonięciu, z możliwością wyłączenia. Przycisk „posłuchaj"
  zawsze dostępny.
- Przerwanie sesji jest bezpieczne: stan zapisany po każdej odpowiedzi, powrót wznawia.
- Ekran końcowy: liczba kart, ile wróci dziś, prognoza na jutro. Bez konfetti.

### 8.5 Ustawienia wyświetlania (per język)

- **Furigana**: zawsze / dopiero po odsłonięciu / nigdy. Domyślnie „po odsłonięciu"
  dla etapu 2, „zawsze" dla etapu 1.
- **Romaji**: włączone tylko na etapie 0–1, potem domyślnie wyłączone z komunikatem
  wyjaśniającym dlaczego (transkrypcja przestaje pomagać, a zaczyna blokować).
- Tempo mowy: suwak 0.3–1.0, domyślnie 0.4 dla japońskiego, 0.6 dla szwedzkiego.
- Wielkość tekstu docelowego: trzy stopnie.

### 8.6 Statystyki

Jeden ekran, cztery rzeczy: prognoza powtórek na 14 dni (słupki), skuteczność w czasie
(linia), liczba dojrzałych kart (`interval >= 21`), najczęściej mylone pozycje (lista,
z możliwością zawieszenia karty).

### 8.7 Stany brzegowe — zaprojektować, nie zostawiać

| Stan | Co pokazujemy |
|---|---|
| Brak powtórek na dziś | Ile wróci jutro + przycisk „ucz się do przodu" |
| Brama etapu | Ile znaków zostało do odblokowania zdań |
| Zaległości > 20 nowych | Wyjaśnienie, czemu nie dokładamy nowych |
| Offline | Dyskretny znacznik, sesja działa normalnie |
| Sync nie działa | Znacznik + „ostatnia synchronizacja: …", nigdy modal |
| Talia nie pobrana | Pobierz teraz (rozmiar w MB), wymaga sieci |

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
- **Dokładnie jeden kolor akcentu** i użyty oszczędnie: luka w zdaniu, nowe słowo, błąd.
- Zero ilustracji, maskotek, emoji w UI, gradientów na przyciskach.
- Cztery przyciski ocen muszą być rozróżnialne kształtem i pozycją, nie tylko kolorem —
  używane setki razy, często bez patrzenia.
- Strefy dotyku minimum 44 px, dolna trzecia ekranu zarezerwowana na akcje (zasięg kciuka).
- Animacja tylko w jednym miejscu: moment odsłonięcia odpowiedzi. Reszta bez ruchu.
  `prefers-reduced-motion` respektowane.
- Kontrast AA na wszystkim, łącznie z tekstem pomocniczym.

### Ekrany do zaprojektowania (priorytet malejąco)

1. Karta w sesji — warianty: `script`, `word`, `cloze` przed i po odsłonięciu,
   każdy pokazany w trzech systemach pisma (łacińskim, hangul, japońskim)
2. Ekran startu sesji z przełącznikiem języka i podziałem na aktywne / utrzymywane
3. Ekran końcowy sesji
4. Onboarding: wybór języka i poziomu
5. Kalibracja
6. Statystyki
7. Ustawienia
8. Stany brzegowe z tabeli 8.7

### Elementy, których nie chcemy

Kart z cieniami i zaokrągleniami rodem z szablonu, pasków postępu z procentami,
odznak, pochwał („Świetnie!"), liczników serii, dużych kolorowych nagłówków sekcji.

---

## 10. Pipeline budowania danych

### 10.1 Kroki

| Skrypt | Wejście | Wyjście | Uwagi |
|---|---|---|---|
| `01-fetch` | Tatoeba downloads (bz2) | surowe TSV w `cache/` | na laptopie, nie w przeglądarce — CORS znika |
| `02-tokenize` | zdania + kod języka | tokeny, czytania, lematy | wtyczka wg `adapter.tokenizer` (poniżej) |
| `03-frequency` | FrequencyWords `{lang}_50k` | mapa lemat → ranga | lemat z tokenizera, fallback na formę powierzchniową |
| `04-glosses` | glosy EN | glosy PL | LLM wsadowo, 50 na wywołanie, z walidacją liczby linii |
| `05-assemble` | powyższe | `data/{lang}/*.json` | filtry jakości, sortowanie po `band` |

### 10.1a Tokenizery — trzy wtyczki, nie trzy pipeline'y

| `adapter.tokenizer` | Implementacja | Języki |
|---|---|---|
| `space` | podział regexem `\p{L}+`, lemat = forma z małej litery | es, pt, sv i cała klasa A |
| `dict` | zachłanne najdłuższe dopasowanie do słownika | zh (po v1) |
| `morph` | analizator morfologiczny | ja (kuromoji + IPADIC), ko (opcjonalnie mecab-ko) |

Koreański formalnie ma spacje, więc `space` wystarczy do v1 — aglutynacja końcówek
obniża trafność dopasowania do listy częstości, ale nie na tyle, żeby to blokowało start.
Podniesienie go do `morph` to osobne zadanie po v1, nie warunek wejścia.

Wtyczka zwraca zawsze ten sam kształt: `{ s, r, b, pos, lemma }`. Dla języków łacińskich
`r` jest `null`, a `pos` może być `null` — pipeline i UI muszą to znosić bez rozgałęzień.

### 10.2 Filtry jakości w `05-assemble`

Odrzucamy zdanie, jeśli: krótsze niż 4 lub dłuższe niż 18 tokenów; zawiera nazwę własną
spoza listy dozwolonych; zawiera znaki spoza zestawu języka; nie ma tłumaczenia angielskiego;
któryś token nie dostał czytania; `band` przekracza 12000.

Raport z odrzutów zapisujemy do `build/report.json` — po pierwszym przebiegu warto go
przejrzeć ręcznie, bo tam widać, który filtr jest za ostry.

### 10.3 Tłumaczenia

Model tłumaczy **z angielskiego na polski, mając japoński oryginał jako kontekst**.
Sam angielski gubi rejestr i liczbę. Format wejścia i wyjścia: lista numerowana,
walidacja zgodności liczby pozycji, ponowienie przy niezgodności, odrzut po drugiej próbie.

Rdzeń słownictwa (etap 1, ~80 pozycji na język) **tłumaczymy ręcznie i commitujemy**.
To zbyt ważne, żeby zostawić modelowi — te słowa użytkownik zobaczy setki razy.

### 10.4 Licencje

`data/ATTRIBUTION.md` w repo, link ze stopki aplikacji:
Tatoeba — CC BY 2.0 FR; FrequencyWords — CC BY-SA 3.0; JMdict/EDRDG — CC BY-SA;
kuromoji — Apache 2.0. Dane pochodne od list częstości dziedziczą SA.

---

## 11. Dźwięk — do sprawdzenia przed implementacją

**Zanim napiszesz warstwę audio, wykonaj ten test i zapisz wynik w `docs/ADR-001-audio.md`.**

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

### M0 — szkielet (0,5 dnia)
Vite + React + TS, Tailwind z tokenami, routing, PWA manifest, service worker,
deploy na Pages przez GitHub Action.
**Bramka:** aplikacja instaluje się na iPhonie i otwiera offline.

### M1 — pipeline i trzy języki klasy A (1 dzień)
Cały pipeline uruchomiony na hiszpańskim, portugalskim i szwedzkim — żadnej segmentacji,
żadnych czytań, sam rdzeń mechaniki. `data/{es,pt,sv}/*.json` w repo.

Trzy języki naraz, a nie jeden, bo **trzeci kosztuje dziesięć minut i natychmiast ujawnia
wszystko, co zostało zaszyte na sztywno** w pierwszym.

**Bramka:** po 400 zdań na język, `report.json` przejrzany, odrzuty poniżej 30%,
`05-assemble` uruchamiany tą samą komendą z innym kodem języka.

### M2 — silnik SRS + sesja (1,5 dnia)
Czysty TS, testy jednostkowe na kroki nauki i przejścia interwałów. Dexie. Sesja z kartami
`word` i `cloze`. Przełącznik języka. Bez logowania, bez dźwięku.
**Bramka:** testy przechodzą; trzy dni realnego używania na dwóch językach naraz;
interwały rosną; karty z „nie pamiętam" wracają w tej samej sesji; przełączenie języka
nie miesza stanów.

### M3 — koreański: etap 0 i obce pismo (0,5 dnia)
Karty `script` (hangul), etapy i bramy, `hasScriptStage` w adapterze.
Koreański jest tu celowo przed japońskim: wprowadza obcy alfabet, ale bez segmentacji
i bez problemu czytań. Rozdziela dwie trudności, które inaczej debugowałbyś naraz.
**Bramka:** nowe konto koreańskie przechodzi hangul → rdzeń → zdania, bramy działają,
język łaciński nadal startuje od `core`.

### M4 — japoński: segmentacja i furigana (1,5 dnia)
kuromoji jako wtyczka `morph` w `02-tokenize`, czytania, renderowanie `<ruby>`.
**Bramka — najważniejsza w projekcie:** ręcznie sprawdź 20 losowych zdań z `data/ja/sentences.json`.
Każdy token ma poprawne czytanie w kontekście, segmentacja daje słowa a nie pojedyncze znaki,
furigana renderuje się nad właściwymi znakami. Jeśli nie — popraw wtyczkę, zanim pójdziesz
dalej. Wszystko późniejsze stoi na tych danych.

Druga bramka, równie ważna: **przejrzyj `src/` pod kątem `if (lang === 'ja')`.**
Każde takie miejsce poza `src/langs/` przenieś do adaptera. To moment, w którym
wielojęzyczność albo przetrwa, albo zacznie się osypywać.

### M5 — dźwięk (0,5 dnia)
Wynik testu z sekcji 11, implementacja wybranej ścieżki, karta `listen`.
**Bramka:** japoński czyta się poprawnie w zainstalowanym PWA.

### M6 — konto i sync (1 dzień)
Firebase Auth anonimowo + upgrade, Firestore, reguły w repo, kolejka offline,
eksport i import JSON.
**Bramka:** wyloguj, zaloguj na drugim urządzeniu, stan się zgadza. Sesja w trybie
samolotowym działa i synchronizuje się po powrocie sieci.

### M7 — poziomy i kalibracja (0,5 dnia)
Wybór poziomu, kalibracja 25 pozycji, adaptacja pasma.
**Bramka:** nowe konto z poziomem „radzę sobie" dostaje zdania i+1 od pierwszej sesji.

### M8 — dopracowanie (1 dzień)
Statystyki, ustawienia wyświetlania, wszystkie stany brzegowe, cofanie odpowiedzi,
jasny motyw, dostępność.

### Później
Chiński (tokenizer `dict` + pinyin z CC-CEDICT), arabski (RTL, zależny od pewnej warstwy audio),
kolejne języki klasy A na żądanie, karty `produce`, ocena odpowiedzi otwartych przez model,
FSRS na zebranym logu, tryb słuchania w tle.

---

## 13. Definicja ukończenia v1

- Instaluje się na iPhonie, działa w samolocie, dźwięk gra
- **Pięć języków działa: hiszpański, portugalski, szwedzki, koreański, japoński**
- Japoński od zera: kana → rdzeń → zdania z furiganą, bez ręcznej ingerencji
- Przełączanie języka jednym dotknięciem, stany rozdzielone, budżet dzienny per język
- `grep -r "=== 'ja'" src/ --exclude-dir=langs` nie zwraca nic. To samo dla pozostałych kodów
- Sesja 10-minutowa kończy się bez wyjątku w konsoli i bez utraty postępu przy przerwaniu
- Logowanie Google, synchronizacja między dwoma urządzeniami, eksport do pliku
- Repo publiczne, README z instrukcją builda, `ATTRIBUTION.md`, reguły Firestore w repo
- Zero kluczy API i sekretów w kodzie klienta

---

## 14. Ryzyka

| Ryzyko | Prawdopodobieństwo | Reakcja |
|---|---|---|
| Audio nie działa w zainstalowanym PWA | średnie | plan B z sekcji 11 |
| Safari czyści IndexedDB | średnie | Firestore + ręczny eksport, oba w v1 |
| kuromoji myli czytania w kontekście | niskie–średnie | bramka M3, ewentualnie MeCab z UniDic |
| Jakość glos PL z modelu | średnie | rdzeń ręcznie, reszta z walidacją i próbką kontrolną |
| Talia rośnie ponad limit cache Safari | niskie | dziel `sentences.json` na paczki po 500, ładuj na żądanie |
| Free tier Firestore | bardzo niskie | paczkowanie po 400 kart, 1–2 zapisy na sesję |
| Kod zaszywa się pod japoński | **wysokie** | trzy języki w M1, przegląd `grep` w M4, procedura z sekcji 15 |
| Brak głosu TTS dla języka w systemie | niskie | wykrycie przy dodaniu języka + instrukcja pobrania głosu |

---

## 15. Dodanie nowego języka — procedura

Ma być na tyle mechaniczna, żeby dało się ją wykonać w godzinę dla języka klasy A.
Opisz ją w `docs/ADDING-A-LANGUAGE.md` i utrzymuj aktualną — to jest test na to,
czy architektura naprawdę jest wielojęzyczna.

1. `src/langs/{code}.ts` — adapter wg kontraktu z sekcji 2.1
2. Sprawdź dostępność źródeł: kod Tatoeba, lista częstości `{code}_50k`, głos TTS w systemie
3. Przetłumacz ręcznie rdzeń słownictwa (~80 pozycji) → `build/core/{code}.tsv`
4. `npm run build:data -- {code}` → `data/{code}/`
5. Przejrzyj `build/report.json`: odrzuty, rozkład pasm, 20 losowych zdań
6. Dopisz język do listy w `src/langs/index.ts` i do ekranu wyboru
7. Jeśli pismo jest obce: `hasScriptStage: true` + `data/{code}/script.json`
8. Test akceptacyjny: nowe konto, poziom „od zera", trzy sesje bez wyjątku

Punkt 3 jest jedynym, którego nie da się zautomatyzować i jedynym, którego nie wolno
oddać modelowi. Rdzeń użytkownik zobaczy setki razy.

---

## 16. Zasady dla implementacji

- Logika SRS w czystym TypeScripcie, bez importów z React, pokryta testami.
- Żadnych rozgałęzień `if (lang === 'ja')` w komponentach UI. Różnice językowe siedzą
  w konfiguracji adaptera i w danych.
- Każda operacja zapisu ma działać offline. Sieć jest opcjonalna wszędzie poza logowaniem.
- Teksty interfejsu po polsku, w plikach lokalizacji od początku — nie wplecione w JSX.
- Commituj `data/` jako osobne commity od kodu, z wersją w nazwie, żeby diff kodu był czytelny.
