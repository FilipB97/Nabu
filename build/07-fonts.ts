/**
 * Krok 07 — kroje pisma hostowane u siebie i zsubsetowane. Sekcja 9.2 planu.
 *
 * Aplikacja ma otwierać się w samolocie, więc `preconnect` do fonts.gstatic.com
 * nie może przetrwać przeniesienia makiety do kodu. Pobieramy kroje raz, subsetujemy
 * lokalnie, commitujemy do `public/fonts/` i wpinamy przez `@font-face` w `src/index.css`.
 *
 * Zestaw znaków bierzemy z `data/`: skrypt czyta wszystkie talie i buduje unię znaków,
 * które faktycznie występują. Dzięki temu subset regeneruje się razem z danymi i nie ma
 * ryzyka, że talia urośnie o znak, którego krój nie zawiera.
 *
 * DLACZEGO LOKALNIE, A NIE PRZEZ API GOOGLE FONTS. Parametr `text=` w css2 subsetuje
 * po stronie serwera i działał, dopóki zestaw był mały. Po dołożeniu koreańskiego urósł
 * do 690 znaków (5,5 kB po zakodowaniu w URL-u), Google po cichu zignorował parametr
 * i zwrócił pełny krój w 124 kawałkach — czyli dokładnie to, czego ta sekcja planu
 * zabrania. Cichy fallback do pełnego kroju jest gorszy od błędu, więc skrypt sprawdza
 * teraz wagę wyniku i przerywa, gdy subset nie zadziałał.
 *
 * Uruchomienie:  npm run build:fonts   (wymaga `pip install fonttools brotli`)
 */

import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CACHE, DATA, download } from './lib/io.ts'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/fonts')

/** Znaki potrzebne polskiemu interfejsowi, niezależnie od zawartości talii. */
const LATIN =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  'ĄĆĘŁŃÓŚŹŻąćęłńóśźż' +
  'ÁÀÂÃÄÅÇÉÈÊËÍÌÎÏÑÓÒÔÕÖÚÙÛÜÝáàâãäåçéèêëíìîïñóòôõöúùûüýÿ' +
  'ÆØÅæøå' +
  ' .,;:!?¡¿·—–-…„“”‘’"\'()[]{}/\\@#%&*+=<>|~^$€£×÷°'

/** Kana w całości: etap 0 japońskiego wymaga wszystkich znaków, nie tylko tych z talii. */
const KANA =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' +
  'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽっゃゅょぁぃぅぇぉー' +
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
  'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポッャュョァィゥェォ' +
  '、。「」・'

/**
 * Alfabet arabski w całości. Etap 0 wymaga wszystkich 28 liter, a subset po samej talii
 * dałby litery w formach, które w niej wystąpiły — a litera arabska ma cztery kształty
 * zależne od pozycji i wszystkie muszą być w kroju, bo inaczej wyraz rozpadnie się
 * na oderwane znaki przy pierwszym słowie spoza subsetu.
 */
const ARABIC = 'اأإآبتثجحخدذرزسشصضطظعغفقكلمنهوىيءؤئةًٌٍَُِّْ٠١٢٣٤٥٦٧٨٩،؟؛'

/** Znaki z dema, żeby strona demonstracyjna działała także bez talii japońskiej. */
const DEMO = '水氷湯米建物確認물불밀말좀주세요안녕하십니까'

/** Zbiera znaki występujące w taliach, w rozbiciu na systemy pisma. */
async function charsFromData(): Promise<{
  latin: string
  hangul: string
  cjk: string
  arabic: string
}> {
  const chars = new Set<string>()
  let langs: string[] = []
  try {
    langs = await readdir(DATA)
  } catch {
    return { latin: '', hangul: '', cjk: '', arabic: '' }
  }

  for (const lang of langs) {
    let files: string[] = []
    try {
      files = await readdir(resolve(DATA, lang))
    } catch {
      continue
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      for (const char of await readFile(resolve(DATA, lang, file), 'utf8')) chars.add(char)
    }
  }

  const pick = (re: RegExp) => [...chars].filter((c) => re.test(c)).join('')
  return {
    latin: pick(/[\p{Script=Latin}\p{P}\p{S}]/u),
    hangul: pick(/\p{Script=Hangul}/u),
    cjk: pick(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u),
    arabic: pick(/\p{Script=Arabic}/u),
  }
}

