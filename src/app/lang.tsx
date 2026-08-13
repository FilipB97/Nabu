import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { adapterFor } from '@/langs'
import { currentStage, stageProgress, type GatedStage } from '@/session/stages'
import { loadMeta, type DeckMeta } from '@/store/decks'
import { addedLanguages, backlogCount, db, dueCount, type LangSettings } from '@/store/db'

/**
 * Wybrany język — stan globalny, nie lokalny stan ekranu startu.
 *
 * Przed redesignem język wybierało się na ekranie głównym i tylko on o tym wiedział.
 * Po dołożeniu szyny bocznej i zakładek ta sama informacja jest potrzebna w trzech
 * miejscach naraz (szyna, nagłówek, ustawienia), więc musi mieszkać wyżej. Wybór
 * przeżywa przeładowanie, bo przełączanie języka przy każdym wejściu byłoby podatkiem
 * od korzystania z aplikacji.
 */

export type LangRow = {
  settings: LangSettings
  due: number
  backlog: number
  stage: GatedStage
  progress: { solid: number; needed: number }
  meta: DeckMeta
}

type LangState = {
  rows: LangRow[] | null
  /** Wybrany język albo `null`, gdy nie dodano jeszcze żadnego. */
  selected: string | null
  current: LangRow | null
  select: (lang: string) => void
  refresh: () => Promise<void>
}

const LangContext = createContext<LangState | null>(null)
const STORAGE = 'nabu.lang'

export function LangProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<LangRow[] | null>(null)
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE)
    } catch {
      return null
    }
  })

  const refresh = useCallback(async () => {
    const now = Date.now()
    const langs = await addedLanguages()
    const loaded = await Promise.all(
      langs.map(async (settings): Promise<LangRow> => {
        const meta = await loadMeta(settings.lang)
        const cards = await db.cards.where('lang').equals(settings.lang).toArray()
        const stage = currentStage(adapterFor(settings.lang), cards, meta, settings.stageOverride)
        return {
          settings,
          meta,
          stage,
          progress: stageProgress(cards, meta, stage),
          due: await dueCount(settings.lang, now),
          backlog: await backlogCount(settings.lang),
        }
      }),
    )
    setRows(loaded)
    setSelected((current) => {
      if (current && loaded.some((row) => row.settings.lang === current)) return current
      return loaded.find((row) => row.settings.active)?.settings.lang ?? loaded[0]?.settings.lang ?? null
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const select = useCallback((lang: string) => {
    setSelected(lang)
    try {
      localStorage.setItem(STORAGE, lang)
    } catch {
      // Tryb prywatny Safari potrafi rzucić na zapisie. Wybór działa dalej, tylko nie przeżyje.
    }
  }, [])

  const value = useMemo<LangState>(
    () => ({
      rows,
      selected,
      current: rows?.find((row) => row.settings.lang === selected) ?? null,
      select,
      refresh,
    }),
    [rows, selected, select, refresh],
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLangs(): LangState {
  const state = useContext(LangContext)
  if (!state) throw new Error('useLangs poza LangProvider')
  return state
}
