import { Mono } from './Mono'

/**
 * Pasek etapu — ile pozycji bieżącego etapu jest już utrwalonych.
 *
 * Wypełnienie jest gradientem od ciemniejszego krańca akcentu do jaśniejszego: ten sam
 * kierunek co wszystkie paski w aplikacji, przeciwny do przycisku głównego. Dzięki temu
 * pasek i przycisk nie wyglądają jak ten sam element w dwóch rozmiarach.
 *
 * Przy ostatnim etapie licznika nie ma: zdania są niewyczerpalne, więc „92 / 100" byłoby
 * obietnicą końca, którego nie ma.
 */
export function StageBar({
  solid,
  needed,
  hint,
  done,
}: {
  solid: number
  needed: number
  hint: string
  done: boolean
}) {
  const filled = needed > 0 ? Math.min(1, solid / needed) : 1

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-tick-future">
        <div
          className="h-full rounded-full bg-linear-to-r from-accent-deep to-accent
            transition-[width] duration-500 ease-out"
          style={{ width: `${(done ? 1 : filled) * 100}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-ui text-[13px] leading-[1.5] text-text-2">{hint}</p>
        {!done && (
          <Mono className="shrink-0">
            {solid} / {needed} opanowanych
          </Mono>
        )}
      </div>
    </div>
  )
}
