import { db, type LangSettings } from './db'
import type { CardState } from '@/srs/types'
import type { StoredLog } from './db'

/**
 * Kopia zapasowa postępu — sekcja 14 planu, ryzyko „Safari czyści IndexedDB".
 *
 * IndexedDB jest źródłem prawdy, ale nie jest trwałym magazynem: Safari kasuje dane
 * witryn nieodwiedzanych przez siedem dni, a użytkownik nie dostaje o tym żadnego
 * sygnału. Synchronizacja z chmurą to M6; eksport do pliku jest tańszy, działa offline
 * i nie wymaga konta, więc wchodzi wcześniej.
 *
 * Plik jest zwykłym JSON-em, nie formatem binarnym: ma dać się otworzyć i przeczytać
 * bez tej aplikacji. To jest cała jego wartość — kopia, której nie da się odczytać
 * inaczej niż programem, który ją stworzył, nie jest kopią, tylko drugą awarią w kolejce.
 */

/** Wersja formatu. Import (M6) musi wiedzieć, co czyta. */
const FORMAT = 1

export type Backup = {
  format: number
  exportedAt: string
  settings: LangSettings[]
  cards: CardState[]
  log: StoredLog[]
}

export async function collectBackup(): Promise<Backup> {
  const [settings, cards, log] = await Promise.all([
    db.settings.toArray(),
    db.cards.toArray(),
    db.log.toArray(),
  ])
  return { format: FORMAT, exportedAt: new Date().toISOString(), settings, cards, log }
}

/** Nazwa pliku z datą — kopii bywa kilka i muszą się rozróżniać w katalogu pobranych. */
export function backupName(now = new Date()): string {
  return `nabu-${now.toISOString().slice(0, 10)}.json`
}

/**
 * Zapisuje kopię na dysk użytkownika. Przez `<a download>` i obiekt URL, bo to jedyna
 * droga działająca w PWA na iOS bez uprawnień i bez serwera.
 */
export async function downloadBackup(): Promise<void> {
  const backup = await collectBackup()
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = backupName()
  link.click()
  // Bez zwolnienia URL kopia zostaje w pamięci karty aż do jej zamknięcia, a przy talii
  // z tysiącami kart to megabajty.
  URL.revokeObjectURL(url)
}

/**
 * Kasuje wszystko, co należy do jednego języka: karty, log i ustawienia.
 *
 * W jednej transakcji, bo połowiczne wyczyszczenie jest gorsze niż żadne — zostałyby
 * ustawienia bez kart albo log wskazujący na karty, których nie ma.
 */
export async function clearLanguage(lang: string): Promise<void> {
  await db.transaction('rw', db.cards, db.log, db.settings, async () => {
    await db.cards.where('lang').equals(lang).delete()
    await db.log.where('lang').equals(lang).delete()
    await db.settings.delete(lang)
  })
}