const fromData = await charsFromData()

const GH = 'https://raw.githubusercontent.com/google/fonts/main'

type FontJob = { file: string; url: string; chars: string }

const JOBS: FontJob[] = [
  {
    file: 'archivo-latin',
    url: `${GH}/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf`,
    chars: LATIN + fromData.latin,
  },
  {
    file: 'spectral-300-latin',
    url: `${GH}/ofl/spectral/Spectral-Light.ttf`,
    chars: LATIN + fromData.latin,
  },
  {
    file: 'spectral-400-latin',
    url: `${GH}/ofl/spectral/Spectral-Regular.ttf`,
    chars: LATIN + fromData.latin,
  },
  {
    file: 'plex-mono-400-latin',
    url: `${GH}/ofl/ibmplexmono/IBMPlexMono-Regular.ttf`,
    // Krój maszynowy niesie czytania — pinyin z tonami (`chuán`, `nǚ`) i romaji z kreskami
    // (`ō`, `ū`). Te znaki są w taliach, nie w polskim interfejsie, więc sam `LATIN`
    // nie wystarcza: brakujący znak nie znika, tylko wypada do kroju systemowego
    // i czytanie rozjeżdża się w połowie słowa.
    chars: LATIN + fromData.latin,
  },
  {
    file: 'noto-serif-jp',
    url: `${GH}/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf`,
    chars: KANA + DEMO + LATIN + fromData.cjk,
  },
  {
    file: 'noto-serif-kr',
    url: `${GH}/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf`,
    chars: DEMO + LATIN + fromData.hangul,
  },
  {
    // Naskh, nie Kufi ani Nastaliq: to jest krój, którym drukuje się książki i prasę,
    // więc uczący się widzi kształty, które spotka poza aplikacją.
    file: 'noto-naskh-arabic',
    url: `${GH}/ofl/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf`,
    chars: ARABIC + LATIN + fromData.arabic,
  },
]

/** Zawęża krój do podanych znaków przez `fontTools.subset` i zapisuje jako woff2. */
function subset(source: string, target: string, chars: string): Promise<void> {
  const unique = [...new Set(chars)].join('')
  return new Promise((ok, fail) => {
    const child = spawn('python3', [
      '-m',
      'fontTools.subset',
      source,
      `--text=${unique}`,
      `--output-file=${target}`,
      '--flavor=woff2',
      '--layout-features=*',
      '--no-hinting',
    ])
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += String(chunk)))
    child.on('error', fail)
    child.on('exit', (code) =>
      code === 0
        ? ok()
        : fail(new Error(`fontTools.subset zakończył się kodem ${code}\n${stderr}`)),
    )
  })
}

async function run(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(CACHE, { recursive: true })
  let total = 0

  for (const job of JOBS) {
    const source = await download(job.url, `font-${job.file}.ttf`)
    const target = resolve(OUT_DIR, `${job.file}.woff2`)

    await subset(source, target, job.chars)
    const { size } = await stat(target)

    // Bezpiecznik: subset nie może po cichu zwrócić pełnego kroju. Noto Serif JP
    // w całości waży kilka megabajtów i rozwala precache, a bramka M0 przechodziłaby
    // wtedy tylko pozornie.
    if (size > 1_500_000) {
      throw new Error(
        `${job.file}: wynik waży ${(size / 1048576).toFixed(1)} MB — subset nie zadziałał`,
      )
    }

    total += size
    console.log(
      `  ${job.file.padEnd(22)} ${(size / 1024).toFixed(1).padStart(7)} kB   ` +
        `${new Set(job.chars).size} znaków`,
    )
  }

  console.log(`\nRazem ${(total / 1024).toFixed(1)} kB w ${OUT_DIR}`)
  console.log('Pliki są commitowane — aplikacja nie może zależeć od sieci przy pierwszym otwarciu.')
}

await run()
