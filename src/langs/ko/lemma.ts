import { decompose, compose, isSyllable } from './hangul.ts'

/**
 * Sprowadzanie form odmienionych do postaci słownikowej — heurystyka, nie analizator.
 *
 * Po co: polski Wikisłownik ma dla koreańskiego 3 418 haseł, wszystkie w formie
 * słownikowej na `다`. Tokenizer `space` widzi formy odmienione (`먹어요`, `했습니다`,
 * `없으면`), więc bez sprowadzenia do rdzenia nie trafia w słownik i 90% zdań traci
 * kandydata na lukę. Pomiar przed poprawką: 314 zdań przy progu 400.
 *
 * Jak: koreańska odmiana czasowników i przymiotników jest sufiksalna i regularna,
 * więc zamiast analizatora morfologicznego wystarczy odciąć końcówkę i dokleić `다`,
 * sprawdzając kandydatów w słowniku. Kolejność prób idzie od najdłuższego odcięcia,
 * bo `했습니다` musi rozłożyć się na `하다`, a nie na `했다`.
 *
 * To NIE zastępuje tokenizera `morph`. Nie rozdziela cząstek gramatycznych od rzeczownika
 * (`학교에서` zostaje w całości), nie radzi sobie z tematami nieregularnymi i nie poprawia
 * rang częstości. Właściwym rozwiązaniem jest mecab-ko po v1 — to jest podpórka, która
 * ma doprowadzić koreański do stanu używalnego, i tyle.
 */

/** Końcówka `다` w formie słownikowej. */
const DA = '다'

/**
 * Sylaby, na których kończą się typowe formy odmienione. Odcięcie ich i doklejenie `다`
 * daje kandydata na hasło słownikowe.
 */
const ENDINGS = [
  '습니다',
  '습니까',
  'ㅂ니다',
  '았습니다',
  '었습니다',
  '였습니다',
  '해요',
  '아요',
  '어요',
  '여요',
  '았다',
  '었다',
  '였다',
  '했다',
  '는다',
  '으면',
  '면서',
  '니까',
  '지만',
  '어서',
  '아서',
  '고',
  '지',
  '서',
  '면',
  '는',
  '은',
  '을',
  '기',
  '음',
  '해',
  '아',
  '어',
  // Samo `다` też jest końcówką: `갔다` to `가` + ściągnięte `았` + `다`. Bez tego wpisu
  // formy przeszłe zrośnięte z rdzeniem nie znajdowały postaci słownikowej.
  '다',
]

/**
 * Ściągnięcia samogłoskowe. Koreański skleja rdzeń z końcówką tak, że samogłoska się
 * zmienia: `하` + `였` daje `했`, a nie `하였`. Samo odcięcie wygłosu dałoby `해다`
 * zamiast `하다` — a czasowniki na `하다` to jedna z największych klas w języku.
 */
const CONTRACTIONS: Record<string, string> = {
  해: '하',
  했: '하',
  와: '오',
  왔: '오',
  봐: '보',
  봤: '보',
  줘: '주',
  줬: '주',
  돼: '되',
  됐: '되',
  셔: '시',
  셨: '시',
}

/**
 * Odcina wygłosową spółgłoskę ostatniej sylaby. `없으` → `없`, ale też `먹었` → `먹어`.
 * Potrzebne, bo część końcówek zrasta się z rdzeniem zamiast stać osobno.
 */
function stripFinal(syllable: string): string | null {
  const parts = decompose(syllable)
  if (!parts || parts.final === 0) return null
  return compose({ initial: parts.initial, medial: parts.medial, final: 0 })
}

/**
 * Zwraca kandydatów na postać słownikową, od najbardziej prawdopodobnego.
 * Rozstrzyga o wyborze wywołujący — sprawdzając, który kandydat jest w słowniku.
 */
export function lemmaCandidates(surface: string): string[] {
  const word = surface.trim()
  if (word.length === 0) return []

  const out: string[] = [word]
  const push = (candidate: string) => {
    if (candidate.length > 0 && !out.includes(candidate)) out.push(candidate)
  }

  // UWAGA: nie da się tu skrócić przez „kończy się na 다, więc jest słownikowa".
  // `했습니다`, `았다`, `는다` też kończą się na 다, a są formami odmienionymi. Forma
  // wyjściowa i tak stoi na początku listy, więc prawdziwe hasło słownikowe wygra
  // jako pierwsze trafienie w słowniku — kolejność załatwia rozstrzygnięcie za nas.
  for (const ending of ENDINGS) {
    if (!word.endsWith(ending) || word.length <= ending.length) continue
    const stem = word.slice(0, word.length - ending.length)
    push(stem + DA)

    // `먹었` → `먹어`: wygłos ostatniej sylaby bywa częścią końcówki.
    const last = stem.at(-1)
    if (last && isSyllable(last)) {
      const bare = stripFinal(last)
      if (bare) push(stem.slice(0, -1) + bare + DA)

      // `했` → `하`, `왔` → `오`: ściągnięcie cofnięte do postaci sprzed sklejenia.
      const undone = CONTRACTIONS[last] ?? (bare ? CONTRACTIONS[bare] : undefined)
      if (undone) push(stem.slice(0, -1) + undone + DA)
    }
  }

  // Odcięcie samej sylaby wygłosowej, gdy żadna znana końcówka nie pasowała.
  const last = word.at(-1)
  if (last && isSyllable(last)) {
    const bare = stripFinal(last)
    if (bare) push(word.slice(0, -1) + bare + DA)
    if (word.length > 1) push(word.slice(0, -1) + DA)
  }

  return out
}
