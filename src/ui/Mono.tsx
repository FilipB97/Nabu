import type { ReactNode } from 'react'

/**
 * Etykieta w kroju maszynowym — powtarzający się element interfejsu: nagłówek karty,
 * przewidywany interwał, podpis pod paskiem, nazwa stanu brzegowego.
 *
 * Wersaliki i rozstrzelenie robią tu hierarchię razem z kolorem, a nie samym kolorem.
 * To nie jest ozdoba: przy trzech poziomach tekstu na bardzo ciemnym tle każdy z nich
 * musi przejść AA, więc różnice jasności są mniejsze, niż wyglądają w makiecie
 * (docs/ADR-002-motywy.md).
 */

type MonoProps = {
  children: ReactNode
  /** `quiet` to najcichszy poziom tekstu, `normal` — pomocniczy. */
  tone?: 'quiet' | 'normal' | 'accent' | 'wrong'
  className?: string
}

const TONE: Record<NonNullable<MonoProps['tone']>, string> = {
  quiet: 'text-text-3',
  normal: 'text-text-2',
  accent: 'text-accent',
  // Werdykt „źle" i akcje nieodwracalne. To nie jest czerwień — w całej aplikacji nie ma
  // czerwieni (sekcja 9) — tylko ciepły odcień odróżniający się od reszty tekstu.
  wrong: 'text-wrong-text',
}

export function Mono({ children, tone = 'quiet', className }: MonoProps) {
  return (
    <span
      className={`font-mono text-[10.5px] leading-none tracking-[0.12em] uppercase
        ${TONE[tone]} ${className ?? ''}`}
    >
      {children}
    </span>
  )
}
