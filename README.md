# Nabu

Trener języków obcych dla Polaków: uczy zdaniami z prawdziwego korpusu, z poprawnymi
czytaniami i wymową, działa offline i mieści się w dziesięciu minutach dziennie.

Pełna specyfikacja — model danych, silnik powtórek, pipeline i kolejność prac z bramkami —
jest w [`plan.md`](plan.md). Ten plik opisuje tylko, jak uruchomić repo.

## Stan: M5

Działająca sesja: dodajesz język, przechodzisz przez pismo, rdzeń i zdania, słuchasz
wymowy, a postęp zapisuje się lokalnie po każdej odpowiedzi. Nie ma jeszcze logowania
ani synchronizacji.

| jest | nie ma |
|---|---|
| Vite + React + TypeScript, PWA z precache | statystyk i pełnych ustawień (M9) |
| silnik SM-2 z krokami nauki i ochroną przed strzałem | kart produkcji i rysowania (M8) |
| furigana i pinyin nad wyrazami, sterowane ustawieniem | |
| etapy: pismo → rdzeń → zdania, z bramą opanowania | klawiatur kana i jamo (M8) |
| Dexie jako źródło prawdy, zapis po każdej odpowiedzi | logowania i synchronizacji (M6) |
| mowa systemowa i karty ze słuchu od trzeciej powtórki | |
| pipeline 01–07, sześć języków z dystraktorami | kalibracji poziomu wejściowego (M7) |
| 17 tokenów motywu, 5 presetów, bramka kontrastu w CI | |
| kroje zsubsetowane do znaków z talii, razem 1,36 MB | |

### Dane

| język | zdań | rdzeń | pismo | odrzuty jakościowe | pasma |
|---|---|---|---|---|---|
| hiszpański | 10 909 | 100 | — | 25% | 63–11 998 |
| portugalski | 8 398 | 100 | — | 24% | 57–11 978 |
| szwedzki | 2 315 | 100 | — | 15% | 50–11 973 |
| koreański | 752 | 100 | 40 | 16% | 85–29 831 |
| japoński | 18 490 | 100 | 92 | 8% | 55–19 998 |
| chiński | 1 481 | 100 | — | 18% | 72–12 000 |

Japoński ma pełną segmentację i czytania: `毎日[まいにち]`, `興味深い[きょうみぶかい]`,
katakana bez furigany. Koreański ma rozdzielone partykuły, więc luka wypada na samym
rzeczowniku, a partykuła zostaje w zdaniu jako wskazówka składniowa. Chiński jest cięty
dwukierunkowo po CC-CEDICT i niesie pinyin z tonami; talia uczy wyłącznie zapisu
uproszczonego, a 5 219 zdań w zapisie tradycyjnym odpada jako inny system pisma.

**Nic w `data/` nie jest napisane maszynowo.** Zdania i ich polskie tłumaczenia pochodzą
z Tatoeby, glosy z polskiego Wikisłownika, rangi z list częstości napisów filmowych.
Build nie wymaga klucza API i da się go powtórzyć w całości — szczegóły w
[`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md) i sekcji 10.3 planu.

## Uruchomienie

```sh
npm install
npm run dev          # http://localhost:5173/#/start
```

Trasy:

- `#/start` — dodanie języka, ustawienia sesji, wejście w naukę
- `#/demo` — trzy stany karty, trzy systemy pisma, przełącznik presetów
- `#/audio` — test warstwy dźwięku z sekcji 11 planu, do wykonania na iPhonie

## Komendy

| komenda | co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` | sprawdzenie typów i build produkcyjny |
| `npm run preview` | podgląd builda, do testu offline |
| `npm test` | Vitest — kontrast presetów, arytmetyka hangulu, spójność tokenów |
| `npm run lint` | ESLint, w tym reguła o kodach języków i kolorach |
| `npm run check` | wszystko naraz, tak jak w CI |
| `npm run build:data es` | pełny pipeline danych dla języka → `data/es/` |
| `npm run build:fonts` | subsetuje kroje lokalnie (wymaga `pip install fonttools brotli`) |

## Dwie reguły, których pilnuje CI

**Kod języka nie może wyjść poza `src/langs/`.** Rozgałęzienie `lang === 'ja'` gdziekolwiek
indziej jest początkiem osypywania się wielojęzyczności, a widać to dopiero przy piątym
języku. Plan przewidywał `grep` w M4; reguła ESLint działa od M0 i nie da się jej przeoczyć.

**Kolor nie może wyjść poza `src/theme/`.** Wartość heksowa w komponencie omija presety
i test kontrastu naraz. Kolory żyją jako siedemnaście tokenów semantycznych opisanych
w [`docs/ADR-002-motywy.md`](docs/ADR-002-motywy.md).

## Sprawdzenie offline

Bramka M0 brzmi „instaluje się na iPhonie i otwiera offline". Lokalnie:

```sh
npm run build && npm run preview
```

Otwórz podgląd, poczekaj na rejestrację service workera, odetnij sieć i odśwież.
Na urządzeniu: otwórz adres z Pages w Safari, dodaj do ekranu głównego, włącz tryb
samolotowy, uruchom z ikony.

## Dokumenty

- [`plan.md`](plan.md) — specyfikacja produktu i plan wdrożenia
- [`docs/ADR-001-audio.md`](docs/ADR-001-audio.md) — test dźwięku w zainstalowanym PWA
- [`docs/ADR-002-motywy.md`](docs/ADR-002-motywy.md) — tokeny, presety, odstępstwa od makiety
- [`docs/design/`](docs/design/) — makieta z sesji Claude Design, referencja układu

## Licencje

Kod: MIT. Dane w `data/` dziedziczą SA po źródłach (Tatoeba, FrequencyWords, Wikisłownik,
CC-CEDICT, kuromoji/IPADIC) — komplet w [`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md),
skąd build kopiuje go do `data/ATTRIBUTION.md` przy każdym przebiegu.

Kroje w `public/fonts/` to subsety Archivo, Spectral, IBM Plex Mono, Noto Serif JP
i Noto Serif KR, wszystkie na SIL OFL 1.1.
