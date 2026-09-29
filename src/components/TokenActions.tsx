import { useState } from 'react'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import * as actions from '@/lib/actions'
import { formatEth, formatRemaining, shortAddress } from '@/lib/format'
import type { Token } from '@/lib/market'
import { tokenStatus } from '@/lib/market'
import { useQuote } from '@/lib/queries'
import { useAction } from '@/lib/useAction'
import { useNow } from '@/lib/useNow'
import { EthInput, parseEthInput } from './EthInput'

const same = (a?: Address | null, b?: Address | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** The action panel on a token page: what you can do depends on who you are and the token's state. */
export function TokenActions({ token }: { token: Token }) {
  const { address } = useConnection()
  const now = useNow()
  const status = tokenStatus(token, now)

  return (
    <section aria-label="Actions" className="space-y-5 border border-line-strong bg-ink-2/60 p-6">
      {status === 'sale' && <SalePanel token={token} me={address} />}
      {status === 'auction' && <AuctionPanel token={token} me={address} now={now} />}
      {status === 'ended' && <EndedPanel token={token} me={address} />}
      {status === 'held' && <HeldPanel token={token} me={address} />}
    </section>
  )
}

function SalePanel({ token, me }: { token: Token; me?: Address }) {
  const listing = token.listing!
  const action = useAction()
  const [price, setPrice] = useState('')
  const newPrice = parseEthInput(price)

  if (same(me, listing.seller)) {
    return (
      <>
        <Price label="Your asking price" wei={listing.price} />
        <EthInput label="New price" value={price} onChange={setPrice} />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!newPrice || action.busy}
            onClick={() => action.run(() => actions.updatePrice(token.id, newPrice!))}
          >
            Change price
          </button>
          <button type="button" className="btn" disabled={action.busy} onClick={() => action.run(() => actions.cancelListing(token.id))}>
            Cancel listing
          </button>
        </div>
        <FeeBreakdown tokenId={token.id} price={newPrice ?? listing.price} />
        <ActionError message={action.error} />
      </>
    )
  }

  return (
    <>
      <Price label="Price" wei={listing.price} />
      <p className="font-mono text-xs text-dim">Seller {shortAddress(listing.seller)}</p>
      <RequireWallet me={me} verb="buy this NFT">
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={action.busy}
          onClick={() => action.run(() => actions.buy(token.id, listing.price))}
        >
          Buy for {formatEth(listing.price)} ETH
        </button>
      </RequireWallet>
      <ActionError message={action.error} />
    </>
  )
}

function AuctionPanel({ token, me, now }: { token: Token; me?: Address; now: number }) {
  const auction = token.auction!
  const action = useAction()
  const [amount, setAmount] = useState('')
  const bid = parseEthInput(amount)
  const tooLow = bid !== undefined && bid < auction.minNextBid
  const leading = same(me, auction.highestBidder)

  return (
    <>
      <div className="flex justify-between gap-4">
        <Price label={auction.highestBidder ? 'Highest bid' : 'Reserve'} wei={auction.highestBid || auction.reservePrice} />
        <div className="text-right">
          <p className="label">Ends in</p>
          <p className="mt-1 font-mono text-3xl tabular-nums text-accent" aria-live="off">
            {formatRemaining(auction.endTime - now)}
          </p>
        </div>
      </div>
      {auction.highestBidder && (
        <p className="font-mono text-xs text-dim">
          {leading ? 'You’re the highest bidder.' : `Leading: ${shortAddress(auction.highestBidder)}`}
        </p>
      )}

      {same(me, auction.seller) ? (
        auction.highestBidder ? (
          <p className="text-sm text-dim">Your auction is live. It settles once the timer runs out.</p>
        ) : (
          <button type="button" className="btn" disabled={action.busy} onClick={() => action.run(() => actions.cancelAuction(token.id))}>
            Cancel auction
          </button>
        )
      ) : (
        <RequireWallet me={me} verb="bid">
          <EthInput
            label="Your bid"
            value={amount}
            onChange={setAmount}
            hint={`Minimum ${formatEth(auction.minNextBid)} ETH. A bid in the last 10 minutes adds 10 minutes.`}
          />
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!bid || tooLow || action.busy}
            onClick={() => action.run(() => actions.bid(token.id, bid!))}
          >
            {tooLow ? `Bid at least ${formatEth(auction.minNextBid)} ETH` : 'Place bid'}
          </button>
          <p className="font-mono text-xs text-dim">If you’re outbid, your ETH is credited back to your NFTrium balance.</p>
        </RequireWallet>
      )}
      <ActionError message={action.error} />
    </>
  )
}

