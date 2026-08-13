/**
 * Presety motywu — sekcja 9.1 planu.
 *
 * Preset to inna rampa neutralna i inna barwa akcentu. Zasada „dokładnie jeden kolor
 * akcentu" obowiązuje w każdym z nich: w tej aplikacji NIE MA koloru błędu. Pudło
 * niesie znak `×`, wygaszenie i ledwie ciepły obrys, a pomyłki na pasku postępu mają
 * kolor akcentu.
 *
 * Wartości Atramentu pochodzą wprost z makiety (`docs/design/`) wszędzie tam, gdzie
 * przechodzą politykę kontrastu. Dwa tokeny musiały zostać podniesione — patrz
 * `docs/ADR-002-motywy.md`. Reszta presetów jest wyprowadzona z tych samych proporcji
 * kontrastu, więc każdy z nich niesie tę samą hierarchię, tylko w innej barwie.
 *
 * Każda zmiana wartości w tym pliku przechodzi przez `contrast.test.ts`. Jeśli test
 * pada, to preset jest zły — nie test.
 */

import type { Palette, Token } from './tokens'

export const PRESETS_IDS = ['studio', 'atrament', 'grafit', 'mech', 'piasek', 'kontrast'] as const
export type PresetId = (typeof PRESETS_IDS)[number]

/** Wariant jasny albo ciemny. „systemowy" nie jest wariantem, tylko sposobem wyboru. */
export const VARIANTS = ['dark', 'light'] as const
export type Variant = (typeof VARIANTS)[number]

/** Ustawienie widoczne dla użytkownika: dwa wymuszone warianty plus tryb systemowy. */
export const MODES = ['dark', 'light', 'system'] as const
export type Mode = (typeof MODES)[number]

export type Preset = {
  id: PresetId
  name: string
  description: string
  dark: Palette
  light: Palette
}

