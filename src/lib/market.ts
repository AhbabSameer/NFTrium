import type { Address, Hash } from 'viem'
import { zeroAddress } from 'viem'
import { getPublicClient, readContract, readContracts } from 'wagmi/actions'
import { DEPLOY_BLOCK, imageNft, marketplace } from './contracts'
import { fetchIpfsJson } from './ipfs'
import { config } from './wagmi'

interface Listing {
  seller: Address
  price: bigint
}

interface Auction {
  seller: Address
  /** Unix seconds. May move later: a bid in the final 10 minutes extends it. */
  endTime: number
  highestBidder: Address | null
  highestBid: bigint
  reservePrice: bigint
  minNextBid: bigint
}

export interface Token {
  id: bigint
  tokenURI: string
  owner: Address
  creator: Address
  listing: Listing | null
  auction: Auction | null
}

export interface Metadata {
  name: string
  description?: string
  image: string
  attributes?: { trait_type: string; value: string | number }[]
}

export type TokenStatus = 'sale' | 'auction' | 'ended' | 'held'

export function tokenStatus(token: Token, nowSeconds = Date.now() / 1000): TokenStatus {
  if (token.listing) return 'sale'
  if (token.auction) return token.auction.endTime > nowSeconds ? 'auction' : 'ended'
  return 'held'
}

/** Seller for escrowed tokens (the market holds them), otherwise the wallet that owns it. */
export const holderOf = (token: Token): Address =>
  token.listing?.seller ?? token.auction?.seller ?? token.owner

// --- Reads ---

/** Full on-chain state for each token id, in one multicall. */
async function fetchTokens(ids: readonly bigint[]): Promise<Token[]> {
  if (ids.length === 0) return []
  const perToken = 6
  const results = await readContracts(config, {
    allowFailure: false,
    contracts: ids.flatMap((id) => [
      { ...imageNft, functionName: 'tokenURI', args: [id] },
      { ...imageNft, functionName: 'ownerOf', args: [id] },
      { ...imageNft, functionName: 'creatorOf', args: [id] },
      { ...marketplace, functionName: 'listings', args: [id] },
      { ...marketplace, functionName: 'auctions', args: [id] },
      { ...marketplace, functionName: 'minNextBid', args: [id] },
    ]),
  })

  return ids.map((id, i) => {
    const r = results.slice(i * perToken, (i + 1) * perToken)
    const [tokenURI, owner, creator] = r as [string, Address, Address]
    const [seller, price] = r[3] as unknown as readonly [Address, bigint]
    const [auctionSeller, endTime, highestBidder, highestBid, reservePrice] = r[4] as unknown as readonly [
      Address,
      bigint,
      Address,
      bigint,
      bigint,
    ]
    return {
      id,
      tokenURI,
      owner,
      creator,
      listing: seller === zeroAddress ? null : { seller, price },
      auction:
        auctionSeller === zeroAddress
          ? null
          : {
              seller: auctionSeller,
              endTime: Number(endTime),
              highestBidder: highestBidder === zeroAddress ? null : highestBidder,
              highestBid,
              reservePrice,
              minNextBid: r[5] as bigint,
            },
    }
  })
}

export async function fetchToken(id: bigint): Promise<Token> {
  const [token] = await fetchTokens([id])
  return token!
}

/** Every token currently for sale or in auction (including ended, unsettled auctions). */
export async function fetchMarket(): Promise<Token[]> {
  const [sales, auctions] = await readContracts(config, {
    allowFailure: false,
    contracts: [
      { ...marketplace, functionName: 'saleCount' },
      { ...marketplace, functionName: 'auctionCount' },
    ],
  })
  const [saleIds, auctionIds] = await readContracts(config, {
    allowFailure: false,
    contracts: [
      { ...marketplace, functionName: 'getSaleIds', args: [0n, sales] },
      { ...marketplace, functionName: 'getAuctionIds', args: [0n, auctions] },
    ],
  })
  return fetchTokens([...auctionIds, ...saleIds])
}

/** Every token ever minted, newest first. */
export async function fetchAllTokens(): Promise<Token[]> {
  const supply = await readContract(config, { ...imageNft, functionName: 'nextTokenId' })
  const ids = Array.from({ length: Number(supply) }, (_, i) => supply - 1n - BigInt(i))
  return fetchTokens(ids)
}

export interface Profile {
  owned: Token[]
  created: Token[]
  listed: Token[]
  pendingWithdrawal: bigint
}

