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
]

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

  // Forma już słownikowa.
  if (word.endsWith(DA)) return out

  for (const ending of ENDINGS) {
    if (!word.endsWith(ending) || word.length <= ending.length) continue
    const stem = word.slice(0, word.length - ending.length)
    push(stem + DA)

    // `했` → `하`, `먹었` → `먹어`: wygłos ostatniej sylaby bywa częścią końcówki.
    const last = stem.at(-1)
    if (last && isSyllable(last)) {
      const bare = stripFinal(last)
      if (bare) push(stem.slice(0, -1) + bare + DA)
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
