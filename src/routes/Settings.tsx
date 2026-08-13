import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { adapterFor } from '@/langs'
import { useLangs } from '@/app/lang'
import { gatedStages, stageLabel } from '@/session/stages'
import { MODES, PRESETS, PRESETS_IDS, useTheme } from '@/theme/ThemeProvider'
import { paletteOf, type Mode } from '@/theme/presets'
import { clearLanguage, downloadBackup } from '@/store/backup'
import { isDownloaded } from '@/store/decks'
import { INTENSITY, updateSettings, type LangSettings } from '@/store/db'
import { Choice } from '@/ui/Choice'
import { Group, Row } from '@/ui/List'
import { Mono } from '@/ui/Mono'

/**
 * Ustawienia — sekcja 8.5 planu, po redesignie.
 *
 * Jeden ekran, cztery grupy: wygląd, nauka, dźwięk, dane. Wcześniej ustawienia były
 * rozdzielone między ekran startu (wszystko, co per język) i `/ustawienia` (motyw),
 * bo ekran startu jako jedyny wiedział, który język jest wybrany. Po wprowadzeniu
 * globalnego wyboru języka ten powód zniknął — a ustawienie, którego szuka się w dwóch
 * miejscach, jest ustawieniem, którego się nie znajduje.
 *
 * Nad grupami dotyczącymi języka piszemy, którego języka dotyczą. Zmiana języka jest
 * w szynie (desktop) albo na ekranie głównym (telefon), bo tam się o niej myśli.
 *
 * Preset pokazujemy JEGO WŁASNYMI kolorami, nie nazwą. Nazwa („Mech", „Piasek") nie mówi
 * nic, dopóki nie zobaczy się rampy — a rampa jest całą treścią wyboru.
 */

const MODE_LABEL: Record<Mode, string> = {
  dark: 'ciemny',
  light: 'jasny',
  system: 'systemowy',
}

/**
 * Wiersz z kontrolką. Na szerokim ekranie kontrolka stoi po prawej, jak w liście iOS;
 * na telefonie schodzi pod etykietę, bo segment z czterema opcjami ściśnięty do połowy
 * szerokości przestaje być czytelny, a etykiety opcji zaczynają się łamać.
 */
function ControlRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[52px] flex-col justify-center gap-2 py-3 md:flex-row md:items-center md:gap-6">
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="font-ui text-[15px] text-text">{label}</span>
        {description && (
          <span className="font-ui text-[12.5px] leading-[1.45] text-text-3">{description}</span>
        )}
      </span>
      <span className="w-full md:w-[320px] md:shrink-0">{children}</span>
    </div>
  )
}