function EndedPanel({ token, me }: { token: Token; me?: Address }) {
  const auction = token.auction!
  const action = useAction()
  return (
    <>
      <p className="font-mono text-xs text-accent uppercase">Auction ended</p>
      {auction.highestBidder ? (
        <Price label={`Won by ${same(me, auction.highestBidder) ? 'you' : shortAddress(auction.highestBidder)}`} wei={auction.highestBid} />
      ) : (
        <p className="text-sm text-dim">No bids. Settling returns the NFT to its seller.</p>
      )}
      <RequireWallet me={me} verb="settle this auction">
        <button type="button" className="btn btn-primary w-full" disabled={action.busy} onClick={() => action.run(() => actions.settleAuction(token.id))}>
          Settle auction
        </button>
        <p className="font-mono text-xs text-dim">Anyone can settle. It sends the NFT to the winner and pays everyone out.</p>
      </RequireWallet>
      <ActionError message={action.error} />
    </>
  )
}

const DURATIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 336, label: '14 days' },
  { hours: 720, label: '30 days' },
]

function HeldPanel({ token, me }: { token: Token; me?: Address }) {
  const action = useAction()
  const [mode, setMode] = useState<'sale' | 'auction'>('sale')
  const [amount, setAmount] = useState('')
  const [hours, setHours] = useState(72)
  const price = parseEthInput(amount)

  if (!same(me, token.owner)) {
    return (
      <>
        <p className="label">Not for sale</p>
        <p className="font-mono text-xs text-dim">Held by {shortAddress(token.owner)}</p>
      </>
    )
  }

  return (
    <>
      <div role="tablist" aria-label="Sell as" className="flex gap-2">
        {(['sale', 'auction'] as const).map((m) => (
          <button key={m} role="tab" type="button" aria-selected={mode === m} className="btn" onClick={() => setMode(m)}>
            {m === 'sale' ? 'Fixed price' : 'Auction'}
          </button>
        ))}
      </div>
      <EthInput label={mode === 'sale' ? 'Price' : 'Reserve price'} value={amount} onChange={setAmount} />
      {mode === 'auction' && (
        <label className="block space-y-1">
          <span className="label">Duration</span>
          <select className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d.hours} value={d.hours}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!price || action.busy}
        onClick={() =>
          action.run(() =>
            mode === 'sale'
              ? actions.list(me!, token.id, price!)
              : actions.createAuction(me!, token.id, price!, BigInt(hours * 3600)),
          )
        }
      >
        {mode === 'sale' ? 'List for sale' : 'Start auction'}
      </button>
      {price && <FeeBreakdown tokenId={token.id} price={price} />}
      <ActionError message={action.error} />
    </>
  )
}

function FeeBreakdown({ tokenId, price }: { tokenId: bigint; price: bigint }) {
  const { data: quote } = useQuote(tokenId, price)
  if (!quote) return null
  return (
    <dl className="grid grid-cols-2 gap-y-1 font-mono text-xs text-dim">
      <dt>Platform fee</dt>
      <dd className="text-right">{formatEth(quote.fee)} ETH</dd>
      <dt>Creator royalty</dt>
      <dd className="text-right">{formatEth(quote.royalty)} ETH</dd>
      <dt className="text-paper">Seller receives</dt>
      <dd className="text-right text-paper">{formatEth(quote.sellerProceeds)} ETH</dd>
    </dl>
  )
}

function Price({ label, wei }: { label: string; wei: bigint }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="mt-1 font-mono text-3xl tabular-nums">{formatEth(wei)} <span className="text-dim">ETH</span></p>
    </div>
  )
}

function RequireWallet({ me, verb, children }: { me?: Address; verb: string; children: React.ReactNode }) {
  if (!me) return <p className="text-sm text-dim">Connect a wallet to {verb}.</p>
  return <div className="space-y-3">{children}</div>
}

function ActionError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-error">
      {message}
    </p>
  )
}
