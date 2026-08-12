import { useCallback, useMemo, useState } from 'react'
import type { LangAdapter } from '@/langs'
import type { Production } from './produce.ts'
import { Button } from '@/ui/Button'
import { Keyboard } from '@/ui/Keyboard'
import { Mono } from '@/ui/Mono'

/**
 * Karta produkcji — sekcja 7.2 i 7.3 planu.
 *
 * Trzy tryby, jedna mechanika: pokazujemy, CO ma powstać, a użytkownik odtwarza zapis.
 * Różnica siedzi w sposobie wprowadzania — klawiatura systemowa dla pism łacińskich,
 * klawiatura w aplikacji dla kany i hangulu.
 *
 * Podpowiedź odsłania kolejną literę i kosztuje: jedna schodzi na „Trudne", druga na
 * „Nie pamiętam" (sekcja 6.4). Dlatego jest jedna, wyraźna i licząca — a nie ukryta
 * pomoc, po której użytkownik nie wie, ile go kosztowała.
 */

type ProduceCardProps = {
  production: Production
  adapter: LangAdapter
  fontClass: string
  onAnswer: (given: string, hints: number) => void
}

export function ProduceCard({ production, adapter, fontClass, onAnswer }: ProduceCardProps) {
  const [typed, setTyped] = useState('')
  const [keys, setKeys] = useState<string[]>([])
  const [hints, setHints] = useState(0)

  const keyboard = production.mode === 'type' ? null : adapter.keyboard
  const given = useMemo(
    () => (keyboard ? keyboard.compose(keys) : typed),
    [keyboard, keys, typed],
  )

  const hint = useCallback(() => {
    setHints((count) => count + 1)
  }, [])

  const revealed = [...production.expected].slice(0, hints).join('')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3">
        <Mono tone="normal">
          {production.mode === 'kana' ? 'zapisz czytanie' : 'zapisz to słowo'}
        </Mono>
        <p className={`${production.mode === 'kana' ? fontClass : 'font-ui'} text-center text-[34px] leading-[1.25] text-text`}>
          {production.prompt}
        </p>
        {production.context && (
          <p className="font-ui text-center text-[13px] leading-[1.5] text-text-3">
            {production.context}
          </p>
        )}
      </div>

      {/* Pole odpowiedzi. Przy klawiaturze w aplikacji jest to tylko podgląd — pisanie
          idzie przez klawisze niżej, bo systemowy IME podałby listę kandydatów. */}
      {keyboard ? (
        <div
          className={`nabu-card ${fontClass} flex min-h-[64px] items-center justify-center
            px-4 text-[28px] text-text`}
          aria-live="polite"
        >
          {given || <span className="text-text-3">…</span>}
        </div>
      ) : (
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && given.length > 0) onAnswer(given, hints)
          }}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Wpisz słowo"
          className={`nabu-card ${fontClass} min-h-[64px] w-full px-4 text-center text-[26px]
            text-text outline-none`}
        />
      )}

      {hints > 0 && (
        <p className="font-mono text-center text-[13px] text-text-2">
          zaczyna się od <span className={fontClass}>{revealed}</span>
        </p>
      )}

      {keyboard && (
        <Keyboard
          rows={keyboard.rows}
          font={adapter.display.font}
          onKey={(key) => setKeys((current) => [...current, key])}
          onBackspace={() => setKeys((current) => current.slice(0, -1))}
        />
      )}

      <div className="flex gap-[10px]">
        <Button
          onClick={hint}
          disabled={hints >= [...production.expected].length}
          className="shrink-0"
        >
          podpowiedz
        </Button>
        <Button
          variant="primary"
          full
          disabled={given.length === 0}
          onClick={() => onAnswer(given, hints)}
        >
          Sprawdź
        </Button>
      </div>
    </div>
  )
}