export function Settings() {
  const navigate = useNavigate()
  const { preset, mode, variant, setPreset, setMode } = useTheme()
  const { current, rows, select, refresh } = useLangs()
  /** Ile talii siedzi już w pamięci podręcznej i ile miejsca zajmują dane witryny. */
  const [decks, setDecks] = useState<{ count: number; megabytes: number } | null>(null)
  /** Kasowanie jest nieodwracalne, więc pyta o potwierdzenie — wierszem, nie oknem. */
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!rows) return
    let cancelled = false
    void Promise.all(rows.map((row) => isDownloaded(row.settings.lang))).then(async (flags) => {
      const estimate = await navigator.storage?.estimate?.().catch(() => null)
      if (cancelled) return
      setDecks({
        count: flags.filter(Boolean).length,
        megabytes: Math.round(((estimate?.usage ?? 0) / 1_048_576) * 10) / 10,
      })
    })
    return () => {
      cancelled = true
    }
  }, [rows])

  const change = (patch: Partial<Omit<LangSettings, 'lang'>>) => {
    if (!current) return
    void updateSettings(current.settings.lang, patch).then(refresh)
  }

  const adapter = current ? adapterFor(current.settings.lang) : null

  return (
    <div className="flex flex-col gap-7 pb-4">
      <h1 className="font-display text-[clamp(28px,5vw,38px)] leading-none text-text">
        Ustawienia
      </h1>

      {/*
        Języki są w ustawieniach, mimo że przełącznik jest też na ekranie głównym.
        Powód jest prosty: „gdzie się dodaje kolejny język" to pytanie, z którym idzie się
        do ustawień, i odpowiedź musi tam być — nawet jeśli szybsza droga jest gdzie indziej.
      */}
      <Group
        label="języki"
        hint="Dwa aktywne naraz to rozsądny sufit. Język utrzymywany nie dostaje nowych pozycji,
          więc kosztuje kilka minut dziennie zamiast kilkunastu."
      >
        {(rows ?? []).map((row) => {
          const chosen = row.settings.lang === current?.settings.lang
          return (
            <Row
              key={row.settings.lang}
              onClick={() => select(row.settings.lang)}
              chevron={false}
              label={
                <span className={chosen ? 'text-accent' : undefined}>
                  {adapterFor(row.settings.lang).name}
                </span>
              }
              description={row.settings.active ? 'aktywny' : 'utrzymywany'}
              value={<Mono tone={chosen ? 'accent' : 'quiet'}>{row.due} do powtórki</Mono>}
            />
          )
        })}
        <Row label="Dodaj język" description="Nowa talia, poziom wejściowy i kalibracja." to="/dodaj" />
      </Group>

      <Group
        label="wygląd"
        hint="Motyw przechodzi w CI test kontrastu WCAG AA — w obu wariantach, na każdej parze
          tekstu i tła. Motyw, który łamie kontrast, nie wchodzi do aplikacji."
      >
        <ControlRow label="Tryb" description="Systemowy idzie za ustawieniem telefonu.">
          <Choice
            label="tryb"
            value={mode}
            options={MODES.map((id) => ({ value: id, label: MODE_LABEL[id] }))}
            onChange={setMode}
          />
        </ControlRow>

        {PRESETS_IDS.map((id) => {
          // Próbkę rysujemy w wariancie AKTUALNIE widocznym — inaczej użytkownik
          // w trybie jasnym wybierałby spośród ciemnych rampek.
          const palette = paletteOf(id, variant)
          const selected = id === preset
          return (
            <Row
              key={id}
              onClick={() => setPreset(id)}
              chevron={false}
              label={
                <span className={selected ? 'text-accent' : undefined}>{PRESETS[id].name}</span>
              }
              description={PRESETS[id].description}
              value={
                <span className="flex shrink-0 gap-1" aria-hidden>
                  {(['bg', 'surface-2', 'text-2', 'accent'] as const).map((token) => (
                    <span
                      key={token}
                      className="h-7 w-[18px] rounded-[5px]"
                      // Jedyne miejsce w aplikacji z kolorem w atrybucie `style`: próbka MUSI
                      // pokazywać paletę, której użytkownik jeszcze nie wybrał, więc nie może
                      // brać koloru z aktywnych zmiennych CSS.
                      style={{ background: palette[token] }}
                    />
                  ))}
                </span>
              }
            />
          )
        })}

        <Row label="Podgląd karty" description="Trzy stany karty w wybranym motywie." to="/demo" />
      </Group>

      {current && adapter && (
        <>
          <Group
            label={`nauka · ${adapter.name}`}
            hint="Te ustawienia dotyczą tylko wybranego języka. Język zmienia się na ekranie
              głównym."
          >
            <ControlRow
              label="Długość sesji"
              description={`${INTENSITY[current.settings.intensity].due} kart do powtórki
                i ${INTENSITY[current.settings.intensity].fresh} nowych`}
            >
              <Choice
                value={current.settings.intensity}
                options={[
                  { value: 'short' as const, label: 'krótka' },
                  { value: 'normal' as const, label: 'normalna' },
                  { value: 'long' as const, label: 'długa' },
                ]}
                onChange={(intensity) => change({ intensity })}
              />
            </ControlRow>

            <ControlRow
              label="Opcji w quizie"
              description="Więcej opcji to trudniejszy wybór i mniejsza szansa trafienia na oślep."
            >
              <Choice
                value={current.settings.quizOptions}
                options={[
                  { value: 3, label: '3' },
                  { value: 4, label: '4' },
                  { value: 6, label: '6' },
                ]}
                onChange={(quizOptions) => change({ quizOptions })}
              />
            </ControlRow>

            <ControlRow
              label="Po trafieniu"
              description="Pudło zawsze czeka na dotknięcie — to przy nim jest najwięcej do przeczytania."
            >
              <Choice
                value={current.settings.autoAdvance}
                options={[
                  { value: false, label: 'czekaj' },
                  { value: true, label: 'dalej sam' },
                ]}
                onChange={(autoAdvance) => change({ autoAdvance })}
              />
            </ControlRow>

            <ControlRow
              label="Produkcja"
              description="Odtworzenie słowa z pamięci zamiast wyboru z listy, na kartach dojrzałych."
            >
              <Choice
                value={current.settings.production}
                options={[
                  { value: 'off' as const, label: 'wyłączona' },
                  { value: 'mature' as const, label: 'od dojrzałych' },
                  { value: 'always' as const, label: 'zawsze' },
                ]}
                onChange={(production) => change({ production })}
              />
            </ControlRow>

            <ControlRow
              label="Etap"
              description="Domyślnie etap zmienia się sam, gdy poprzedni jest opanowany."
            >
              <Choice
                value={current.settings.stageOverride ?? 'auto'}
                options={[
                  { value: 'auto' as const, label: 'po kolei' },
                  ...gatedStages(adapter).map((stage) => ({
                    value: stage,
                    label: stageLabel(adapter, stage),
                  })),
                ]}
                onChange={(value) => change({ stageOverride: value === 'auto' ? null : value })}
              />
            </ControlRow>

            {adapter.needsReading && (
              <ControlRow
                label="Czytania nad wyrazami"
                description="Widoczne od razu są podpowiedzią przy karcie ze słuchu i przy luce."
              >
                <Choice
                  value={current.settings.furigana}
                  options={[
                    { value: 'always' as const, label: 'zawsze' },
                    { value: 'after' as const, label: 'po odpowiedzi' },
                    { value: 'never' as const, label: 'nigdy' },
                  ]}
                  onChange={(furigana) => change({ furigana })}
                />
              </ControlRow>
            )}

            <ControlRow
              label="Tryb języka"
              description="Utrzymywany nie dostaje nowych pozycji, tylko zaległe powtórki."
            >
              <Choice
                value={current.settings.active}
                options={[
                  { value: true, label: 'aktywny' },
                  { value: false, label: 'utrzymywany' },
                ]}
                onChange={(active) => change({ active })}
              />
            </ControlRow>
          </Group>

          <Group
            label="dźwięk"
            hint="Mowa pochodzi z syntezatora systemowego. Jeśli w systemie nie ma głosu dla
              tego języka, karty ze słuchu są pomijane."
          >
            <ControlRow label="Tempo mowy">
              <Choice
                value={current.settings.rate}
                options={[
                  { value: 0.45, label: 'wolno' },
                  { value: 0.6, label: 'normalnie' },
                  { value: 0.85, label: 'szybko' },
                ]}
                onChange={(rate) => change({ rate })}
              />
            </ControlRow>
            <Row label="Test dźwięku" description="Sprawdza syntezator na tym urządzeniu." to="/audio" />
          </Group>
        </>
      )}

      <Group
        label="dane"
        hint="Wszystko jest zapisane na tym urządzeniu i nigdzie nie wychodzi. Safari kasuje
          dane witryn nieodwiedzanych przez tydzień, więc kopia co jakiś czas ma sens."
      >
        <Row
          label="Eksport postępu"
          description="Plik JSON z kartami, historią odpowiedzi i ustawieniami."
          chevron={false}
          onClick={() => void downloadBackup()}
        />
        <Row
          label="Pobrane talie"
          description="Materiał zostaje na urządzeniu po pierwszym pobraniu."
          value={
            <Mono tone="normal">
              {decks ? `${decks.count} · ${decks.megabytes} MB` : '…'}
            </Mono>
          }
        />
        {current && (
          <Row
            chevron={false}
            label={
              <span className="text-wrong-text">
                {confirming ? 'Na pewno? Dotknij ponownie' : `Wyczyść dane · ${adapter?.name}`}
              </span>
            }
            description={
              confirming
                ? 'Karty, historia i ustawienia tego języka zostaną skasowane. Talia zostaje.'
                : 'Kasuje postęp w tym języku. Nie da się cofnąć.'
            }
            onClick={() => {
              if (!confirming) {
                setConfirming(true)
                return
              }
              void clearLanguage(current.settings.lang)
                .then(refresh)
                .then(() => {
                  setConfirming(false)
                  navigate('/start')
                })
            }}
          />
        )}
      </Group>
    </div>
  )
}
