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

export const PRESETS_IDS = ['atrament', 'grafit', 'mech', 'piasek', 'kontrast'] as const
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
      text: '#E7EAF2',
      'text-2': '#8A94A9',
      'text-3': '#767F94',
      border: '#2C3852',
      'border-quiet': '#1D2739',
      accent: '#8FA8F0',
      'tick-done': '#5A6580',
      'tick-future': '#222C40',
      'tick-current': '#E7EAF2',
      'wrong-border': '#3A2A33',
      'wrong-text': '#927B7B',
    },
    light: {
      bg: '#F3F2EE',
      surface: '#E3E4EB',
      text: '#1B2233',
      'text-2': '#585C68',
      'text-3': '#696D77',
      border: '#CECFCE',
      'border-quiet': '#E0DDD5',
      accent: '#4358C9',
      'tick-done': '#85888F',
      'tick-future': '#DCD9D1',
      'tick-current': '#1B2233',
      'wrong-border': '#D8CDC7',
      'wrong-text': '#8C6357',
    },
  },

  grafit: {
    dark: {
      bg: '#14161A',
      surface: '#262321',
      text: '#EDEDEC',
      'text-2': '#939495',
      'text-3': '#7F8182',
      border: '#393B3E',
      'border-quiet': '#25272B',
      accent: '#E0A76B',
      'tick-done': '#656668',
      'tick-future': '#2A2C2F',
      'tick-current': '#EDEDEC',
      'wrong-border': '#413839',
      'wrong-text': '#987A76',
    },
    light: {
      bg: '#F5F4F2',
      surface: '#EBE5DE',
      text: '#1C1D20',
      'text-2': '#5D5D5F',
      'text-3': '#6E6E70',
      border: '#D0CFCE',
      'border-quiet': '#DCDBDA',
      accent: '#8A5210',
      'tick-done': '#8A898A',
      'tick-future': '#DFDFDD',
      'tick-current': '#1C1D20',
      'wrong-border': '#DACDC9',
      'wrong-text': '#906458',
    },
  },

  mech: {
    dark: {
      bg: '#101710',
      surface: '#222619',
      text: '#E6EBE3',
      'text-2': '#8F958E',
      'text-3': '#7C827A',
      border: '#343B34',
      'border-quiet': '#212821',
      accent: '#D8C079',
      'tick-done': '#616860',
      'tick-future': '#252C25',
      'tick-current': '#E6EBE3',
      'wrong-border': '#3E3A31',
      'wrong-text': '#947B6E',
    },
    light: {
      bg: '#F1F3EC',
      surface: '#E5E6D8',
      text: '#1A2018',
      'text-2': '#595D56',
      'text-3': '#6A6E67',
      border: '#CCCFC8',
      'border-quiet': '#D8DBD4',
      accent: '#6A6212',
      'tick-done': '#858982',
      'tick-future': '#DCDED7',
      'tick-current': '#1A2018',
      'wrong-border': '#D6CDC5',
      'wrong-text': '#8B6459',
    },
  },

  piasek: {
    dark: {
      bg: '#1A1613',
      surface: '#232623',
      text: '#EFE9E0',
      'text-2': '#99948D',
      'text-3': '#86807A',
      border: '#3E3A36',
      'border-quiet': '#2B2723',
      accent: '#7FC4C0',
      'tick-done': '#6A6660',
      'tick-future': '#2F2B28',
      'tick-current': '#EFE9E0',
      'wrong-border': '#473932',
      'wrong-text': '#9B7A6D',
    },
    light: {
      bg: '#F6F1E9',
      surface: '#E2E4DE',
      text: '#221C16',
      'text-2': '#615B55',
      'text-3': '#726C66',
      border: '#D2CDC5',
      'border-quiet': '#DED8D1',
      accent: '#14666A',
      'tick-done': '#8D8780',
      'tick-future': '#E1DCD4',
      'tick-current': '#221C16',
      'wrong-border': '#DCCAC0',
      'wrong-text': '#965F4E',
    },
  },

  kontrast: {
    dark: {
      bg: '#000000',
      surface: '#0D1217',
      text: '#FFFFFF',
      'text-2': '#898989',
      'text-3': '#767676',
      border: '#2B2B2B',
      'border-quiet': '#1E1E1E',
      accent: '#8FC7FF',
      'tick-done': '#5D5D5D',
      'tick-future': '#1A1A1A',
      'tick-current': '#FFFFFF',
      'wrong-border': '#382825',
      'wrong-text': '#976B64',
    },
    light: {
      bg: '#FFFFFF',
      surface: '#E9EEFA',
      text: '#000000',
      'text-2': '#636363',
      'text-3': '#757575',
      border: '#D4D4D4',
      'border-quiet': '#E5E5E5',
      accent: '#0B44C4',
      'tick-done': '#919191',
      'tick-future': '#E6E6E6',
      'tick-current': '#000000',
      'wrong-border': '#E9D0CB',
      'wrong-text': '#B25D4B',
    },
  },
}

const META: Record<PresetId, { name: string; description: string }> = {
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

export const DEFAULT_PRESET: PresetId = 'atrament'
export const DEFAULT_MODE: Mode = 'dark'

/** Paleta dla danego presetu i rozstrzygniętego wariantu. */
export function paletteOf(preset: PresetId, variant: Variant): Palette {
  return PRESETS[preset][variant]
}

/** Odczyt pojedynczego tokenu — używane przez podgląd presetów i test kontrastu. */
export function tokenOf(preset: PresetId, variant: Variant, token: Token): string {
  return paletteOf(preset, variant)[token]
}
