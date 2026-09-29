import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { Link, useViewTransitionState } from 'react-router'
import { formatEth, formatRemaining } from '@/lib/format'
import type { Token } from '@/lib/market'
import { tokenStatus } from '@/lib/market'
import { useMetadata } from '@/lib/queries'
import { useNow } from '@/lib/useNow'
import { TokenImage } from './TokenImage'

export const tokenNumber = (id: bigint) => `No. ${id.toString().padStart(3, '0')}`

/** How a token's market state reads on cards and the token page. */
export function useStatusLine(token: Token) {
  const now = useNow()
  const status = tokenStatus(token, now)
  const { listing, auction } = token
  switch (status) {
    case 'sale':
      return { status, tag: 'For sale', priceLabel: 'Price', price: listing!.price }
    case 'auction':
      return {
        status,
        tag: formatRemaining(auction!.endTime - now),
        priceLabel: auction!.highestBidder ? 'Current bid' : 'Reserve',
        price: auction!.highestBid || auction!.reservePrice,
      }
    case 'ended':
      return { status, tag: 'Auction ended', priceLabel: 'Final bid', price: auction!.highestBid || null }
    case 'held':
      return { status, tag: 'Not listed', priceLabel: 'Not for sale', price: null }
  }
}

const TILT = 9 // degrees at the card's edge

/**
 * An NFT as a card: framed artwork, a clear name, and a labelled price. On hover (fine pointers,
 * motion allowed) it tilts towards the cursor, a light follows the pointer, and a glow blooms behind.
 */
export function TokenCard({ token, sizes }: { token: Token; sizes?: string }) {
  const { data: metadata } = useMetadata(token.tokenURI)
  const { status, tag, priceLabel, price } = useStatusLine(token)
  const to = `/token/${token.id}`
  // Only the card being opened carries the shared name, so each name is unique on the page.
  const transitioning = useViewTransitionState(to)
  const card = useRef<HTMLDivElement>(null)

  function onMove(e: PointerEvent<HTMLAnchorElement>) {
    const el = card.current
    if (!el || e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    el.style.setProperty('--rx', `${(0.5 - y) * TILT}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * TILT}deg`)
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
  }

  function onLeave() {
    const el = card.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  const live = status === 'auction'

  return (
    <Link
      to={to}
      viewTransition
      className="group relative block [perspective:900px]"
      aria-label={metadata?.name ?? tokenNumber(token.id)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      draggable={false}
    >
      {/* The glow that blooms behind the card on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-accent/30 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <div
        ref={card}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-ink-3 to-ink-2 p-2.5 shadow-[0_20px_50px_-25px_rgb(0_0_0/0.9)] ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 ease-out will-change-transform [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] group-hover:shadow-[0_30px_70px_-25px_rgb(77_141_255/0.45)] group-hover:ring-accent/50"
      >
        {/* A soft light that follows the pointer across the card. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,0%),rgb(160_196_255/0.16),transparent_65%)]"
        />
        <div className="relative">
          <TokenImage
            tokenURI={token.tokenURI}
            sizes={sizes}
            className="aspect-square rounded-xl"
            transitionName={transitioning ? `print-${token.id}` : undefined}
          />
          <span
            className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md ${
              live ? 'bg-accent/90 text-ink' : 'bg-ink/70 text-paper ring-1 ring-white/15'
            }`}
          >
            {live && <span className="size-1.5 animate-pulse rounded-full bg-ink" />}
            {tag}
          </span>
        </div>
        <div className="px-1.5 pt-3.5 pb-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate text-base font-semibold tracking-tight text-paper">{metadata?.name ?? ' '}</h3>
            <span className="shrink-0 font-mono text-[11px] text-faint">#{token.id.toString().padStart(3, '0')}</span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
            <div className="min-w-0">
              <p className="text-[11px] text-dim">{priceLabel}</p>
              {price !== null ? (
                <p className="mt-0.5 font-mono text-lg font-semibold text-paper tabular-nums">
                  {formatEth(price)} <span className="text-sm font-normal text-dim">ETH</span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-faint">—</p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-paper ring-1 ring-white/10 transition-colors group-hover:bg-accent group-hover:text-ink group-hover:ring-accent">
              {status === 'sale' ? 'Buy' : live ? 'Bid' : 'View'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function TokenGrid({ tokens, empty, sizes }: { tokens: Token[] | undefined; empty: string; sizes?: string }) {
  if (!tokens) {
    return (
      <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="aspect-[4/5.3] animate-pulse rounded-2xl bg-ink-2" />
        ))}
      </ul>
    )
  }
  if (tokens.length === 0) return <p className="label">{empty}</p>
  return (
    <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {tokens.map((token) => (
        <li key={token.id.toString()}>
          <TokenCard token={token} sizes={sizes} />
        </li>
      ))}
    </ul>
  )
}
