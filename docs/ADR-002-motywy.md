# ADR-002 — motywy, tokeny i kontrast

**Status:** przyjęte
**Kontekst:** sekcja 9.1 planu, M0

## Decyzja

Motyw to trzynaście wartości semantycznych i nic więcej. Komponenty nie znają wartości
heksowych — sięgają po `var(--nabu-*)` przez klasy Tailwinda, a reguła ESLint odrzuca
każdy kolor wpisany poza `src/theme/`.

Preset zmienia rampę neutralną i barwę akcentu. Nie dokłada kolorów, nie zmienia układu,
nie wprowadza wyjątków. Dzięki temu piąty preset kosztuje tyle, co wpisanie trzynastu
wartości, a nie przegląd całego interfejsu.

Ustawienie ma dwie niezależne osie: **preset** (Atrament, Grafit, Mech, Piasek, Wysoki
kontrast) i **tryb** (ciemny, jasny, systemowy). „Systemowy" nie jest trzecim wariantem
palety, tylko sposobem wybrania jednego z dwóch — dlatego w kodzie `mode` i `variant`
to osobne pojęcia i tylko `variant` trafia do DOM.

## Bramka kontrastu

`src/theme/contrast.test.ts` liczy proporcję każdej pary token–powierzchnia we wszystkich
presetach i obu wariantach — 118 asercji. Preset łamiący AA nie przechodzi CI.

Polityka wynika z ról przypisanych tokenom w `tokens.ts`:

| rola | próg | uzasadnienie |
|---|---|---|
| `text` | 4.5:1 | WCAG 2.2 AA, 1.4.3 |
| `ui` | 3:1 | WCAG 2.2 AA, 1.4.11 |
| `decorative` | brak progu, ale floor widoczności 1.2:1 | nie niesie informacji |

Sprawdzamy każdą powierzchnię, na której token faktycznie występuje, a nie tylko tę
oczywistą: `--accent` na `--surface` (trafiona opcja quizu) to inny kontrast niż
`--accent` na `--bg`.

## Odstępstwa od makiety

Makieta z sesji Claude Design jest opisana jako „wierność: hi-fi, kolory i skala są
ostateczne". Przy pierwszym przebiegu testu okazało się, że **łamie AA w sześciu
miejscach**, mimo że brief w sekcji 9 planu wymaga „kontrastu AA na wszystkim, łącznie
z tekstem pomocniczym". Rozstrzygnięcia:

### Podniesione — dwa tokeny

| token | makieta | było | jest | teraz |
|---|---|---|---|---|
| `--text-3` | `#4C5670` | 2.48:1 | `#767F94` | 4.52:1 |
| `--wrong-text` | `#6E7788` | 4.02:1 | `#927B7B` | 4.61:1 |

Oba niosą treść, więc waiver nie wchodził w grę. `--text-3` obsługuje etykiety maszynowe
(„DOBRZE · 1 DZIEŃ" — czyli przewidywany interwał) i wygaszone opcje po odpowiedzi wraz
z ich glosami; użytkownik czyta je, żeby zobaczyć, czym różniło się to, co wybrał.

**Konsekwencja, którą trzeba znać:** trzy poziomy tekstu, wszystkie powyżej 4.5:1 na tle
o luminancji 0.0079, muszą się do siebie zbliżyć — to arytmetyka, nie kwestia gustu.
Różnica jasności między `--text-2` a `--text-3` jest mniejsza niż w makiecie. Hierarchię
przejmuje forma: stopień pisma, krój maszynowy, wersaliki i rozstrzelenie. Jest to zgodne
z tym, czego brief wymaga od przycisków ocen („rozróżnialne kształtem i pozycją, nie tylko
kolorem"), tylko zastosowane do tekstu.

### Zostawione bez zmian — obrysy opcji

| token | proporcja |
|---|---|
| `--border` | 1.55:1 |
| `--wrong-border` | 1.35:1 |

Sklasyfikowane jako dekoracyjne, mimo że otaczają element interaktywny. WCAG 1.4.11
wymaga 3:1 od „informacji wizualnej potrzebnej do rozpoznania komponentu i jego stanu",
a tutaj żadna informacja nie jest niesiona wyłącznie przez obrys:

- opcje rozdziela odstęp 8 px i każda zawiera znak o kontraście 15:1,
- stan po odpowiedzi niosą znaki `✓` i `×`, kolor tekstu (akcent, 7.35:1) oraz
  wypełnienie tła,
- usunięcie obrysów w całości nie odebrałoby użytkownikowi żadnej informacji.

Podniesienie ich do 3:1 zamieniłoby cichy rysunek makiety w siatkę wyraźnych ramek
i zepsułoby kierunek „treść w centrum, wszystko inne cofnięte o krok".

**Granica tej decyzji:** obowiązuje dopóki obrys jest wykończeniem. Gdyby kiedyś stan
karty był rozpoznawalny wyłącznie po kolorze obrysu — na przykład opcja zaznaczona przed
zatwierdzeniem, bez znaku i bez zmiany tekstu — klasyfikacja przestaje być prawdziwa
i token wraca do roli `ui`. Test wypisuje te proporcje przy każdym przebiegu właśnie po to,
żeby nie zniknęły z oczu.

### Podniesione ciche linie

`--border-quiet` w czterech presetach (grafit, mech, piasek — jasne; kontrast — ciemny)
schodziło poniżej 1.2:1, czyli zlewało się z tłem całkowicie. Podniesione do ~1.26:1.
Wartości z makiety (1.21:1) zostały nietknięte — próg jest skalibrowany właśnie na nie.

## Czego M0 nie rozwiązuje

Blok `:root` w `src/index.css` powtarza paletę domyślnego presetu, żeby pierwsza klatka
przed uruchomieniem JavaScriptu nie była bezbarwna. Użytkownik z innym presetem zobaczy
jedno mrugnięcie przy starcie. Usunięcie tego wymaga wygenerowania CSS ze wszystkich palet
i wpisania `data-preset` do `<html>` skryptem inline — zadanie na M9, wraz z ekranem wyboru
presetu.

`theme-fallback.test.ts` pilnuje, żeby to jedyne dozwolone powtórzenie nie rozjechało się
z `presets.ts`.
