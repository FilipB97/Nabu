import { cp, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Serwowanie katalogu `data/`.
 *
 * Talie NIE mogą leżeć w `public/`, bo wszystko stamtąd trafia do precache'a service
 * workera. Przy 22 MB danych oznaczałoby to, że pierwsze otwarcie aplikacji ściąga
 * komplet pięciu języków, zanim pokaże cokolwiek — a limit cache Safari jest niżej
 * (sekcja 14 planu).
 *
 * Zamiast tego kopiujemy `data/` obok builda i pobieramy paczki na żądanie, regułą
 * runtime w Workboxie. Użytkownik ściąga tyle talii, ile faktycznie przerobił.
 */
export function nabuData(): Plugin {
  const root = resolve(process.cwd(), 'data')

  return {
    name: 'nabu-data',

    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        // `normalize` po `decodeURI` odcina próby wyjścia z katalogu przez `..`.
        const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!))
        if (rel.includes('..')) return next()

        const file = join(root, rel)
        stat(file)
          .then((info) => {
            if (!info.isFile()) return next()
            res.setHeader(
              'Content-Type',
              extname(file) === '.json' ? 'application/json; charset=utf-8' : 'text/plain',
            )
            createReadStream(file).pipe(res)
          })
          .catch(() => next())
      })
    },

    async closeBundle() {
      await cp(root, resolve(process.cwd(), 'dist/data'), { recursive: true })
    },
  }
}