export async function fetchProfile(address: Address): Promise<Profile> {
  const [owned, created, listed, pendingWithdrawal] = await readContracts(config, {
    allowFailure: false,
    contracts: [
      { ...imageNft, functionName: 'tokensOfOwner', args: [address] },
      { ...imageNft, functionName: 'tokensCreatedBy', args: [address] },
      { ...marketplace, functionName: 'tokensListedBy', args: [address] },
      { ...marketplace, functionName: 'pendingWithdrawals', args: [address] },
    ],
  })
  const unique = [...new Set([...owned, ...created, ...listed])]
  const tokens = new Map((await fetchTokens(unique)).map((t) => [t.id, t]))
  const pick = (ids: readonly bigint[]) => ids.map((id) => tokens.get(id)!)
  return { owned: pick(owned), created: pick(created), listed: pick(listed), pendingWithdrawal }
}

export async function fetchQuote(tokenId: bigint, price: bigint) {
  const [fee, royaltyReceiver, royalty, sellerProceeds] = await readContract(config, {
    ...marketplace,
    functionName: 'quote',
    args: [tokenId, price],
  })
  return { fee, royaltyReceiver, royalty, sellerProceeds }
}

export const fetchMetadata = (tokenURI: string, signal?: AbortSignal) =>
  fetchIpfsJson<Metadata>(tokenURI, signal)

// --- Activity (from events) ---

type ActivityKind =
  | 'minted'
  | 'listed'
  | 'priceUpdated'
  | 'listingCancelled'
  | 'sold'
  | 'auctionCreated'
  | 'bid'
  | 'auctionSettled'
  | 'auctionCancelled'

export interface Activity {
  kind: ActivityKind
  tokenId: bigint
  /** The actor: minter, seller, buyer, bidder or winner depending on `kind`. */
  account: Address | null
  amount: bigint | null
  blockNumber: bigint
  logIndex: number
  hash: Hash
}

const LOG_CHUNK = 45_000n // stays under public RPC eth_getLogs range limits

/** All marketplace + mint activity since deployment, newest first. */
export async function fetchActivity(): Promise<Activity[]> {
  const client = getPublicClient(config)
  const latest = await client.getBlockNumber()
  const ranges: [bigint, bigint][] = []
  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_CHUNK) {
    ranges.push([from, from + LOG_CHUNK - 1n > latest ? latest : from + LOG_CHUNK - 1n])
  }

  const chunks = await Promise.all(
    ranges.flatMap(([fromBlock, toBlock]) => [
      client.getContractEvents({ ...marketplace, fromBlock, toBlock }),
      client.getContractEvents({ ...imageNft, eventName: 'Minted', fromBlock, toBlock }),
    ]),
  )

  const activity: Activity[] = []
  for (const log of chunks.flat()) {
    const base = { blockNumber: log.blockNumber, logIndex: log.logIndex, hash: log.transactionHash }
    switch (log.eventName) {
      case 'Minted':
        activity.push({ ...base, kind: 'minted', tokenId: log.args.tokenId!, account: log.args.creator!, amount: null })
        break
      case 'Listed':
        activity.push({ ...base, kind: 'listed', tokenId: log.args.tokenId!, account: log.args.seller!, amount: log.args.price! })
        break
      case 'PriceUpdated':
        activity.push({ ...base, kind: 'priceUpdated', tokenId: log.args.tokenId!, account: null, amount: log.args.price! })
        break
      case 'ListingCancelled':
        activity.push({ ...base, kind: 'listingCancelled', tokenId: log.args.tokenId!, account: log.args.seller!, amount: null })
        break
      case 'Sold':
        activity.push({ ...base, kind: 'sold', tokenId: log.args.tokenId!, account: log.args.buyer!, amount: log.args.price! })
        break
      case 'AuctionCreated':
        activity.push({ ...base, kind: 'auctionCreated', tokenId: log.args.tokenId!, account: log.args.seller!, amount: log.args.reservePrice! })
        break
      case 'BidPlaced':
        activity.push({ ...base, kind: 'bid', tokenId: log.args.tokenId!, account: log.args.bidder!, amount: log.args.amount! })
        break
      case 'AuctionSettled': {
        const winner = log.args.winner!
        activity.push({
          ...base,
          kind: 'auctionSettled',
          tokenId: log.args.tokenId!,
          account: winner === zeroAddress ? null : winner,
          amount: log.args.amount!,
        })
        break
      }
      case 'AuctionCancelled':
        activity.push({ ...base, kind: 'auctionCancelled', tokenId: log.args.tokenId!, account: log.args.seller!, amount: null })
        break
    }
  }
  return activity.toSorted((a, b) =>
    a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : Number(b.blockNumber - a.blockNumber),
  )
}

export interface MarketStats {
  minted: number
  sales: number
  volume: bigint
  bids: number
}

export function statsFrom(activity: Activity[]): MarketStats {
  let volume = 0n
  let sales = 0
  let bids = 0
  let minted = 0
  for (const a of activity) {
    if (a.kind === 'minted') minted++
    if (a.kind === 'bid') bids++
    if ((a.kind === 'sold' || (a.kind === 'auctionSettled' && a.account)) && a.amount) {
      volume += a.amount
      sales++
    }
  }
  return { minted, sales, volume, bids }
}
