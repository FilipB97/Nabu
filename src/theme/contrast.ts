/**
 * Kontrast wg WCAG 2.2 — relatywna luminancja i proporcja.
 *
 * Czysta arytmetyka, bez zależności, żeby dało się to uruchomić w teście, w skrypcie
 * budującym i w podglądzie presetów. Wzory: WCAG 2.2, definicje „relative luminance"
 * i „contrast ratio".
 */

export type Rgb = { r: number; g: number; b: number }

/** Rozkłada `#rgb` albo `#rrggbb` na składowe 0–255. Rzuca przy złym formacie. */
export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`Nie jest kolorem heksowym: ${JSON.stringify(hex)}`)

  const raw = m[1]!
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/** Linearyzacja pojedynczej składowej sRGB. */
function linearize(channel8bit: number): number {
  const c = channel8bit / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relatywna luminancja, 0 (czerń) do 1 (biel). */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/** Proporcja kontrastu dwóch kolorów, od 1:1 do 21:1. Kolejność argumentów bez znaczenia. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Zaokrąglenie do dwóch miejsc, do raportów i komunikatów testu. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
