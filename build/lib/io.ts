/**
 * Wspólne narzędzia kroków builda: ścieżki, cache pobrań, czytanie TSV.
 *
 * Wszystko, co pobrane, ląduje w `build/cache/` (poza gitem). Krok, który już ma
 * plik w cache, nie pobiera go ponownie — pipeline uruchamia się wielokrotnie przy
 * strojeniu filtrów i ściąganie 150 MB za każdym razem byłoby absurdem.
 */

import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import { createReadStream } from 'node:fs'
import { spawn } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))

export const ROOT = resolve(HERE, '../..')
export const CACHE = resolve(ROOT, 'build/cache')
export const DATA = resolve(ROOT, 'data')

export function cachePath(name: string): string {
  return resolve(CACHE, name)
}

export function dataPath(lang: string, name: string): string {
  return resolve(DATA, lang, name)
}

async function exists(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.size > 0
  } catch {
    return false
  }
}

/** Pobiera plik do cache, jeśli go tam jeszcze nie ma. Zwraca ścieżkę. */
export async function download(url: string, name: string): Promise<string> {
  const target = cachePath(name)
  if (await exists(target)) return target

  await mkdir(CACHE, { recursive: true })
  process.stdout.write(`  pobieram ${name} … `)

  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText} — ${url}`)
  }
  // Rzutowanie: typy DOM i Node dla ReadableStream nie są zgodne nominalnie,
  // choć w runtime to ten sam obiekt.
  const stream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
  await pipeline(stream, createWriteStream(target))

  const { size } = await stat(target)
  console.log(`${(size / 1048576).toFixed(1)} MB`)
  return target
}

/**
 * Pobiera archiwum `.bz2` i rozpakowuje do pliku obok. Rozpakowanie idzie przez
 * systemowe `bunzip2` — w Node nie ma bzip2, a doinstalowywanie biblioteki tylko po to
 * byłoby zamianą jednej zależności na gorszą.
 */
export async function downloadBz2(url: string, name: string): Promise<string> {
  const plain = cachePath(name)
  if (await exists(plain)) return plain

  const archive = await download(url, `${name}.bz2`)
  process.stdout.write(`  rozpakowuję ${name} … `)

  await new Promise<void>((ok, fail) => {
    const child = spawn('bunzip2', ['-kf', archive])
    child.on('error', fail)
    child.on('exit', (code) =>
      code === 0 ? ok() : fail(new Error(`bunzip2 zakończył się kodem ${code}`)),
    )
  })

  const { size } = await stat(plain)
  console.log(`${(size / 1048576).toFixed(1)} MB`)
  return plain
}

/**
 * Czyta plik wiersz po wierszu. Pliki Tatoeba i Wikisłownika mają setki megabajtów,
 * więc wczytanie w całości do pamięci nie wchodzi w grę.
 */
export async function* readLines(path: string): AsyncGenerator<string> {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  for await (const line of rl) {
    if (line.length > 0) yield line
  }
}

/** Czyta TSV jako tablice pól. */
export async function* readTsv(path: string): AsyncGenerator<string[]> {
  for await (const line of readLines(path)) yield line.split('\t')
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}
