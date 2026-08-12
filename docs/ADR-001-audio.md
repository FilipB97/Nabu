# ADR-001 — warstwa dźwięku

**Status:** oczekuje na wynik testu na urządzeniu
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

| | Safari | Dodane do ekranu głównego |
|---|---|---|
| Wersja iOS | | |
| Słychać japoński | | |
| Słychać koreański | | |
| Słychać hiszpański | | |
| Stan `AudioContext` po starcie | | |
| Liczba głosów | | |
| Zdarzenia `onstart` / `onend` | | |

## Decyzja

_Do uzupełnienia po teście._ Możliwe rozstrzygnięcia:

- **Działa w obu** → `speechSynthesis` jako ścieżka podstawowa. Pipeline bez zmian.
- **Działa tylko w Safari** → plan B: audio wygenerowane w buildzie do
  `data/{lang}/audio/`, odtwarzane elementem `<audio>`, precache w service workerze.
  Waży więcej, ale jest przewidywalne. Nowy krok `09-audio` w pipelinie, decyzja
  o formacie (`.m4a` albo `.opus`) i o tym, czy generujemy dźwięk do wszystkich zdań,
  czy tylko do rdzenia słownictwa.
- **Nie działa nigdzie** → wracamy do rozmowy o architekturze, zanim powstanie M1.

Niezależnie od wyniku warstwa audio siedzi za interfejsem `speak(text, lang, rate)`,
żeby zmiana ścieżki nie dotykała komponentów.

## Uwaga poboczna

Test sprawdza także obecność głosów systemowych dla każdego z pięciu języków
(ryzyko „brak głosu TTS dla języka w systemie", sekcja 14). Jeśli któregoś zabraknie,
potrzebna będzie detekcja przy dodawaniu języka i instrukcja pobrania głosu
w ustawieniach iOS — to osobne, tanie zadanie, ale trzeba o nim wiedzieć wcześnie.