const PALETTES: Record<PresetId, Record<Variant, Palette>> = {
  atrament: {
    dark: {
      bg: '#0F1622',
      surface: '#131C2B',
      'surface-2': '#222A39',
      text: '#E7EAF2',
      'text-2': '#8A94A9',
      'text-3': '#767F94',
      border: '#2C3852',
      'border-quiet': '#1D2739',
      accent: '#8FA8F0',
      'accent-2': '#A09FF4',
      'accent-deep': '#6376AA',
      'accent-text': '#000000',
      shadow: '#000000',
      'tick-done': '#5A6580',
      'tick-future': '#222C40',
      'tick-current': '#E7EAF2',
      'wrong-border': '#3A2A33',
      'wrong-bg': '#131C2B',
      'wrong-text': '#968080',
    },
    light: {
      bg: '#F3F2EE',
      surface: '#E3E4EB',
      'surface-2': '#F6F7F9',
      text: '#1B2233',
      'text-2': '#585C68',
      'text-3': '#696D77',
      border: '#CECFCE',
      'border-quiet': '#E0DDD5',
      accent: '#4358C9',
      'accent-2': '#4434C4',
      'accent-deep': '#2C3972',
      'accent-text': '#FFFFFF',
      shadow: '#171D2B',
      'tick-done': '#85888F',
      'tick-future': '#DCD9D1',
      'tick-current': '#1B2233',
      'wrong-border': '#D8CDC7',
      'wrong-bg': '#E3E4EB',
      'wrong-text': '#825C51',
    },
  },

  grafit: {
    dark: {
      bg: '#14161A',
      surface: '#262321',
      'surface-2': '#2E2B29',
      text: '#EDEDEC',
      'text-2': '#939495',
      'text-3': '#7F8182',
      border: '#393B3E',
      'border-quiet': '#25272B',
      accent: '#E0A76B',
      'accent-2': '#E6CE79',
      'accent-deep': '#92704C',
      'accent-text': '#000000',
      shadow: '#000000',
      'tick-done': '#656668',
      'tick-future': '#2A2C2F',
      'tick-current': '#EDEDEC',
      'wrong-border': '#413839',
      'wrong-bg': '#262321',
      'wrong-text': '#A18682',
    },
    light: {
      bg: '#F5F4F2',
      surface: '#EBE5DE',
      'surface-2': '#F9F7F5',
      text: '#1C1D20',
      'text-2': '#5D5D5F',
      'text-3': '#6E6E70',
      border: '#D0CFCE',
      'border-quiet': '#DCDBDA',
      accent: '#8A5210',
      'accent-2': '#7A650B',
      'accent-deep': '#4A3319',
      'accent-text': '#FFFFFF',
      shadow: '#18191B',
      'tick-done': '#8A898A',
      'tick-future': '#DFDFDD',
      'tick-current': '#1C1D20',
      'wrong-border': '#DACDC9',
      'wrong-bg': '#EBE5DE',
      'wrong-text': '#845C51',
    },
  },

  mech: {
    dark: {
      bg: '#101710',
      surface: '#222619',
      'surface-2': '#282C1F',
      text: '#E6EBE3',
      'text-2': '#8F958E',
      'text-3': '#7C827A',
      border: '#343B34',
      'border-quiet': '#212821',
      accent: '#D8C079',
      'accent-2': '#DDDF87',
      'accent-deep': '#80764B',
      'accent-text': '#000000',
      shadow: '#000000',
      'tick-done': '#616860',
      'tick-future': '#252C25',
      'tick-current': '#E6EBE3',
      'wrong-border': '#3E3A31',
      'wrong-bg': '#222619',
      'wrong-text': '#9F887D',
    },
    light: {
      bg: '#F1F3EC',
      surface: '#E5E6D8',
      'surface-2': '#F7F7F3',
      text: '#1A2018',
      'text-2': '#595D56',
      'text-3': '#6A6E67',
      border: '#CCCFC8',
      'border-quiet': '#D8DBD4',
      accent: '#6A6212',
      'accent-2': '#4D5A0D',
      'accent-deep': '#3C3C15',
      'accent-text': '#FFFFFF',
      shadow: '#161B14',
      'tick-done': '#858982',
      'tick-future': '#DCDED7',
      'tick-current': '#1A2018',
      'wrong-border': '#D6CDC5',
      'wrong-bg': '#E4E5D7',
      'wrong-text': '#805C52',
    },
  },

  piasek: {
    dark: {
      bg: '#1A1613',
      surface: '#232623',
      'surface-2': '#292C29',
      text: '#EFE9E0',
      'text-2': '#99948D',
      'text-3': '#86807A',
      border: '#3E3A36',
      'border-quiet': '#2B2723',
      accent: '#7FC4C0',
      'accent-2': '#8BBFCC',
      'accent-deep': '#577E7B',
      'accent-text': '#000000',
      shadow: '#000000',
      'tick-done': '#6A6660',
      'tick-future': '#2F2B28',
      'tick-current': '#EFE9E0',
      'wrong-border': '#473932',
      'wrong-bg': '#232623',
      'wrong-text': '#A5877C',
    },
    light: {
      bg: '#F6F1E9',
      surface: '#E2E4DE',
      'surface-2': '#F6F7F5',
      text: '#221C16',
      'text-2': '#615B55',
      'text-3': '#726C66',
      border: '#D2CDC5',
      'border-quiet': '#DED8D1',
      accent: '#14666A',
      'accent-2': '#0F435B',
      'accent-deep': '#1C3B39',
      'accent-text': '#FFFFFF',
      shadow: '#1D1813',
      'tick-done': '#8D8780',
      'tick-future': '#E1DCD4',
      'tick-current': '#221C16',
      'wrong-border': '#DCCAC0',
      'wrong-bg': '#E2E4DE',
      'wrong-text': '#8A5748',
    },
  },

  studio: {
    dark: {
      bg: '#0E1014',
      surface: '#161A21',
      'surface-2': '#1C222C',
      text: '#E9EBEF',
      'text-2': '#9BA3B2',
      'text-3': '#7C8494',
      border: '#232935',
      'border-quiet': '#1E242E',
      accent: '#8C9BFF',
      'accent-2': '#A79BFF',
      'accent-deep': '#5B6CFF',
      'accent-text': '#0B0D12',
      shadow: '#000000',
      'tick-done': '#5A6373',
      'tick-future': '#2B3242',
      'tick-current': '#E9EBEF',
      'wrong-border': '#4A382F',
      'wrong-bg': '#1E1917',
      'wrong-text': '#C99A86',
    },
    light: {
      bg: '#F4F5F7',
      surface: '#FFFFFF',
      'surface-2': '#ECEEF3',
      text: '#141821',
      'text-2': '#585F6E',
      'text-3': '#666D7C',
      border: '#DDE0E7',
      'border-quiet': '#DBDFE7',
      accent: '#4453C9',
      'accent-2': '#5B4FC0',
      'accent-deep': '#2E3A9E',
      'accent-text': '#FFFFFF',
      shadow: '#141821',
      'tick-done': '#82899A',
      'tick-future': '#DCDFE6',
      'tick-current': '#141821',
      'wrong-border': '#D8C7BC',
      'wrong-bg': '#F2EDE9',
      'wrong-text': '#8A5B45',
    },
  },

  kontrast: {
    dark: {
      bg: '#000000',
      surface: '#0D1217',
      'surface-2': '#1C2025',
      text: '#FFFFFF',
      'text-2': '#898989',
      'text-3': '#767676',
      border: '#2B2B2B',
      'border-quiet': '#1E1E1E',
      accent: '#8FC7FF',
      'accent-2': '#A3B9FF',
      'accent-deep': '#597B9E',
      'accent-text': '#000000',
      shadow: '#000000',
      'tick-done': '#5D5D5D',
      'tick-future': '#1A1A1A',
      'tick-current': '#FFFFFF',
      'wrong-border': '#382825',
      'wrong-bg': '#0D1217',
      'wrong-text': '#9D746D',
    },
    light: {
      bg: '#FFFFFF',
      surface: '#E9EEFA',
      'surface-2': '#F8FAFD',
      text: '#000000',
      'text-2': '#636363',
      'text-3': '#757575',
      border: '#D4D4D4',
      'border-quiet': '#E5E5E5',
      accent: '#0B44C4',
      'accent-2': '#060DB5',
      'accent-deep': '#051D52',
      'accent-text': '#FFFFFF',
      shadow: '#000000',
      'tick-done': '#919191',
      'tick-future': '#E6E6E6',
      'tick-current': '#000000',
      'wrong-border': '#E9D0CB',
      'wrong-bg': '#E9EEFA',
      'wrong-text': '#A25544',
    },
  },
}

