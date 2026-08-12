/**
 * CC-CEDICT — słownik chińsko-angielski z pinyinem. Sekcja 10.1a planu.
 *
 * Potrzebny do dwóch rzeczy naraz i to jest jedyny powód, dla którego chiński
 * w ogóle da się zrobić bez analizatora morfologicznego:
 *
 * 1. **Granice słów.** Chiński nie ma spacji, ale ma zamkniętą listę słów. Zachłanne
 *    najdłuższe dopasowanie do słownika (`他` + `喜欢` + `学校`, nie znak po znaku)
 *    wystarcza, bo słownik ma 125 tysięcy haseł i pokrywa całą warstwę pospolitą.
 * 2. **Czytania.** Pinyin pełni tu rolę furigany: ten sam znak bywa czytany różnie,
 *    a bez tonu słowo jest niepełne.
 *
 * Licencja: CC BY-SA 4.0. Dane pochodne dziedziczą SA, tak samo jak reszta `data/`.
 */

import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { download } from './io.ts'
import { toDiacritics } from '../../src/langs/zh/pinyin.ts'

const CEDICT = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'

export type CedictEntry = {
  /** Zapis uproszczony — ten, którego uczymy. */
  simplified: string
  /** Pinyin z tonami diakrytycznymi. */
  pinyin: string
  /** Czy hasło jest nazwą własną — rozpoznane po wielkiej literze w pinyinie. */
  proper: boolean
}

export type Cedict = {
  entries: Map<string, CedictEntry>
  /** Najdłuższe hasło w słowniku — górna granica okna przy dopasowaniu zachłannym. */
  maxLength: number
  /**
   * Znaki występujące wyłącznie w zapisie tradycyjnym. Tatoeba miesza oba zapisy
   * w jednym korpusie `cmn`, a uczący się wybiera jeden — talia z obydwoma naraz
   * uczyłaby dwóch systemów pisma pod jedną nazwą.
   */
  traditionalOnly: Set<string>
}

let cache: Cedict | null = null

export async function loadCedict(): Promise<Cedict> {
  if (cache) return cache

  const path = await download(CEDICT, 'cedict.txt.gz')
  const text = gunzipSync(await readFile(path)).toString('utf8')

  const entries = new Map<string, CedictEntry>()
  const traditionalOnly = new Set<string>()
  let maxLength = 1

  // Plik ma zakończenia CRLF. Bez obcięcia `\r` kotwica na końcu wzorca nie łapie
  // i parsuje się JEDNO hasło ze 125 tysięcy — a pipeline i tak kończy się sukcesem,
  // produkując talię posiekaną znak po znaku. Wyszło dopiero w ręcznym przeglądzie.
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.startsWith('#') || line.length === 0) continue

    // `傳統 传统 [chuan2 tong3] /tradition/traditional/`
    const match = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.*)\/$/.exec(line)
    if (!match) continue

    const [, traditional, simplified, pinyin] = match
    if (!traditional || !simplified || !pinyin) continue

    // Znak z kolumny tradycyjnej, którego nie ma w uproszczonej, jest markerem zapisu.
    if (traditional !== simplified) {
      const simp = new Set(simplified)
      for (const char of traditional) if (!simp.has(char)) traditionalOnly.add(char)
    }

    // NIE odrzucamy haseł z wielką literą w pinyinie. Kusiło, żeby uznać je za nazwy
    // własne, ale ta sama konwencja obejmuje nazwy języków (`英语` Yīng yǔ — angielski)
    // i krajów. Odrzucenie ich powodowało dwie szkody naraz: rozbijało `英语` na dwa
    // znaki ORAZ rozbijało `汤姆` (Tom) na `汤` (zupa) + `姆`, po czym zupa trafiała
    // do luki w zdaniu o Tomie. Nazwy własne odsiewa i tak wymóg polskiej glosy:
    // bez hasła w Wikisłowniku token nie może być luką.
    // Wyrażenia z cyframi i łaciną nie są słowami do nauczenia się.
    if (!/^\p{Script=Han}+$/u.test(simplified)) continue

    // Ten sam zapis bywa w słowniku kilka razy: `书` to i „książka" (shū), i nazwisko
    // (Shū). Wielka litera w pinyinie oznacza nazwę własną, więc czytanie pospolite
    // ma pierwszeństwo — inaczej na karcie pojawia się `书[Shū]` zamiast `书[shū]`.
    const common = !/^[A-Z]/.test(pinyin)
    const existing = entries.get(simplified)
    if (!existing || (common && existing.proper)) {
      entries.set(simplified, { simplified, pinyin: toDiacritics(pinyin), proper: !common })
      maxLength = Math.max(maxLength, [...simplified].length)
    }
  }

  // Znak może stać w obu kolumnach różnych haseł — wtedy nie jest markerem.
  for (const word of entries.keys()) for (const char of word) traditionalOnly.delete(char)

  cache = { entries, maxLength, traditionalOnly }
  return cache
}

