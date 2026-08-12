/**
 * Mapowanie części mowy z IPADIC na słownik używany w rdzeniu.
 *
 * Analizator zwraca etykiety japońskie (名詞, 動詞, 助詞). Rdzeń zna tylko `noun`,
 * `verb`, `adj`, `adv`, `particle` — te same, których używa Wikisłownik dla pozostałych
 * języków. Bez tej translacji filtr luk (`quiz.clozePos`) nie działałby dla japońskiego,
 * a to jest dokładnie ten rodzaj rozgałęzienia, którego sekcja 2.1 zabrania poza adapterem.
 */
const IPADIC: Record<string, string> = {
  名詞: 'noun',
  動詞: 'verb',
  形容詞: 'adj',
  副詞: 'adv',
  助詞: 'particle',
  助動詞: 'aux',
  連体詞: 'adnominal',
  接続詞: 'conj',
  感動詞: 'interj',
  接頭詞: 'prefix',
  記号: 'punct',
  フィラー: 'filler',
}

/**
 * Podtypy, które formalnie są rzeczownikiem albo czasownikiem, ale nie nadają się
 * na lukę: sufiksy (`屋` w `郵便屋さん`), zaimki, liczebniki i czasowniki posiłkowe.
 * Zasłonięcie ich pyta o gramatykę, nie o słowo.
 */
const NOT_A_WORD = new Set(['接尾', '代名詞', '数', '非自立', '接続詞的', '特殊'])

export function posFromIpadic(pos: string, detail?: string): string | null {
  if (detail && NOT_A_WORD.has(detail)) return 'affix'
  return IPADIC[pos] ?? null
}

/**
 * Części mowy, których nie chcemy w tokenach zdania. Interpunkcja nie jest słowem,
 * a `filler` to „ええと" i podobne — analizator je rozpoznaje, ale karta ich nie potrzebuje.
 */
export const DROPPED = new Set(['punct', 'filler'])
