/**
 * Rozkład kanji na komponenty — do wtyczki podobieństwa kształtu `kanji-components`
 * z sekcji 10.1b planu.
 *
 * Źródło: KRADFILE z EDRDG (CC BY-SA). Plik jest w kodowaniu EUC-JP i ma postać
 * `znak : komponent komponent …`, 6355 pozycji.
 *
 * Po co: przy japońskim to podobieństwo kształtu jest właściwą trudnością karty.
 * Makieta pokazuje 水 / 氷 / 湯 / 米 — trzy pierwsze łączy element wody i to jest
 * dokładnie to rozróżnienie, którego uczy się początkujący. Dobór po samym paśmie
 * częstości dałby tam cztery przypadkowe rzeczowniki i karta straciłaby sens.
 */

import { readFile } from 'node:fs/promises'
import { download } from './io.ts'

const KRADFILE = 'http://ftp.edrdg.org/pub/Nihongo/kradfile.gz'

/**
 * Warianty pozycyjne tego samego elementu. KRADFILE rozkłada 氷 na `水 丶`, ale 湯
 * na `｜ 一 汁 日 勿` — element wody występuje tam jako 汁, bo plik używa komponentów
 * złożonych. Bez tej mapy para 水 / 湯 z makiety nie zostałaby rozpoznana jako podobna.
 */
const ALIASES: Record<string, string> = {
  氵: '水',
  汁: '水',
  冫: '水',
  忄: '心',
  扌: '手',
  犭: '犬',
  艹: '艸',
  阝: '邑',
  辶: '辵',
  礻: '示',
  衤: '衣',
  訁: '言',
  釒: '金',
  飠: '食',
  灬: '火',
  '⺍': '小',
}

export type Components = Map<string, Set<string>>

let cache: Components | null = null

/** Wczytuje i parsuje KRADFILE. Wynik trzymamy w pamięci — plik ma 113 kB. */
export async function loadComponents(): Promise<Components> {
  if (cache) return cache

  const path = await download(KRADFILE, 'kradfile.gz')
  const raw = await readFile(path)

  // Plik jest spakowany gzipem; Node rozpakowuje w pamięci, a dekodujemy z EUC-JP,
  // bo KRADFILE powstał zanim UTF-8 stało się oczywistością.
  const { gunzipSync } = await import('node:zlib')
  const text = new TextDecoder('euc-jp').decode(gunzipSync(raw))

  const map: Components = new Map()
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.includes(' : ')) continue
    const [kanji, rest] = line.split(' : ')
    if (!kanji || !rest) continue
    const parts = rest
      .trim()
      .split(/\s+/)
      .map((part) => ALIASES[part] ?? part)
    map.set(kanji.trim(), new Set(parts))
  }

  cache = map
  return map
}

/** Komponenty wszystkich kanji w wyrazie, po zastosowaniu aliasów. */
function componentsOf(word: string, table: Components): Set<string> {
  const out = new Set<string>()
  for (const char of word) {
    const parts = table.get(char)
    if (parts) for (const part of parts) out.add(part)
    // Sam znak też jest sygnałem: 水 w 水 i w 氷 to ten sam element.
    out.add(ALIASES[char] ?? char)
  }
  return out
}

/**
 * Podobieństwo kształtu dwóch wyrazów, 0–1. Jaccard po zbiorach komponentów.
 * Wyrazy bez kanji zwracają 0 — dla nich decyduje pasmo częstości, tak jak w klasie A.
 */
export function kanjiSimilarity(a: string, b: string, table: Components): number {
  const left = componentsOf(a, table)
  const right = componentsOf(b, table)
  if (left.size === 0 || right.size === 0) return 0

  let shared = 0
  for (const part of left) if (right.has(part)) shared += 1
  const union = left.size + right.size - shared
  return union === 0 ? 0 : shared / union
}