/**
 * Zachłanne najdłuższe dopasowanie. Idzie od lewej i za każdym razem bierze najdłuższe
 * hasło pasujące od bieżącej pozycji.
 *
 * Jest to heurystyka, nie analiza: „发展中国家" (kraj rozwijający się) rozpada się
 * poprawnie, ale zdania z rzadką składnią potrafi pociąć źle. Dla materiału z Tatoeby —
 * zdań prostych, potocznych — trafność jest wystarczająca, a bramka z ręcznym przeglądem
 * dwudziestu zdań (sekcja 12) jest po to, żeby to sprawdzić, a nie założyć.
 */
type Part = { s: string; known: boolean }

/** Dopasowanie zachłanne od lewej. */
function forward(chars: string[], dict: Cedict): Part[] {
  const out: Part[] = []
  let i = 0

  while (i < chars.length) {
    const char = chars[i]!
    if (!/\p{Script=Han}/u.test(char)) {
      out.push({ s: char, known: false })
      i += 1
      continue
    }

    let matched = ''
    for (let length = Math.min(dict.maxLength, chars.length - i); length >= 1; length--) {
      const candidate = chars.slice(i, i + length).join('')
      if (dict.entries.has(candidate)) {
        matched = candidate
        break
      }
    }

    if (matched) {
      out.push({ s: matched, known: true })
      i += [...matched].length
    } else {
      out.push({ s: char, known: false })
      i += 1
    }
  }

  return out
}

/** Dopasowanie zachłanne od prawej. */
function backward(chars: string[], dict: Cedict): Part[] {
  const out: Part[] = []
  let i = chars.length

  while (i > 0) {
    const char = chars[i - 1]!
    if (!/\p{Script=Han}/u.test(char)) {
      out.unshift({ s: char, known: false })
      i -= 1
      continue
    }

    let matched = ''
    for (let length = Math.min(dict.maxLength, i); length >= 1; length--) {
      const candidate = chars.slice(i - length, i).join('')
      if (dict.entries.has(candidate)) {
        matched = candidate
        break
      }
    }

    if (matched) {
      out.unshift({ s: matched, known: true })
      i -= [...matched].length
    } else {
      out.unshift({ s: char, known: false })
      i -= 1
    }
  }

  return out
}

const singles = (parts: Part[]) => parts.filter((p) => [...p.s].length === 1).length

/**
 * Wynik cięcia liczony częstością słów. Słowo spoza listy 50 tysięcy dostaje karę,
 * bo w praktyce oznacza, że dopasowanie zachłanne skleiło coś, czego nie ma w języku
 * potocznym (`打网` zamiast `网球`).
 */
function frequencyScore(parts: Part[], ranks: ReadonlyMap<string, number>): number {
  let score = 0
  for (const part of parts) {
    if (!/\p{Script=Han}/u.test(part.s)) continue
    const rank = ranks.get(part.s)
    score += rank ? 1 / Math.log(rank + 2) : -0.5
  }
  return score
}

/**
 * Dopasowanie dwukierunkowe: tniemy raz od lewej, raz od prawej i bierzemy wynik lepszy.
 *
 * Samo dopasowanie od lewej myli się przewidywalnie: w `打网球` (grać w tenisa) bierze
 * rzadkie `打网`, zostawiając `球` (kula) jako osobne słowo — i to `球` trafiało potem
 * do luki, w zdaniu o tenisie. Od prawej wychodzi `打` + `网球`, czyli poprawnie.
 *
 * Rozstrzygamy po liczbie tokenów, potem po liczbie tokenów jednoznakowych (mniej znaczy
 * lepiej, bo pojedynczy znak zwykle jest resztką po złym cięciu), a przy pełnym remisie
 * wybieramy kierunek od prawej — dla chińskiego jest empirycznie trafniejszy.
 */
export function segment(text: string, dict: Cedict, ranks?: ReadonlyMap<string, number>): Part[] {
  const chars = [...text]
  const left = forward(chars, dict)
  const right = backward(chars, dict)

  if (left.length !== right.length) return left.length < right.length ? left : right
  if (singles(left) !== singles(right)) return singles(left) < singles(right) ? left : right

  // Remis co do liczby tokenów rozstrzyga częstość. Bez tego `马上去` tnie się na
  // `马` + `上去` zamiast `马上` + `去`, bo oba warianty mają po dwa tokeny i po jednym
  // znaku pojedynczym — a różnią się tym, że `马上` jest słowem pospolitym, a `上去` nie.
  if (ranks) {
    const scoreLeft = frequencyScore(left, ranks)
    const scoreRight = frequencyScore(right, ranks)
    if (scoreLeft !== scoreRight) return scoreLeft > scoreRight ? left : right
  }

  return right
}
