import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cssVar, TOKENS } from './tokens'
import {
  DEFAULT_MODE,
  DEFAULT_PRESET,
  MODES,
  PRESETS,
  PRESETS_IDS,
  paletteOf,
  type Mode,
  type PresetId,
  type Variant,
} from './presets'

/**
 * Motyw — sekcja 9.1 planu.
 *
 * Ustawienie ma dwie niezależne osie: preset barw i wariant. „Systemowy" nie jest
 * trzecim wariantem, tylko sposobem wybrania jednego z dwóch — dlatego `mode`
 * i `variant` to osobne pojęcia i tylko `variant` trafia do DOM.
 */

const STORAGE_PRESET = 'nabu.theme.preset'
const STORAGE_MODE = 'nabu.theme.mode'

type ThemeState = {
  preset: PresetId
  mode: Mode
  /** Wariant po rozstrzygnięciu trybu systemowego. To on rządzi wyglądem. */
  variant: Variant
  setPreset: (preset: PresetId) => void
  setMode: (mode: Mode) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

function isPreset(value: unknown): value is PresetId {
  return typeof value === 'string' && (PRESETS_IDS as readonly string[]).includes(value)
}

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
}

function readStored<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return guard(raw) ? raw : fallback
  } catch {
    // Safari w trybie prywatnym potrafi rzucić na samym odczycie. Motyw nie jest
    // powodem, żeby aplikacja się nie uruchomiła.
    return fallback
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* jw. */
  }
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemVariant(): Variant {
  if (typeof matchMedia === 'undefined') return 'dark'
  return matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Wpisuje paletę do `<html>` jako zmienne CSS i domyka dwie rzeczy, o których łatwo
 * zapomnieć: `color-scheme` (paski przewijania, kontrolki systemowe, pole tekstowe
 * przy kartach produkcji) oraz `theme-color` (pasek stanu w zainstalowanym PWA).
 * Bez nich przełączenie motywu zostawia dwa elementy w poprzednim.
 */
function applyTheme(preset: PresetId, variant: Variant): void {
  const root = document.documentElement
  const palette = paletteOf(preset, variant)

  for (const token of TOKENS) root.style.setProperty(cssVar(token), palette[token])

  root.dataset['preset'] = preset
  root.dataset['variant'] = variant
  root.style.colorScheme = variant

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = palette.bg
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<PresetId>(() =>
    readStored(STORAGE_PRESET, isPreset, DEFAULT_PRESET),
  )
  const [mode, setModeState] = useState<Mode>(() => readStored(STORAGE_MODE, isMode, DEFAULT_MODE))
  const [resolved, setResolved] = useState<Variant>(systemVariant)

  // Tryb systemowy musi reagować na zmianę w trakcie działania — iOS przełącza motyw
  // o zachodzie słońca, a aplikacja bywa wtedy otwarta.
  useEffect(() => {
    if (mode !== 'system' || typeof matchMedia === 'undefined') return
    const query = matchMedia(DARK_QUERY)
    const onChange = () => setResolved(query.matches ? 'dark' : 'light')
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [mode])

  const variant: Variant = mode === 'system' ? resolved : mode

  useEffect(() => {
    applyTheme(preset, variant)
  }, [preset, variant])

  const setPreset = useCallback((next: PresetId) => {
    setPresetState(next)
    writeStored(STORAGE_PRESET, next)
  }, [])

  const setMode = useCallback((next: Mode) => {
    setModeState(next)
    writeStored(STORAGE_MODE, next)
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ preset, mode, variant, setPreset, setMode }),
    [preset, mode, variant, setPreset, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme poza ThemeProvider')
  return context
}

export { PRESETS, PRESETS_IDS, MODES }
export type { Mode, PresetId, Variant }
