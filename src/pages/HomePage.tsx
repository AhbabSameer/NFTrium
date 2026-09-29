import { useEffect, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router'
import { HowItWorks } from '@/components/HowItWorks'
import { NftWall } from '@/components/NftWall'
import type { WallItem } from '@/components/NftWall'
import { TokenCard, TokenGrid } from '@/components/TokenCard'
import { formatEth } from '@/lib/format'
import type { Token } from '@/lib/market'
import { tokenStatus } from '@/lib/market'
import { ipfsImageUrl } from '@/lib/ipfs'
import { fetchMetadata } from '@/lib/market'
import { useAllTokens, useMarket, useMetadata, useStats } from '@/lib/queries'
import { useDragScroll } from '@/lib/useDragScroll'
import { Reveal } from '@/motion/Reveal'
import { gsap, useGSAP } from '@/motion/gsap'

export function HomePage() {
  const { data: market } = useMarket()
  const auctions = market?.filter((t) => tokenStatus(t) === 'auction')
  const sales = market?.filter((t) => tokenStatus(t) === 'sale')

  return (
    <>
      <Hero />
      <ForSale sales={sales} />
      <LiveAuctions auctions={auctions} />
      <Story token={auctions?.[0] ?? market?.[0]} />
      <Closing />
    </>
  )
}

/* ─── 1. Hero ─────────────────────────────────────────────────────────────── */

/** Every minted NFT with a small resized image, for the hero's wall. */
function useWallItems(): WallItem[] {
  const { data: tokens } = useAllTokens()
  const metadata = useQueries({
    queries: (tokens ?? []).map((t) => ({
      queryKey: ['metadata', t.tokenURI],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchMetadata(t.tokenURI, signal),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })
  return (tokens ?? []).flatMap((t, i) => {
    const data = metadata[i]?.data
    return data ? [{ id: t.id, name: data.name, image: ipfsImageUrl(data.image, 420) }] : []
  })
}

function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { data: stats } = useStats()
  const { data: market } = useMarket()
  const live = market?.filter((t) => tokenStatus(t) === 'auction').length
  const items = useWallItems()
  // Wait until most NFTs are known, so the wall doesn't reshuffle on every arrival.
  const wallItems = items.length >= Math.min(12, stats?.minted ?? 12) ? items : []
  const [desktop] = useState(() => window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const scrollAway = { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: true }
        gsap.to('[data-hero-wall]', { opacity: 0, yPercent: -8, ease: 'none', scrollTrigger: scrollAway })
        gsap.to('[data-hero-title]', { yPercent: 25, opacity: 0.2, ease: 'none', scrollTrigger: scrollAway })
      })
    },
    { scope: ref },
  )

  return (
    <section ref={ref} className="relative flex min-h-dvh flex-col overflow-hidden px-4 pt-28 pb-8 sm:px-8">
      <div data-hero-wall aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        {wallItems.length > 0 && <NftWall items={wallItems} interactive={desktop} />}
        {/* Keep the copy legible: a fade on the text side (desktop), an overall scrim on narrow screens. */}
        <div className="pointer-events-none absolute inset-0 bg-ink/85 lg:bg-transparent lg:bg-[linear-gradient(90deg,var(--color-ink)_0%,rgb(3_4_6/0.8)_34%,transparent_52%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink to-transparent" />
      </div>

      <div data-hero-title className="pointer-events-none relative z-10 flex flex-1 flex-col justify-center [&_a]:pointer-events-auto">
        <Reveal as="p" immediate className="label mb-8 text-accent">
          NFT marketplace · Live on Sepolia testnet
        </Reveal>
        <Reveal as="h1" immediate delay={0.1} className="display max-w-5xl text-display-xl">
          Buy, sell and auction <em className="text-accent">image NFTs.</em>
        </Reveal>
        <Reveal as="p" immediate delay={0.5} className="mt-8 max-w-xl text-lg text-dim">
          NFTrium is a marketplace for digital art. Mint your images as NFTs, sell them at a fixed price or in timed
          auctions, and earn a royalty every time they resell. Listed NFTs are held in escrow until they sell.
        </Reveal>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/explore" viewTransition className="btn btn-primary">
            Explore NFTs
          </Link>
          <Link to="/create" viewTransition className="btn">
            Create an NFT
          </Link>
        </div>
      </div>

      <dl className="relative z-10 mt-16 grid grid-cols-2 gap-y-6 border-t border-line pt-6 sm:grid-cols-4">
        {[
          ['NFTs minted', stats?.minted],
          ['Live auctions', live],
          ['Sales', stats?.sales],
          ['Volume', stats && `${formatEth(stats.volume)} ETH`],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt className="label">{label}</dt>
            <dd className="mt-1 font-mono text-2xl tabular-nums">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ─── 3. Live auctions ────────────────────────────────────────────────────── */

function LiveAuctions({ auctions }: { auctions?: Token[] }) {
  return (
    <section aria-labelledby="auctions" className="px-4 py-24 sm:px-8">
      <SectionHeader index="02" id="auctions" title="Live auctions" link={{ to: '/explore?view=auctions', label: 'All auctions' }}>
        Bid before the timer runs out. A bid in the last 10 minutes extends the auction by 10 minutes.
      </SectionHeader>
      <TokenGrid tokens={auctions?.slice(0, 8)} empty="No live auctions right now." />
    </section>
  )
}

/* ─── 4. How it works: the anime.js story ─────────────────────────────────── */

function Story({ token }: { token?: Token }) {
  const { data: metadata } = useMetadata(token?.tokenURI)
  return <HowItWorks name={metadata?.name ?? 'your NFT'} image={metadata ? ipfsImageUrl(metadata.image, 480) : undefined} />
}

/* ─── 2. For sale: NFT cards hanging on a line, moved with sideways gestures ─ */

function ForSale({ sales }: { sales?: Token[] }) {
  const track = useRef<HTMLUListElement>(null)
  useDragScroll(track)

  // Prints swing opposite to the direction the row moves, then settle.
  useEffect(() => {
    const el = track.current
    if (!el || !sales?.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const sway = gsap.quickTo(el.querySelectorAll('[data-pin-print]'), 'rotation', { duration: 0.9, ease: 'elastic.out(1, 0.35)' })
    let last = el.scrollLeft
    let lastT = performance.now()
    let settle: ReturnType<typeof setTimeout>
    const onScroll = () => {
      const now = performance.now()
      const velocity = (el.scrollLeft - last) / Math.max(1, now - lastT)
      last = el.scrollLeft
      lastT = now
      sway(gsap.utils.clamp(-7, 7, -velocity * 4))
      clearTimeout(settle)
      settle = setTimeout(() => sway(0), 120)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      clearTimeout(settle)
    }
  }, [sales?.length])

  return (
    <section aria-labelledby="sale" className="py-24">
      <div className="px-4 sm:px-8">
        <SectionHeader index="01" id="sale" title="For sale" link={{ to: '/explore?view=sale', label: 'Everything for sale' }}>
          Fixed-price NFTs. Pay the listed price and it’s yours in a single transaction.
        </SectionHeader>
        <p aria-hidden className="edge -mt-6 mb-6 text-faint">
          Swipe or drag sideways →
        </p>
      </div>
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-4 h-px bg-line-strong" />
        <ul
          ref={track}
          className="flex cursor-grab gap-8 overflow-x-auto overscroll-x-contain px-4 pt-4 pb-6 select-none [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {sales?.map((token) => (
            <li key={token.id.toString()} data-pin-print className="w-64 shrink-0 origin-top sm:w-72">
              <div aria-hidden className="relative z-10 mx-auto -mt-2 -mb-3.5 h-8 w-3.5 rounded-[3px] bg-gradient-to-b from-[#c9d3e3] to-[#7d8798] shadow-[0_4px_8px_rgb(0_0_0/0.6)]" />
              <div draggable={false}>
                <TokenCard token={token} sizes="288px" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ─── 5. Closing ──────────────────────────────────────────────────────────── */

function Closing() {
  return (
    <section className="px-4 py-32 text-center sm:px-8">
      <Reveal as="h2" className="display mx-auto max-w-5xl text-display-lg">
        Ready to sell <em className="text-accent">your art?</em>
      </Reveal>
      <Link to="/create" viewTransition className="btn btn-primary mt-12">
        Create an NFT
      </Link>
    </section>
  )
}

function SectionHeader({
  index,
  id,
  title,
  link,
  children,
}: {
  index: string
  id: string
  title: string
  link: { to: string; label: string }
  children: React.ReactNode
}) {
  return (
    <header className="mb-12 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p className="label mb-4">
          {index} — {title}
        </p>
        <Reveal as="h2" className="display text-display-lg">
          <span id={id}>{title}</span>
        </Reveal>
        <p className="mt-4 max-w-lg text-dim">{children}</p>
      </div>
      <Link to={link.to} viewTransition className="btn self-start md:self-end">
        {link.label} →
      </Link>
    </header>
  )
}
