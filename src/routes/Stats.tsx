import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { adapterFor } from '@/langs'
import { buildConfusions } from '@/session/options'
import { isMature } from '@/srs/sm2'
import { loadLexicon, loadStage, type Lexicon } from '@/store/decks'
import { db } from '@/store/db'
import { Bars } from '@/ui/Ticks'
import { Mono } from '@/ui/Mono'

/**
 * Statystyki — sekcja 8.6 planu, M9.
 *
 * Trzy liczby i dwa rysunki, wszystkie odpowiadające na pytania, które użytkownik
 * faktycznie zadaje: ile już umiem, kiedy to wróci, co mi się myli.
 *
 * **Nie ma tu passy ani serii dni.** Sekcja 1 planu odrzuca je świadomie: mechaniki
 * nacisku działają na dzieciach i psują naukę dorosłym, bo zamieniają cel „umieć"
 * na cel „nie przerwać". Jeden opuszczony dzień nie może być porażką.
 *
 * **Mylone PARY, nie mylone słowa.** To jest jedyna rzecz, której samoocena nie potrafi
 * powiedzieć, a quiz tak: nie „nie znasz 氷", tylko „mylisz 氷 z 水". Bez pola `chosen`
 * w logu (sekcja 5.3) tego ekranu nie dałoby się zrobić wstecz.
 */

const FORECAST_DAYS = 14

/** Ile par pokazujemy. Więcej niż pięć to lista do przeglądania, a nie wniosek. */
const TOP_PAIRS = 5

type Summary = {
  cards: number
  mature: number
  learning: number
  forecast: number[]
  pairs: { correct: string; chosen: string; count: number }[]
}

export function Stats() {
  const { lang = '' } = useParams()
  const adapter = adapterFor(lang)
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let cancelled = false

    async function build() {
      const cards = await db.cards.where('lang').equals(lang).toArray()
      const log = await db.log.where('lang').equals(lang).reverse().limit(1000).toArray()

      // Prognoza liczona z terminów kart, nie z logu: log mówi, co było, a użytkownik
      // pyta, co będzie.
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const forecast = Array.from({ length: FORECAST_DAYS }, () => 0)
      for (const card of cards) {
        if (card.suspended) continue
        const days = Math.floor(
          (new Date(card.due).getTime() - startOfDay.getTime()) / 86_400_000,
        )
        const at = Math.max(0, days)
        if (at < FORECAST_DAYS) forecast[at] = (forecast[at] ?? 0) + 1
      }

      // Mylone pary wymagają lematu karty i słownika, żeby pokazać SŁOWA, a nie
      // identyfikatory. Karty etapów mają własne słowniki, więc scalamy je z leksykonem
      // zdań — identyfikatory są rozłączne.
      const lemmaOf = new Map(cards.map((card) => [card.id, card.lemma]))
      const confusions = buildConfusions([...log].reverse(), (id) => lemmaOf.get(id))

      let lexicon: Lexicon = await loadLexicon(lang)
      for (const stage of ['script', 'core'] as const) {
        if (!cards.some((card) => card.stage === stage)) continue
        try {
          lexicon = { ...lexicon, ...(await loadStage(lang, stage)).lexicon }
        } catch {
          // Brak pliku etapu nie może wywrócić statystyk.
        }
      }

      const pairs = [...confusions.entries()]
        .flatMap(([correct, chosenMap]) =>
          [...chosenMap.entries()].map(([chosen, count]) => ({
            correct: lexicon[correct]?.s ?? correct,
            chosen: lexicon[chosen]?.s ?? chosen,
            count,
          })),
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_PAIRS)

      if (cancelled) return
      setSummary({
        cards: cards.length,
        mature: cards.filter(isMature).length,
        learning: cards.filter((card) => card.interval === 0 && card.reps > 0).length,
        forecast,
        pairs,
      })
    }

    void build()
    return () => {
      cancelled = true
    }
  }, [lang])

  if (!summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Mono tone="normal">liczę…</Mono>
      </div>
    )
  }

  const fontClass = { ui: 'font-ui', display: 'font-display', ja: 'font-ja', ko: 'font-ko' }[
    adapter.display.font
  ]

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col gap-8 bg-bg px-6
        pt-[calc(env(safe-area-inset-top)+28px)] pb-[calc(env(safe-area-inset-bottom)+32px)]"
    >
      <div className="flex items-center justify-between gap-3">
        <Link to="/start" className="nabu-press -m-3 rounded-full p-3">
          <Mono tone="normal">← wróć</Mono>
        </Link>
        <Mono>{adapter.name} · postęp</Mono>
      </div>

      <div className="nabu-card flex flex-col gap-5 px-6 py-7">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[56px] leading-none text-text">{summary.mature}</span>
          <span className="font-ui text-[14px] text-text-2">słów utrwalonych</span>
        </div>
        <dl className="flex flex-col gap-3">
          {[
            ['Wprowadzone', summary.cards],
            ['W trakcie nauki', summary.learning],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between gap-4">
              <dt className="font-ui text-[14px] text-text-2">{label}</dt>
              <dd className="font-display text-[18px] text-text">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <Mono>powtórki przez dwa tygodnie</Mono>
        <Bars values={summary.forecast} label="prognoza powtórek na czternaście dni" />
        <p className="font-ui text-[12.5px] leading-[1.5] text-text-3">
          Pierwszy słupek to dziś. Wysoki słupek za tydzień znaczy tylko tyle, że wtedy
          wypada dużo powtórek — nie trzeba nic z tym robić.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Mono>najczęściej mylone pary</Mono>
        {summary.pairs.length === 0 ? (
          <p className="font-ui text-[13px] leading-[1.5] text-text-2">
            Jeszcze nic się nie powtórzyło. Pary zbierają się z odpowiedzi, więc pojawią się
            po kilku sesjach.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {summary.pairs.map((pair) => (
              <li
                key={`${pair.correct}-${pair.chosen}`}
                className="nabu-card flex items-center justify-between gap-4 px-5 py-4"
              >
                <span className={`${fontClass} text-[20px] text-text`}>
                  {pair.correct} <span className="text-text-3">→</span> {pair.chosen}
                </span>
                <span className="font-mono text-[13px] text-text-2">{pair.count} ×</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
