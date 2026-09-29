import { sepolia } from 'wagmi/chains'
import { imageNftAbi, nftMarketplaceAbi } from './generated'

export const chain = sepolia

export const imageNft = {
  address: '0xF4eBc0433626433A15D51Ba3A7Ab4b05CAFfC79C',
  abi: imageNftAbi,
  chainId: chain.id,
} as const

export const marketplace = {
  address: '0x338992Aa1eA01A0E02B7411245A8fE4eE1307d53',
  abi: nftMarketplaceAbi,
  chainId: chain.id,
} as const

/** Block the contracts were deployed in; event queries start here. */
export const DEPLOY_BLOCK = 11_808_053n

export const explorerTx = (hash: string) => `${chain.blockExplorers.default.url}/tx/${hash}`
export const explorerAddress = (address: string) => `${chain.blockExplorers.default.url}/address/${address}`
