import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import {
  fetchActivity,
  fetchAllTokens,
  fetchMarket,
  fetchMetadata,
  fetchProfile,
  fetchQuote,
  fetchToken,
  statsFrom,
} from './market'

/** Everything under this prefix is chain state; invalidate it after any transaction. */
export const CHAIN_KEY = 'chain'

export const useMarket = () => useQuery({ queryKey: [CHAIN_KEY, 'market'], queryFn: fetchMarket })

export const useAllTokens = () => useQuery({ queryKey: [CHAIN_KEY, 'tokens'], queryFn: fetchAllTokens })

export const useToken = (id: bigint | undefined) =>
  useQuery({
    queryKey: [CHAIN_KEY, 'token', id?.toString()],
    queryFn: () => fetchToken(id!),
    enabled: id !== undefined,
    // Live auctions change under you; keep them fresh.
    refetchInterval: 20_000,
  })

export const useProfile = (address: Address | undefined) =>
  useQuery({
    queryKey: [CHAIN_KEY, 'profile', address?.toLowerCase()],
    queryFn: () => fetchProfile(address!),
    enabled: !!address,
  })

export const useQuote = (tokenId: bigint | undefined, price: bigint | undefined) =>
  useQuery({
    queryKey: [CHAIN_KEY, 'quote', tokenId?.toString(), price?.toString()],
    queryFn: () => fetchQuote(tokenId!, price!),
    enabled: tokenId !== undefined && !!price,
  })

const useActivity = () =>
  useQuery({ queryKey: [CHAIN_KEY, 'activity'], queryFn: fetchActivity, staleTime: 30_000 })

export function useTokenActivity(tokenId: bigint | undefined) {
  const query = useActivity()
  return { ...query, data: query.data?.filter((a) => a.tokenId === tokenId) }
}

export function useStats() {
  const query = useActivity()
  return { ...query, data: query.data && statsFrom(query.data) }
}

/** IPFS content never changes for a given URI, so metadata is cached forever. */
export const useMetadata = (tokenURI: string | undefined) =>
  useQuery({
    queryKey: ['metadata', tokenURI],
    queryFn: ({ signal }) => fetchMetadata(tokenURI!, signal),
    enabled: !!tokenURI,
    staleTime: Infinity,
    gcTime: Infinity,
  })
