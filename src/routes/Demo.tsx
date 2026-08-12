import { es, ja, ko } from '@/langs'
import { QuizCard, type QuizContent } from '@/session/QuizCard'
import { Mono } from '@/ui/Mono'
import { Mark } from '@/ui/Ticks'
import { MODES, PRESETS, PRESETS_IDS, useTheme } from '@/theme/ThemeProvider'

/**
 * Demo M0 — sekcja „Trzy rzeczy, które M0 ma udowodnić".
 *
 * Karta z makiety odtworzona na żywych tokenach, w trzech systemach pisma. Sens tego
 * ekranu jest jeden: jeśli któryś preset psuje kartę, to kontrakt tokenów jest za wąski
 * i poprawiamy go teraz, a nie w M9, kiedy będzie stał na nim cały interfejs.
 *
 * Treść pochodzi wprost z makiety, żeby dało się postawić oba ekrany obok siebie.
 */

const CARD_JA: QuizContent = {
  adapter: ja,
  kind: `${ja.name} · cloze`,
  before: '',
  after: 'をください。',
  answer: '水',
  reading: 'みず',
  pl: 'Poproszę wodę.',
  gloss: 'woda',
  band: 412,
  gapWidth: '2em',
  correct: 0,
  options: [
    { term: '水', gloss: 'woda' },
    { term: '氷', gloss: 'lód' },
    { term: '湯', gloss: 'wrzątek' },
    { term: '米', gloss: 'ryż' },
  ],
}

const CARD_ES: QuizContent = {
  adapter: es,
  kind: `${es.name} · cloze`,
  before: 'Necesito un poco de ',
  after: ' ahora.',
  answer: 'agua',
  pl: 'Potrzebuję teraz trochę wody.',
  gloss: 'woda',
  band: 118,
  gapWidth: '3.4em',
  correct: 2,
  options: [
    { term: 'leche', gloss: 'mleko' },
    { term: 'tiempo', gloss: 'czas' },
    { term: 'agua', gloss: 'woda' },
    { term: 'pan', gloss: 'chleb' },
  ],
}

const CARD_KO: QuizContent = {
  adapter: ko,
  kind: `${ko.name} · cloze`,
  before: '',
  after: ' 좀 주세요.',
  answer: '물',
  reading: 'mul',
  pl: 'Poproszę wodę.',
  gloss: 'woda',
  band: 305,
  gapWidth: '2.4em',
  correct: 3,
  options: [
    { term: '불', gloss: 'ogień' },
    { term: '밀', gloss: 'pszenica' },
    { term: '말', gloss: 'słowo' },
    { term: '물', gloss: 'woda' },
  ],
}

const MODE_LABELS: Record<(typeof MODES)[number], string> = {
  dark: 'ciemny',
  light: 'jasny',
  system: 'systemowy',
}

function BrandMark() {
  return (
    <div className="flex items-center gap-4">
      <Mark />
      <span className="font-display text-[40px] leading-none font-light tracking-[0.02em] text-text">
        Nabu
      </span>
      <span className="border-s border-border-quiet ps-[10px]">
        <Mono tone="normal">demo M0 · tokeny i presety</Mono>
      </span>
    </div>
  )
}

function ThemePicker() {
  const { preset, mode, variant, setPreset, setMode } = useTheme()

  return (
    <div className="flex flex-col gap-5 border border-border p-8">
      <Mono tone="accent">motyw</Mono>

      <div className="flex flex-wrap gap-2">
        {PRESETS_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPreset(id)}
            aria-pressed={preset === id}
            className={`flex flex-col gap-2 border px-4 py-3 text-start
              ${preset === id ? 'border-accent text-accent' : 'border-border-quiet text-text-2'}`}
          >
            <span className="font-ui text-[13px]">{PRESETS[id].name}</span>
            <span className="flex gap-1">
              {(['bg', 'accent', 'text-2', 'border'] as const).map((token) => (
                <span
                  key={token}
                  className="h-3 w-3 border border-border-quiet"
                  style={{ background: PRESETS[id][variant][token] }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            aria-pressed={mode === option}
            className={`font-ui border-b pb-1 text-[13px]
              ${mode === option ? 'border-accent text-accent' : 'border-transparent text-text-2'}`}
          >
            {MODE_LABELS[option]}
          </button>
        ))}
      </div>

      <p className="font-ui max-w-prose text-[13px] leading-[1.6] text-text-2">
        Każdy preset przechodzi test kontrastu AA w CI. Dwa tokeny z makiety musiały zostać
        podniesione, żeby to było prawdą — powód opisuje{' '}
        <span className="font-mono text-text-3">docs/ADR-002-motywy.md</span>.
      </p>
    </div>
  )
}

function Phone({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="m-0 flex flex-none flex-col gap-[10px]">
      <div className="h-[844px] w-[390px] overflow-hidden rounded-[34px] border border-border-quiet">
        {children}
      </div>
      <figcaption>
        <Mono tone="normal">{caption}</Mono>
      </figcaption>
    </figure>
  )
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="font-display text-[22px] leading-[1.2] text-text">{title}</h2>
        <span className="font-ui text-[12px] text-text-2">{note}</span>
      </div>
      <div className="flex flex-wrap items-start gap-7">{children}</div>
    </section>
  )
}

export function Demo() {
  return (
    <div className="flex min-h-screen flex-col gap-14 bg-bg px-8 py-14 text-text lg:px-16">
      <BrandMark />
      <ThemePicker />

      <Section title="Trzy stany karty" note="390 × 844 · treść z makiety">
        <Phone caption="przed wyborem">
          <QuizCard content={CARD_JA} progress={{ total: 33, done: 11, lapses: [4, 9] }} />
        </Phone>
        <Phone caption="trafienie">
          <QuizCard
            content={CARD_JA}
            progress={{ total: 33, done: 11, lapses: [4, 9] }}
            initialPick={0}
          />
        </Phone>
        <Phone caption="pudło · czeka na dotknięcie">
          <QuizCard
            content={CARD_JA}
            progress={{ total: 33, done: 11, lapses: [4, 9, 11] }}
            initialPick={1}
          />
        </Phone>
      </Section>

      <Section
        title="Trzy systemy pisma"
        note="ten sam układ, inny adapter — klawisze 1–4 działają na pierwszej karcie"
      >
        <Phone caption={`${ja.name} · klikalne`}>
          <QuizCard content={CARD_JA} progress={{ total: 12, done: 3 }} keyboard />
        </Phone>
        <Phone caption={es.name}>
          <QuizCard content={CARD_ES} progress={{ total: 12, done: 3 }} />
        </Phone>
        <Phone caption={ko.name}>
          <QuizCard content={CARD_KO} progress={{ total: 12, done: 3 }} />
        </Phone>
      </Section>
    </div>
  )
}
