import type { LangAdapter } from '../types.ts'
import { arabicBatches, arabicLetters, arabicMnemonic, arabicNote } from './alphabet.ts'
import { lemmaCandidates } from './lemma.ts'
import { splitProclitics } from './proclitics.ts'

/**
 * Arabski — klasa B/C.
 *
 * Ma spacje jak klasa A, ale trzy rzeczy stawiają go bliżej japońskiego:
 *
 * 1. **Pismo prawostronne i łączone.** Litery zmieniają kształt zależnie od pozycji,
 *    a sześć z nich nie łączy się z następną. Etap 0 jest tu obowiązkowy — bez niego
 *    zdanie nie jest trudne, tylko nieczytelne.
 * 2. **Krótkich samogłosek się nie zapisuje.** Ten sam ciąg spółgłosek bywa kilkoma
 *    formami tego samego słowa. Dlatego `needsTranslit` jest włączone: na etapach 0 i 1
 *    pokazujemy transkrypcję, bo bez niej użytkownik nie ma jak się dowiedzieć,
 *    jak to brzmi.
 * 3. **Bogata fleksja i przedrostki zrośnięte z wyrazem.** Rodzajnik `ال`, spójnik `و`,
 *    przyimki `ب` i `ل` piszą się razem z rzeczownikiem, więc forma powierzchniowa
 *    rzadko trafia w listę częstości. Stąd `lemmaCandidates` i szerokie pasmo.
 *
 * Czego tu nie ma i dlaczego: `production` zostaje przy wpisywaniu z klawiatury
 * systemowej. Arabski IME nie podaje listy kandydatów jak japoński — wpisuje się litera
 * po literze, więc test przypomnienia jest prawdziwy (sekcja 7.2).
 */
export const ar: LangAdapter = {
  code: 'ar',
  name: 'arabski',
  tatoeba: 'ara',
  freq: 'ar',
  freqSource: 'list',
  // Pismo arabskie plus znaki diakrytyczne (harakat) i tatwil. Zdanie z czymkolwiek
  // spoza tego zakresu odrzuca krok 05 — łacinka w zdaniu arabskim to zwykle nazwa
  // własna albo brud w korpusie, a jedno i drugie psuje kartę.
  script: /^[\p{Script=Arabic}\p{P}\p{Zs}\d]+$/u,
  rtl: true,
  hasScriptStage: true,
  // Zapis nie niesie samogłosek krótkich, ale nie mamy ich skąd wziąć per token —
  // transkrypcję pokazujemy tylko na etapach 0 i 1, gdzie pochodzi ze słownika.
  needsReading: false,
  needsTranslit: true,
  blocklist: /شرموط|عاهر|كس |طيز|خول/iu,
  tokenizer: 'space',
  display: { font: 'ar', size: 32, lineHeight: 1.9 },
  tts: { locale: 'ar-SA', rate: 0.5 },
  // Arabski upycha w jednym wyrazie to, co polski rozkłada na trzy: `وبالمدرسة` to
  // „i w szkole". Progi niżej niż w klasie A, bo krótkie zdanie nie znaczy tu prostego.
  sentence: { minTokens: 3, maxTokens: 16, maxUnknown: 1, clozeSlack: 2 },
  // Fleksja rozprasza częstość między formy, tak samo jak w koreańskim: forma z rodzajnikiem
  // i bez to dla listy częstości dwa różne słowa. Próg 12 000 wycinałby połowę rzeczowników
  // pospolitych tylko dlatego, że w korpusie stoją z `ال`.
  maxBand: 45000,
  quiz: {
    // Same rzeczowniki. Czasownik arabski niesie w formie osobę, rodzaj i czas, więc
    // cztery opcje w różnych formach są zadaniem z gramatyki, nie testem znajomości słowa —
    // ten sam powód co przy koreańskim i japońskim.
    clozePos: ['noun'],
    shape: 'edit',
    minOptions: 4,
  },
  production: ['type'],
  lemmaCandidates,
  splitToken: splitProclitics,
  scriptItems: arabicLetters,
  scriptAbout:
    'Arabski pisze się od prawej do lewej, a litery łączą się ze sobą i zmieniają kształt ' +
    'zależnie od miejsca w wyrazie — rdzeń zostaje ten sam, znika albo dochodzi ogonek. ' +
    'Liter jest 28 i wszystkie są spółgłoskami; krótkich samogłosek w ogóle się nie zapisuje, ' +
    'więc „كتب" to trzy znaki, a czyta się „kataba". Litery różnią się głównie kropkami, ' +
    'dlatego uczymy ich rodzinami kształtu, a nie po kolei.',
  scriptNote: arabicNote,
  scriptMnemonic: arabicMnemonic,
  scriptBatches: arabicBatches,
}
