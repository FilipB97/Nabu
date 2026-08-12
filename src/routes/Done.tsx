import { useLocation, useNavigate, useParams } from 'react-router'
import { adapterFor } from '@/langs'
import type { SessionSummary } from '@/session/useSession'
import { Mono } from '@/ui/Mono'

/**
 * Ekran końcowy — sekcja 8.4 planu. Liczba kart, trafienia za pierwszym razem, pudła,
 * co wraca jutro. Bez konfetti: mechaniki nacisku psują naukę u dorosłych.
 */
export function Done() {
  const { lang = '' } = useParams()
  const navigate = useNavigate()
  const summary = useLocation().state as SessionSummary | null
  const adapter = adapterFor(lang)

  const minutes = summary ? Math.max(1, Math.round((Date.now() - summary.startedAt) / 60000)) : 0

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center gap-8 bg-bg px-6">
      <Mono tone="accent">{adapter.name} · sesja zakończona</Mono>

      <div className="flex items-baseline gap-3">
        <span className="font-display text-[52px] leading-none text-text">
          {summary?.answered ?? 0}
        </span>
        <span className="font-ui text-[15px] text-text-2">kart · {minutes} min</span>
      </div>

      <dl className="flex flex-col gap-3 border-t border-border-quiet pt-6">
        {[
          ['Trafione za pierwszym razem', summary?.firstTry ?? 0],
          ['Pudła', summary?.missed ?? 0],
          ['Nowe słowa', summary?.fresh ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between">
            <dt className="font-ui text-[14px] text-text-2">{label}</dt>
            <dd className="font-display text-[18px] text-text">{value}</dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={() => navigate('/start')}
        className="min-h-[62px] border border-border text-[15px] text-text"
      >
        Wróć
      </button>

      <Mono>zapisano lokalnie</Mono>
    </div>
  )
}
