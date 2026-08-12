# ADR-001 — warstwa dźwięku

**Status:** przyjęte — mowa działa w Safari i w zainstalowanym PWA (12.08.2026)
**Kontekst:** sekcja 11 planu, bramka M0

## Problem

Są zgłoszenia, że w PWA dodanym do ekranu głównego na iOS odtwarzanie audio przestaje
działać, mimo że w Safari na tej samej stronie działa poprawnie — `AudioContext` zostaje
w stanie `suspended` i nigdy nie przechodzi w `running`. Dla aplikacji, w której wymowa
jest jednym z trzech kanałów nauki, to ryzyko krytyczne.

## Dlaczego to stoi w M0, a nie przed M5

Pierwsza wersja planu umieszczała ten test przed etapem dźwięku. To było za późno.
Plan B — audio wygenerowane w buildzie — nie jest zmianą w warstwie odtwarzania, tylko:

- dokłada krok do pipeline'u danych (generowanie plików na laptopie),
- zmienia wagę talii o rząd wielkości, co dotyka pakowania `sentences.json`,
  budżetu precache'a i liczby podawanej użytkownikowi na ekranie „talia niepobrana",
- przesuwa granicę tego, co da się trzymać w cache Safari.

Wszystkie trzy decyzje zapadają w M1. Test trwa dziesięć minut, więc nie ma powodu,
żeby czekał.

## Jak wykonać test

1. Wdroż gałąź na GitHub Pages (Action robi to przy każdym pushu).
2. Otwórz `https://<user>.github.io/Nabu/#/audio` **w Safari na iPhonie**.
3. Naciśnij wszystkie trzy przyciski. Zanotuj: czy słychać dźwięk, co pokazuje
   dziennik zdarzeń, jaki jest stan `AudioContext` i ile głosów widzi system.
4. Dodaj stronę do ekranu głównego (Udostępnij → Do ekranu głównego).
5. Otwórz **z ikony**, nie z Safari. Powtórz punkt 3.
6. Wpisz wyniki do tabeli poniżej i ustaw status tego dokumentu.

Strona testowa raportuje też, czy działa w trybie `standalone` — bez tego łatwo
pomylić uruchomienie z ikony z uruchomieniem w Safari.

## Wyniki

Test wykonany 12 sierpnia 2026 na urządzeniu właściciela projektu.

| | Safari | Dodane do ekranu głównego |
|---|---|---|
| Mowa działa | tak | **tak** |

Pozostałe pola tabeli (wersja iOS, liczba głosów, stan `AudioContext`) nie zostały
spisane. Rozstrzygnięcia nie zmieniają: interesowało nas jedno pytanie zamknięte
i odpowiedź jest twierdząca w obu trybach. Gdyby pojawiła się regresja, trasa
`#/audio` raportuje komplet tych danych, a test trwa dziesięć minut.

## Decyzja

**`speechSynthesis` jest ścieżką podstawową. Plan B odpada.**

Czego przez to nie wprowadzamy:

- kroku `09-audio` w pipelinie ani katalogu `data/{lang}/audio/`
- wagi plików dźwiękowych w talii, więc budżet precache'a i rozmiar podawany
  na ekranie „talia niepobrana" zostają takie, jak zakładał plan
- decyzji o formacie (`.m4a` / `.opus`) ani o tym, czy generujemy dźwięk do wszystkich
  zdań, czy tylko do rdzenia słownictwa

Warstwa audio i tak siedzi za interfejsem `speak(text, lang, rate)` — nie dlatego,
że spodziewamy się zmiany ścieżki, tylko dlatego, że tempo mowy jest jednocześnie
parametrem adaptera i ustawieniem użytkownika, a to i tak wymaga jednego miejsca.

## Co pozostawało otwarte — domknięte w M5 (12.08.2026)

Test potwierdził działanie mowy, ale **nie** sprawdzał dostępności głosów dla wszystkich
języków na czystym urządzeniu. iOS pobiera głosy na żądanie i nie każdy system ma
zainstalowany japoński czy koreański.

Rozstrzygnięcie: brak głosu jest **stanem aplikacji, nie błędem**. `hasVoice(locale)`
sprawdza to przy każdej sesji, karty ze słuchu przy braku głosu w ogóle się nie pojawiają
(zamiast pojawiać się i milczeć), a ekran startu mówi o tym wprost i podaje ścieżkę:
Ustawienia → Dostępność → Zawartość mówiona → Głosy. Odczyt jest ponawiany na zdarzenie
`voiceschanged`, bo użytkownik może pobrać głos w trakcie działania aplikacji.

Dwie rzeczy wyszły przy pisaniu tej warstwy i obie są w niej zamknięte:

- **pierwsze `speak()` musi wyjść z gestu użytkownika**, inaczej iOS ignoruje wszystkie
  kolejne wywołania programowe — bez błędu i bez zdarzenia. Pusta wypowiedź wysłana
  z przycisku „Zacznij" odblokowuje resztę sesji (`primeSpeech`);
- **dopasowanie locale musi być dwustopniowe**: systemy podają warianty, których nie da się
  przewidzieć (`zh-Hans-CN` zamiast `zh-CN`, `ko_KR` z podkreślnikiem zamiast myślnika).
  Samo porównanie pełnego kodu uznałoby chiński za język bez głosu.

## Uwaga poboczna

Test sprawdza także obecność głosów systemowych dla każdego z pięciu języków
(ryzyko „brak głosu TTS dla języka w systemie", sekcja 14). Jeśli któregoś zabraknie,
potrzebna będzie detekcja przy dodawaniu języka i instrukcja pobrania głosu
w ustawieniach iOS — to osobne, tanie zadanie, ale trzeba o nim wiedzieć wcześnie.
