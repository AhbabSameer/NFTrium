import { QueryClient } from '@tanstack/react-query'
import { createConfig, fallback, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { chain } from './contracts'

const customRpc = import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined

// Reads go through public RPCs, so the marketplace is browsable without a wallet.
// Browser wallets are discovered automatically via EIP-6963.
export const config = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: {
    [chain.id]: fallback([
      ...(customRpc ? [http(customRpc)] : []),
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http(),
    ]),
  },
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 2 },
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
