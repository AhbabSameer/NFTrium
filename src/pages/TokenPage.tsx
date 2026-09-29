import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { TokenActions } from '@/components/TokenActions'
import { tokenNumber, useStatusLine } from '@/components/TokenCard'
import { TokenImage } from '@/components/TokenImage'
import { explorerTx } from '@/lib/contracts'
import { formatEth, shortAddress } from '@/lib/format'
import type { Activity, Token } from '@/lib/market'
import { holderOf } from '@/lib/market'
import { useMetadata, useToken, useTokenActivity } from '@/lib/queries'
import { Reveal } from '@/motion/Reveal'
import { NotFoundPage } from './NotFoundPage'

const ACTIVITY: Record<Activity['kind'], string> = {
  minted: 'Minted',
  listed: 'Listed for sale',
  priceUpdated: 'Price changed',
  listingCancelled: 'Listing cancelled',
  sold: 'Sold',
  auctionCreated: 'Auction started',
  bid: 'Bid',
  auctionSettled: 'Auction settled',
  auctionCancelled: 'Auction cancelled',
}

export function TokenPage() {
  const { id: raw } = useParams()
  const id = raw && /^\d+$/.test(raw) ? BigInt(raw) : undefined
  const { data: token, isError } = useToken(id)

  if (id === undefined || isError) return <NotFoundPage />

  return (
    <div className="px-4 pt-24 sm:px-8">
      <BackButton />
      <article className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          {token ? (
            <TokenImage
              tokenURI={token.tokenURI}
              priority
              sizes="(min-width: 1024px) 56vw, 100vw"
              transitionName={`print-${token.id}`}
              fit="contain"
              className="aspect-[4/5] max-h-[calc(100dvh-8rem)] w-full shadow-[0_40px_140px_-40px_rgb(77_141_255/0.4)] lg:aspect-auto lg:h-[calc(100dvh-8rem)]"
            />
          ) : (
            <div className="aspect-[4/5] animate-pulse bg-ink-2 lg:h-[calc(100dvh-8rem)]" />
          )}
        </div>
        {token ? <Details token={token} /> : <p className="label">Loading…</p>}
      </article>
    </div>
  )
}

/**
 * Back to wherever you came from inside the site (keeping your scroll position), or to Explore
 * when this page was opened directly from a link.
 */
function BackButton() {
  const navigate = useNavigate()
  const { key } = useLocation()
  const cameFromSite = key !== 'default'
  return (
    <button
      type="button"
      className="btn group gap-2 pl-3"
      onClick={() => (cameFromSite ? navigate(-1) : navigate('/explore', { viewTransition: true }))}
    >
      <svg aria-hidden className="size-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {cameFromSite ? 'Back' : 'Back to Explore'}
    </button>
  )
}

function Details({ token }: { token: Token }) {
  const { data: metadata } = useMetadata(token.tokenURI)
  const { data: activity } = useTokenActivity(token.id)
  const { tag, status } = useStatusLine(token)
  const holder = holderOf(token)

  return (
    <div className="space-y-12 pb-12">
      <header>
        <p className="edge mb-6 flex justify-between text-faint">
          <span>{tokenNumber(token.id)}</span>
          <span className={status === 'auction' || status === 'ended' ? 'text-accent' : ''}>{tag}</span>
        </p>
        {metadata ? (
          <Reveal as="h1" immediate className="display text-display-lg">
            {metadata.name}
          </Reveal>
        ) : (
          <div className="h-24 w-3/4 animate-pulse bg-ink-2" />
        )}
        {metadata?.description && <p className="mt-6 max-w-prose text-lg text-dim">{metadata.description}</p>}

        <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 border-t border-line pt-6">
          <dt className="label">Creator</dt>
          <dd className="edge self-center">
            <Link className="hover:text-accent" to={`/profile/${token.creator}`} viewTransition>
              {shortAddress(token.creator)}
            </Link>
          </dd>
          <dt className="label">{token.listing || token.auction ? 'Seller' : 'Owner'}</dt>
          <dd className="edge self-center">
            <Link className="hover:text-accent" to={`/profile/${holder}`} viewTransition>
              {shortAddress(holder)}
            </Link>
          </dd>
          {metadata?.attributes?.map((a) => (
            <div key={a.trait_type} className="contents">
              <dt className="label">{a.trait_type}</dt>
              <dd className="edge self-center">{a.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <TokenActions token={token} />

      <section aria-labelledby="provenance">
        <h2 id="provenance" className="label mb-4">
          Provenance
        </h2>
        {activity?.length ? (
          <ol className="border-t border-line">
            {activity.map((a) => (
              <li key={`${a.hash}-${a.logIndex}`} className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-line py-3">
                <span className="text-sm">
                  {ACTIVITY[a.kind]}
                  {a.account && <span className="edge ml-2 text-dim">{shortAddress(a.account)}</span>}
                  {a.kind === 'auctionSettled' && !a.account && <span className="edge ml-2 text-dim">no bids</span>}
                </span>
                <a href={explorerTx(a.hash)} target="_blank" rel="noreferrer" className="edge text-dim hover:text-accent">
                  {a.amount ? `${formatEth(a.amount)} ETH` : 'Tx'} ↗
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="edge text-faint">{activity ? 'No history yet.' : 'Loading history…'}</p>
        )}
      </section>
    </div>
  )
}
