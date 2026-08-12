# Nabu

Trener języków obcych dla Polaków: uczy zdaniami z prawdziwego korpusu, z poprawnymi
czytaniami i wymową, działa offline i mieści się w dziesięciu minutach dziennie.

Pełna specyfikacja — model danych, silnik powtórek, pipeline i kolejność prac z bramkami —
jest w [`plan.md`](plan.md). Ten plik opisuje tylko, jak uruchomić repo.

## Stan: M1

Szkielet aplikacji z warstwą motywów, karta z makiety na żywych tokenach oraz **komplet
danych dla trzech języków klasy A**. Nie ma jeszcze silnika powtórek ani logowania.

| jest | nie ma |
|---|---|
| Vite + React + TypeScript, PWA z precache | silnika SRS i kolejki sesji |
| 13 tokenów motywu, 5 presetów × jasny/ciemny/systemowy | Firebase, kont, synchronizacji |
| bramka kontrastu AA w CI | kart produkcji i rysowania |
| karta quizu w trzech systemach pisma, obsługa klawiatury | japońskiego i koreańskiego (M3, M4) |
| adaptery pięciu języków wg kontraktu z sekcji 2.1 | podpięcia danych pod sesję (M2) |
| pipeline danych 01–07, `data/{es,pt,sv}` z dystraktorami | |
| kroje zsubsetowane do znaków z talii, razem 190 kB | |

### Dane

| język | zdań | leksykon | odrzuty jakościowe | pasma |
|---|---|---|---|---|
| hiszpański | 10 949 | 2 445 | 25% | 63–11 998 |
| portugalski | 8 423 | 1 771 | 24% | 57–11 978 |
| szwedzki | 2 323 | 974 | 15% | 50–11 973 |

**Nic w `data/` nie jest napisane maszynowo.** Zdania i ich polskie tłumaczenia pochodzą
z Tatoeby, glosy z polskiego Wikisłownika, rangi z list częstości napisów filmowych.
Build nie wymaga klucza API i da się go powtórzyć w całości — szczegóły w
[`data/ATTRIBUTION.md`](data/ATTRIBUTION.md) i sekcji 10.3 planu.

## Uruchomienie

```sh
npm install
npm run dev          # http://localhost:5173/#/demo
```

Trasy w M1:

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
| `npm run build:fonts` | subsetuje kroje do znaków obecnych w `data/` |

## Dwie reguły, których pilnuje CI

**Kod języka nie może wyjść poza `src/langs/`.** Rozgałęzienie `lang === 'ja'` gdziekolwiek
indziej jest początkiem osypywania się wielojęzyczności, a widać to dopiero przy piątym
języku. Plan przewidywał `grep` w M4; reguła ESLint działa od M0 i nie da się jej przeoczyć.

**Kolor nie może wyjść poza `src/theme/`.** Wartość heksowa w komponencie omija presety
i test kontrastu naraz. Kolory żyją jako trzynaście tokenów semantycznych opisanych
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

Kod: MIT. Dane w `data/` powstają w M1 i będą dziedziczyć licencje źródeł
(Tatoeba, FrequencyWords, KRADFILE, KanjiVG) — szczegóły w sekcji 10.4 planu,
`data/ATTRIBUTION.md` powstanie razem z pierwszą talią.

Kroje w `public/fonts/` to subsety Archivo, Spectral, IBM Plex Mono, Noto Serif JP
i Noto Serif KR, wszystkie na SIL OFL 1.1.
