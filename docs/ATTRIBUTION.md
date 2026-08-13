# Źródła danych i licencje

> Plik źródłowy. Krok `05-assemble` kopiuje go do `data/ATTRIBUTION.md` przy każdym
> przebiegu, żeby katalog wynikowy zawsze niósł licencje ze sobą — i żeby skasowanie
> `data/` w trakcie strojenia filtrów nie zabierało go po cichu, tak jak raz już zabrało.

Katalog `data/` powstaje w całości z materiałów otwartych. Nic w nim nie jest napisane
ani przetłumaczone maszynowo — zdania, ich polskie tłumaczenia i glosy pochodzą od ludzi.

| Co | Źródło | Licencja |
|---|---|---|
| Zdania w językach docelowych | [Tatoeba](https://tatoeba.org) | CC BY 2.0 FR |
| Polskie tłumaczenia zdań | Tatoeba, powiązania bezpośrednie i przez angielski | CC BY 2.0 FR |
| Rangi częstości (es, pt, sv, ko, zh) | [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles 2018) | CC BY-SA 3.0 |
| Glosy polskie i części mowy | [polski Wikisłownik](https://pl.wiktionary.org) przez [kaikki.org](https://kaikki.org/plwiktionary/) | CC BY-SA 3.0 |
| Segmentacja i czytania japońskie | [kuromoji.js](https://github.com/takuyaa/kuromoji.js) + IPADIC | Apache 2.0 |
| Segmentacja i pinyin chiński | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) | CC BY-SA 4.0 |
| Rozkład kanji na komponenty | [KRADFILE](http://www.edrdg.org/krad/kradinf.html), EDRDG | CC BY-SA 3.0 |
| Kroje pisma | Archivo, Spectral, IBM Plex Mono, Noto Serif JP, Noto Serif KR, Noto Naskh Arabic | SIL OFL 1.1 |

**Dane pochodne dziedziczą SA.** Dotyczy to zawartości katalogu `data/`, nie kodu
aplikacji — kod jest na MIT. Subsety krojów w `public/fonts/` mają nazwy odróżniające
je od oryginałów, zgodnie z wymogiem OFL.

## Jak powstały tłumaczenia polskie

Tatoeba wiąże zdania między językami. Korzystamy z dwóch warstw:

- **bezpośrednia** — zdanie ma w korpusie wprost powiązanie z polskim,
- **przez angielski** — powiązanie prowadzi przez zdanie angielskie, ale **tylko wtedy,
  gdy na końcu łańcucha stoi dokładnie jedno zdanie polskie**.

Łańcuchy prowadzące do kilku różnych zdań polskich odrzucamy w całości. To 13–15% puli
i akurat te przypadki, w których angielski jest wieloznaczny, czyli gdzie znaczenie
najłatwiej dryfuje. Pole `src` przy każdym zdaniu mówi, z której warstwy pochodzi.

Bez warstwy pośredniej portugalski miałby 1 550 zdań zamiast 8 423, a dobór metodą i+1
nie miałby z czego wybierać.

## Znane ograniczenia

**Glosa jest wybierana heurystycznie.** Wikisłownik podaje kilka znaczeń, a my bierzemy
to, które pojawia się w polskim tłumaczeniu danego zdania; przy braku dopasowania —
pierwsze. Działa to dobrze (szwedzkie `slav` dostaje „niewolnik", nie „Słowianin"),
ale nie zawsze: portugalskie `árabe` ma w Wikisłowniku wyłącznie znaczenie „Arab", więc
w zdaniu o języku glosa jest myląca. Pełne ujednoznacznianie znaczeń wymagałoby osobnego
narzędzia i jest zadaniem po v1.

**Rangi częstości japońskie liczymy sami.** Lista FrequencyWords dla japońskiego powstała
bez analizy morfologicznej: jej czoło to pojedyncze kany, a formy słownikowe czasowników
(`食べる`, `起きる`, `大きい`) w ogóle w niej nie występują, choć rzeczowniki są w porządku.
Zamiast niej tokenizujemy cały korpus japoński przez kuromoji i liczymy częstość form
podstawowych.

**Pasma nie są porównywalne między językami.** Nigdy nie były — każdy język ma własne
źródło — ale przy koreańskim i japońskim rozjazd jest większy. Koreańskie `먹다` („jeść",
forma słownikowa) ma na liście napisów rangę 28 331, podczas gdy jego forma grzecznościowa
`먹어요` — 4 087, bo odmiana rozprasza częstość między dziesiątki form. Dlatego próg
odrzutu jest parametrem adaptera, a nie stałą.

**Koreański stoi na heurystykach, nie na analizatorze.** Rozdzielanie partykuł
i sprowadzanie form do postaci słownikowej robią reguły w `src/langs/ko/`, nie analizator
morfologiczny. Doprowadzają talię do stanu używalnego, ale nie rozstrzygają
niejednoznaczności. mecab-ko jest zadaniem po v1.

**Pinyin pojedynczego znaku bywa nietrafiony.** CC-CEDICT ma osobne hasło dla każdego
czytania (`重` to i `chóng` „powtórzyć", i `zhòng` „ciężki"), a hasła są ułożone alfabetycznie,
nie według częstości. Przy jednoznakowym słowie bierzemy pierwsze i czasem jest to czytanie
rzadsze. Dla słów dwuznakowych i dłuższych — czyli większości talii — problem nie występuje,
bo tam czytanie jest jednoznaczne. To ten sam rodzaj ograniczenia co przy wyborze glosy wyżej
i rozwiązuje go dopiero słownik z rangami czytań.

**Zapis tradycyjny jest odrzucany, nie konwertowany.** Tatoeba trzyma oba warianty pisma
chińskiego pod kodem `cmn`. Talia uczy wyłącznie uproszczonego: zdanie zawierające znak
występujący tylko w zapisie tradycyjnym wypada (5 219 zdań). Konwersja byłaby możliwa,
ale dawałaby zdania, których nikt nie napisał — a cała talia stoi na tym, że napisał je człowiek.

**Lematyzacja dla klasy A jest szczątkowa.** Polski Wikisłownik prawie nie zawiera form
odmienionych dla hiszpańskiego, portugalskiego i szwedzkiego, więc formę powierzchniową
traktujemy jako lemat. Nie psuje to dopasowania do listy częstości — lista też jest
zbudowana z form powierzchniowych — ale sprawia, że odmieniony czasownik nie dostaje
glosy i nie może być luką.
