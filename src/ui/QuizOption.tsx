import type { LangAdapter } from '@/langs'
import { fontClassFor } from './script'

/**
 * Opcja quizu — sekcja 7 i 8.4 planu.
 *
 * Cztery stany, rozróżnialne nie tylko kolorem: trafiona niesie `✓`, wybrana błędnie
 * `×`, wygaszone tracą kontrast. Kolor jest trzecim sygnałem, nie jedynym — te elementy
 * dotyka się setki razy, często bez patrzenia (sekcja 9, ograniczenia).
 *
 * Opcja jest kartą: ma wypełnienie, zaokrąglenie i cień, więc czyta się jako rzecz
 * do dotknięcia, zanim użytkownik zdąży przeczytać jej treść. Poprawna po odpowiedzi
 * unosi się o warstwę wyżej — to samo, co dzieje się z arkuszem nad treścią.
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
  idle: 'nabu-card text-text',
  correct: 'nabu-card nabu-card-raised text-accent',
  'chosen-wrong': 'nabu-card border-wrong-border text-wrong-text',
  dimmed: 'nabu-card text-text-3 opacity-70 shadow-none',
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
  /** Pismo prawostronne — dotyczy wyłącznie słowa docelowego, nie glosy ani numeru. */
  rtl?: boolean
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
  rtl = false,
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
      className={`nabu-press flex min-h-[68px] w-full items-center justify-between gap-3 px-5
        text-start transition-colors duration-150 select-none
        ${answered ? 'cursor-default' : 'cursor-pointer'} ${STATE_CLASSES[state]}`}
    >
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-[10px] gap-y-1">
        <span
          dir={rtl ? 'rtl' : undefined}
          className={`${fontClassFor(font)} text-[25px] leading-[1.3]`}
        >
          {term}
        </span>
        <span
          className={`font-ui text-[13px] leading-tight transition-opacity duration-200
            ${answered ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden={!answered}
        >
          {gloss}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {mark && <span className="font-mono text-[16px] leading-none">{mark}</span>}
        {shortcut !== undefined && !answered && (
          <span
            className="font-mono flex h-6 w-6 items-center justify-center rounded-full
              bg-bg text-[11px] leading-none text-text-3"
            aria-hidden
          >
            {shortcut}
          </span>
        )}
      </span>
    </button>
  )
}