const META: Record<PresetId, { name: string; description: string }> = {
  studio: {
    name: 'Studio',
    description: 'Chłodny grafit z indygo. Domyślny — kierunek z redesignu.',
  },
  atrament: {
    name: 'Atrament',
    description: 'Granat i błękit. Wariant z makiety, punkt odniesienia dla reszty.',
  },
  grafit: {
    name: 'Grafit',
    description: 'Neutralny węgiel z bursztynowym akcentem. Bez barwnego zabarwienia tła.',
  },
  mech: {
    name: 'Mech',
    description: 'Ciemna zieleń i przygaszone złoto. Najcieplejszy z ciemnych.',
  },
  piasek: {
    name: 'Piasek',
    description: 'Brąz z turkusowym akcentem — jedyny preset z akcentem chłodniejszym od tła.',
  },
  kontrast: {
    name: 'Wysoki kontrast',
    description:
      'Czerń i biel, akcent maksymalnie odsunięty od tła. Dla słabego wzroku i mocnego słońca.',
  },
}

export const PRESETS: Record<PresetId, Preset> = Object.fromEntries(
  PRESETS_IDS.map((id) => [id, { id, ...META[id], ...PALETTES[id] }]),
) as Record<PresetId, Preset>

export const DEFAULT_PRESET: PresetId = 'studio'
export const DEFAULT_MODE: Mode = 'dark'

/** Paleta dla danego presetu i rozstrzygniętego wariantu. */
export function paletteOf(preset: PresetId, variant: Variant): Palette {
  return PRESETS[preset][variant]
}

/** Odczyt pojedynczego tokenu — używane przez podgląd presetów i test kontrastu. */
export function tokenOf(preset: PresetId, variant: Variant, token: Token): string {
  return paletteOf(preset, variant)[token]
}
