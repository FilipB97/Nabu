# ADR-003 — rozpoznawanie mowy i ocena wymowy

**Status:** otwarte — czeka na wyniki sondy z iPhone'a
**Kontekst:** sekcja 7 planu (typy kart), sekcja 11 (dźwięk), pytanie użytkownika

## Problem

Aplikacja uczy dziś rozpoznawania (quiz) i odtwarzania z pamięci na piśmie (produkcja).
Nie sprawdza w ogóle, czy użytkownik POTRAFI TO POWIEDZIEĆ. Dla wymowy — jedynej
umiejętności, której nie da się wyćwiczyć wzrokiem — jest to luka.

Pytanie „czy da się oceniać wymowę" ma trzy różne odpowiedzi, bo kryją się pod nim trzy
różne rzeczy o koszcie od jednego dnia do kilku tygodni.

## Trzy ścieżki, trzy koszty

### A. Odsłuch własnego głosu (shadowing) — ~1 dzień, offline, bez oceny

`MediaRecorder` nagrywa, aplikacja odtwarza wzorzec i nagranie obok siebie. Użytkownik
ocenia się sam.

- **Za:** działa offline, zero modeli, zero sieci, zero kosztu. Jest to metoda, której
  używają lektorzy, i sama w sobie uczy więcej niż większość automatycznych ocen.
- **Przeciw:** ocena jest subiektywna, a sekcja 1 planu świadomie usunęła samoocenę
  z głównej mechaniki. Karta byłaby więc ćwiczeniem, nie pozycją w harmonogramie.

### B. Rozpoznawanie mowy (`SpeechRecognition`) — ~3 dni, wymaga sieci, ocena zero-jedynkowa

Przeglądarka zwraca transkrypcję; porównujemy ją z oczekiwanym słowem tą samą funkcją,
która ocenia dziś wpisywanie (`checkProduction`). Nowy tryb produkcji: `produce-speak`.

- **Za:** ocena obiektywna, wpina się w istniejący silnik bez zmian w harmonogramie.
- **Przeciw, i to poważne:**
  - **Odpowiada na inne pytanie, niż się wydaje.** Rozpoznawanie jest trenowane, by
    rozumieć mówiących z akcentem — polski akcent w angielskim transkrybuje się
    poprawnie. Karta powie „dobrze" przy wymowie, którą człowiek oceniłby nisko.
  - **Kontekst domyka za użytkownika.** Modele językowe poprawiają nieudane głoski
    do najbliższego sensownego słowa — czyli dokładnie do tego, o które pytamy.
  - **Dla chińskiego jest bezużyteczne tam, gdzie najbardziej potrzebne.** Zły ton
    zwykle i tak transkrybuje się na właściwy znak, bo reszta zdania go wymusza.
  - Wymaga sieci (Safari i Chrome wysyłają dźwięk na serwer), więc karta musi się
    degradować offline, a nie psuć.

### C. Ocena fonemowa (GOP) — tygodnie, ciężka, ale prawdziwa

Model akustyczny per fonem (wav2vec2 CTC), fonemizacja oczekiwanego tekstu (espeak-ng
w WASM) i dopasowanie wymuszone. Daje informację zwrotną na poziomie głoski: „twoje
`θ` wyszło jako `s`".

- **Za:** to jest jedyna z trzech ścieżek, która naprawdę OCENIA WYMOWĘ.
- **Przeciw:** model rzędu 100–300 MB na język, kilka sekund liczenia na telefonie,
  osobny fonemizator per język, limity pamięci Safari. Zderza się wprost z zasadą
  „aplikacja otwiera się w samolocie" i z budżetem precache'a.

### C′. Sam ton, bez modelu — ~2 dni, offline, tylko chiński

Osobna, tania ścieżka wycięta z C: kontur częstotliwości podstawowej liczony
autokorelacją w przeglądarce, porównany z kształtem oczekiwanego tonu. Nie ocenia
głosek, ale ocenia dokładnie to, co w chińskim rozstrzyga o znaczeniu i czego ścieżka B
nie potrafi. Kilkaset linijek, zero modeli, zero sieci.

## Czego nie robimy

Usług chmurowych do oceny wymowy (Azure Pronunciation Assessment, Speechace). Dają
najlepszą jakość i wymagają klucza, czyli serwera pośredniczącego, kosztu za minutę
i połączenia. Sekcja 13 planu mówi „zero sekretów serwerowych", a bramka M0 —
„otwiera się offline". Wejście w to jest zmianą charakteru produktu, nie funkcją.

## Co rozstrzyga sonda

`#/mowa` zbiera fakty, których nie da się sprawdzić z desktopu:

1. Czy `SpeechRecognition` istnieje i działa **z ikony na ekranie głównym**, a nie tylko
   w Safari. To ta sama pułapka co w ADR-001: standalone bywa innym środowiskiem.
2. Czy `getUserMedia` w standalone zwraca strumień ze ścieżką dźwięku.
3. Czy z nagrania da się wyciągnąć sensowny kontur wysokości — to warunek ścieżki C′.

## Jak wykonać

1. Wdroż gałąź (Action robi to przy pushu na `main`).
2. Otwórz `https://<user>.github.io/Nabu/#/mowa` **w Safari na iPhonie**.
3. Naciśnij trzy przyciski rozpoznawania i powiedz krótkie zdanie w danym języku.
4. Naciśnij „nagraj 3 sekundy" i powiedz przeciągle „aaa", raz równo, raz z głosem
   idącym w górę. Sprawdź, czy słupki rysują różny kształt.
5. Dodaj do ekranu głównego, otwórz **z ikony** i powtórz punkty 3–4.
6. Wpisz wyniki do tabeli i ustaw status tego dokumentu.

## Wyniki

| środowisko | SpeechRecognition | transkrypcja | mikrofon | kontur F0 |
|---|---|---|---|---|
| Safari (karta) | | | | |
| PWA (z ikony) | | | | |

## Decyzja

_Do uzupełnienia po sondzie._ Wstępna rekomendacja, o ile sonda nie zaskoczy: **A + C′**
jako pierwszy krok (offline, tanie, uczciwe wobec tego, co naprawdę mierzą), **B** jako
tryb dodatkowy tam, gdzie jest sieć i gdzie interesuje nas zrozumiałość, a nie akcent —
z nazwą mówiącą wprost, co sprawdza. **C** dopiero, gdy będzie po co: to jest osobny
projekt, nie funkcja.
