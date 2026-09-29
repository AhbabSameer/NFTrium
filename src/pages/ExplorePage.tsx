import { useRef } from 'react'
import { useSearchParams } from 'react-router'
import { TokenGrid } from '@/components/TokenCard'
import { tokenStatus } from '@/lib/market'
import { useAllTokens, useMarket } from '@/lib/queries'
import { Reveal } from '@/motion/Reveal'
import { Flip, gsap, reducedMotion, useGSAP } from '@/motion/gsap'

const VIEWS = [
  { id: 'all', label: 'All listings' },
  { id: 'sale', label: 'For sale' },
  { id: 'auctions', label: 'Auctions' },
  { id: 'everything', label: 'All NFTs' },
] as const

type View = (typeof VIEWS)[number]['id']

export function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const view = (VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'all') as View
  const market = useMarket()
  const everything = useAllTokens()
  const grid = useRef<HTMLDivElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)

  const tokens =
    view === 'everything'
      ? everything.data
      : market.data?.filter((t) => {
          const status = tokenStatus(t)
          if (view === 'sale') return status === 'sale'
          if (view === 'auctions') return status === 'auction' || status === 'ended'
          return true
        })

  function select(next: View) {
    if (next === view) return
    // Record where every print sits now, so they can glide to their new places.
    if (grid.current && !reducedMotion()) flipState.current = Flip.getState(grid.current.querySelectorAll('li'))
    setParams(next === 'all' ? {} : { view: next }, { preventScrollReset: true })
  }

  useGSAP(
    () => {
      if (!flipState.current || !grid.current) return
      Flip.from(flipState.current, {
        targets: grid.current.querySelectorAll('li'),
        duration: 0.9,
        ease: 'nftrium.out',
        stagger: 0.015,
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.02 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.3 }),
      })
      flipState.current = null
    },
    { dependencies: [view, tokens?.length], scope: grid },
  )

  return (
    <div className="px-4 pt-32 sm:px-8">
      <header className="mb-14 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="label mb-4">Marketplace</p>
          <Reveal as="h1" immediate className="display text-display-lg">
            Explore
          </Reveal>
        </div>
        <div role="tablist" aria-label="Filter NFTs" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" type="button" aria-selected={view === v.id} className="btn" onClick={() => select(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {(market.error || everything.error) && (
        <p role="alert" className="label mb-6 text-error">
          Couldn’t reach Sepolia. Retrying…
        </p>
      )}
      <p className="edge mb-6 text-faint" aria-live="polite">
        {tokens ? `${tokens.length} ${tokens.length === 1 ? 'NFT' : 'NFTs'}` : 'Loading…'}
      </p>
      <div ref={grid}>
        <TokenGrid tokens={tokens} empty="Nothing here yet." />
      </div>
    </div>
  )
}
