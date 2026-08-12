import type { LangAdapter } from '@/langs'

/**
 * Opcja quizu — sekcja 7 i 8.4 planu.
 *
 * Cztery stany, rozróżnialne nie tylko kolorem: trafiona niesie `✓`, wybrana błędnie
 * `×`, wygaszone tracą kontrast. Kolor jest trzecim sygnałem, nie jedynym — te elementy
 * dotyka się setki razy, często bez patrzenia (sekcja 9, ograniczenia).
 *
 * Tłumaczenie przy opcji jest ukryte do momentu wyboru. Widoczne od razu zamieniłoby
 * kartę w test czytania po polsku.
 */

export type OptionState =
  | 'idle' // przed odpowiedzią
  | 'correct' // poprawna, po odpowiedzi — niezależnie od tego, czy trafiona
  | 'chosen-wrong' // wybrana przez użytkownika i błędna
  | 'dimmed' // pozostałe, po odpowiedzi

const STATE_CLASSES: Record<OptionState, string> = {
  idle: 'border-border text-text',
  correct: 'border-accent bg-surface text-accent',
  'chosen-wrong': 'border-wrong-border text-wrong-text',
  dimmed: 'border-border-quiet text-text-3',
}

const FONT_CLASS: Record<LangAdapter['display']['font'], string> = {
  ui: 'font-ui',
  display: 'font-display',
  ja: 'font-ja',
  ko: 'font-ko',
}

type QuizOptionProps = {
  /** Słowo w piśmie docelowym. */
  term: string
  /** Glosa polska — ujawniana dopiero po odpowiedzi. */
  gloss: string
  state: OptionState
  /** Czy to jest opcja, którą wybrał użytkownik. Steruje znakiem `✓`. */
  chosen?: boolean
  font: LangAdapter['display']['font']
  /** Numer na klawiaturze, 1–6. Na desktopie to podstawowy sposób wyboru (sekcja 8.4). */
  shortcut?: number
  onSelect?: () => void
}

export function QuizOption({
  term,
  gloss,
  state,
  chosen = false,
  font,
  shortcut,
  onSelect,
}: QuizOptionProps) {
  const answered = state !== 'idle'
  const mark = state === 'correct' && chosen ? '✓' : state === 'chosen-wrong' ? '×' : ''

  return (
    // `aria-disabled`, a nie `disabled`: wyłączony przycisk wypada z drzewa dostępności
    // i traci fokus, a po odpowiedzi to właśnie opcje niosą treść do nauczenia się —
    // ujawnione glosy i informację, czym wybrane słowo różniło się od poprawnego.
    // Użytkownik czytnika ekranu musi móc je przejrzeć, tylko nie może już kliknąć.
    <button
      type="button"
      aria-disabled={answered}
      onClick={answered ? undefined : onSelect}
      aria-label={answered ? `${term} — ${gloss}` : term}
      className={`flex min-h-[62px] w-full items-center justify-between gap-3 border px-[18px] text-start
        select-none ${answered ? 'cursor-default' : 'cursor-pointer'} ${STATE_CLASSES[state]}`}
    >
      <span className="flex items-baseline gap-[10px]">
        <span className={`${FONT_CLASS[font]} text-[24px] leading-[1.35]`}>{term}</span>
        <span
          className={`font-ui text-[12.5px] leading-none transition-opacity duration-150
            ${answered ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden={!answered}
        >
          {gloss}
        </span>
      </span>

      <span className="flex items-center gap-3">
        {mark && <span className="font-mono text-[15px] leading-none">{mark}</span>}
        {shortcut !== undefined && !answered && (
          <span className="font-mono text-[11px] leading-none text-text-3" aria-hidden>
            {shortcut}
          </span>
        )}
      </span>
    </button>
  )
}
