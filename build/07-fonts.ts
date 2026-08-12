/**
 * Krok 07 — kroje pisma hostowane u siebie i zsubsetowane. Sekcja 9.2 planu.
 *
 * Aplikacja ma otwierać się w samolocie, więc `preconnect` do fonts.gstatic.com
 * nie może przetrwać przeniesienia makiety do kodu. Pobieramy pliki `.woff2` raz,
 * commitujemy do `public/fonts/` i wpinamy przez `@font-face` w `src/index.css`.
 *
 * Subsetowanie robi za nas parametr `text=` w API Google Fonts: zwraca krój zawężony
 * dokładnie do podanych znaków. Dla pism CJK to różnica między kilkoma megabajtami
 * a kilkudziesięcioma kilobajtami — czyli między psuciem precache'a a jego brakiem.
 *
 * STAN NA M0: zestaw znaków CJK jest wpisany na sztywno, bo `data/` jeszcze nie istnieje.
 * W M1, gdy powstaną talie, `cjkCharsFor()` ma czytać unię znaków z `data/{lang}/`
 * zamiast stałej — reszta skryptu zostaje bez zmian.
 *
 * Uruchomienie:  node build/07-fonts.ts
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/fonts')

/** Bez tego nagłówka API zwraca `.ttf` zamiast `.woff2`. */
const WOFF2_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36'

/** Znaki potrzebne polskiemu interfejsowi i językom klasy A. */
const LATIN =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  'ĄĆĘŁŃÓŚŹŻąćęłńóśźż' + // polski
  'ÁÀÂÃÄÅÇÉÈÊËÍÌÎÏÑÓÒÔÕÖÚÙÛÜÝ' + // es, pt
  'áàâãäåçéèêëíìîïñóòôõöúùûüýÿ' +
  'ÆØÅæøå' + // sv, no
  ' .,;:!?¡¿·—–-–…„“”‘’"\'()[]{}/\\@#%&*+=<>|~^$€£×÷°'

/**
 * Kana w całości (etap 0 japońskiego) plus kanji z demo M0.
 * W M1 zastąpić unią znaków z `data/ja/`.
 */
const KANA =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' +
  'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽっゃゅょぁぃぅぇぉー' +
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
  'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポッャュョァィゥェォ' +
  '、。「」・'
const KANJI_M0 = '水氷湯米建物確認'

/** Sylaby hangul z demo M0. W M1 zastąpić unią znaków z `data/ko/`. */
const HANGUL_M0 = '물불밀말좀주세요안녕하십니까'

type FontJob = {
  /** Nazwa pliku wynikowego, bez rozszerzenia. */
  file: string
  /** Rodzina w API Google Fonts. */
  family: string
  /** Grubość; API wymaga jej podania jawnie. */
  weight: number | string
  /** Gdy podany, krój jest zawężony dokładnie do tych znaków. */
  text?: string
}

const JOBS: FontJob[] = [
  { file: 'archivo-latin', family: 'Archivo', weight: '100..900', text: LATIN },
  { file: 'spectral-300-latin', family: 'Spectral', weight: 300, text: LATIN },
  { file: 'spectral-400-latin', family: 'Spectral', weight: 400, text: LATIN },
  { file: 'plex-mono-400-latin', family: 'IBM Plex Mono', weight: 400, text: LATIN },
  { file: 'noto-serif-jp', family: 'Noto Serif JP', weight: 400, text: KANA + KANJI_M0 + LATIN },
  { file: 'noto-serif-kr', family: 'Noto Serif KR', weight: 400, text: HANGUL_M0 + LATIN },
]

function cssUrl({ family, weight, text }: FontJob): string {
  const axis = typeof weight === 'string' ? `wght@${weight}` : `wght@${weight}`
  const params = new URLSearchParams({
    family: `${family}:${axis}`,
    display: 'swap',
  })
  if (text) params.set('text', text)
  return `https://fonts.googleapis.com/css2?${params.toString()}`
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': WOFF2_UA } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`)
  return response.text()
}

async function run(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  let total = 0

  for (const job of JOBS) {
    const css = await fetchText(cssUrl(job))
    // Z parametrem `text=` API zwraca URL bez rozszerzenia (`/l/font?kit=…`),
    // więc rozpoznajemy format po deklaracji `format('woff2')`, nie po ścieżce.
    const sources = [...css.matchAll(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('woff2'\)/g)].map(
      (m) => m[1]!,
    )

    if (sources.length === 0) {
      throw new Error(`Brak woff2 w odpowiedzi dla ${job.family} — API zmieniło format?`)
    }
    if (sources.length > 1) {
      // Z parametrem `text=` API zawsze zwraca jeden plik. Więcej oznacza, że subset
      // się nie zastosował, a wtedy Noto Serif JP wraca do pełnego rozmiaru.
      throw new Error(`${job.family}: ${sources.length} plików zamiast jednego — subset nie zadziałał`)
    }

    const binary = await fetch(sources[0]!, { headers: { 'User-Agent': WOFF2_UA } })
    if (!binary.ok) throw new Error(`${binary.status} przy pobieraniu ${job.file}`)

    const bytes = Buffer.from(await binary.arrayBuffer())
    await writeFile(resolve(OUT_DIR, `${job.file}.woff2`), bytes)
    total += bytes.byteLength

    const kb = (bytes.byteLength / 1024).toFixed(1)
    console.log(`  ${job.file.padEnd(22)} ${kb.padStart(7)} kB   ${job.family}`)
  }

  console.log(`\nRazem ${(total / 1024).toFixed(1)} kB w ${OUT_DIR}`)
  console.log('Pliki są commitowane — aplikacja nie może zależeć od sieci przy pierwszym otwarciu.')
}

await run()
