import type { Address } from 'viem'
import { parseEventLogs } from 'viem'
import { readContract, writeContract } from 'wagmi/actions'
import { imageNft, marketplace } from './contracts'
import { uploadToIpfs } from './ipfs'
import type { TxContext } from './tx'
import { runTx } from './tx'
import { config } from './wagmi'

/** One-time approval so the marketplace can take listed pieces into escrow. */
async function ensureApproval(ctx: TxContext, owner: Address) {
  const approved = await readContract(config, {
    ...imageNft,
    functionName: 'isApprovedForAll',
    args: [owner, marketplace.address],
  })
  if (!approved) {
    await ctx.send('Approve the marketplace (one time)', () =>
      writeContract(config, { ...imageNft, functionName: 'setApprovalForAll', args: [marketplace.address, true] }),
    )
  }
}

export interface MintInput {
  image: File
  name: string
  description: string
  royaltyBps: number
}

export const mint = ({ image, name, description, royaltyBps }: MintInput) =>
  runTx(`Mint “${name}”`, async (ctx) => {
    ctx.step('Uploading image')
    const imageCid = await uploadToIpfs(image, image.name)
    ctx.step('Uploading details')
    const metadata = new Blob([JSON.stringify({ name, description, image: `ipfs://${imageCid}` })], {
      type: 'application/json',
    })
    const metadataCid = await uploadToIpfs(metadata, `${name}.json`)
    const receipt = await ctx.send('Confirm the mint', () =>
      writeContract(config, {
        ...imageNft,
        functionName: 'mint',
        args: [`ipfs://${metadataCid}`, BigInt(royaltyBps)],
      }),
    )
    const [minted] = parseEventLogs({ abi: imageNft.abi, eventName: 'Minted', logs: receipt.logs })
    return minted!.args.tokenId
  })

export const list = (owner: Address, tokenId: bigint, price: bigint) =>
  runTx('List for sale', async (ctx) => {
    await ensureApproval(ctx, owner)
    await ctx.send('Confirm the listing', () =>
      writeContract(config, { ...marketplace, functionName: 'list', args: [tokenId, price] }),
    )
  })

export const updatePrice = (tokenId: bigint, price: bigint) =>
  runTx('Change the price', (ctx) =>
    ctx.send('Confirm the new price', () =>
      writeContract(config, { ...marketplace, functionName: 'updatePrice', args: [tokenId, price] }),
    ),
  )

export const cancelListing = (tokenId: bigint) =>
  runTx('Cancel listing', (ctx) =>
    ctx.send('Confirm', () => writeContract(config, { ...marketplace, functionName: 'cancelListing', args: [tokenId] })),
  )

export const buy = (tokenId: bigint, price: bigint) =>
  runTx('Buy NFT', (ctx) =>
    ctx.send('Confirm the purchase', () =>
      writeContract(config, { ...marketplace, functionName: 'buy', args: [tokenId], value: price }),
    ),
  )

export const createAuction = (owner: Address, tokenId: bigint, reserve: bigint, durationSeconds: bigint) =>
  runTx('Start an auction', async (ctx) => {
    await ensureApproval(ctx, owner)
    await ctx.send('Confirm the auction', () =>
      writeContract(config, {
        ...marketplace,
        functionName: 'createAuction',
        args: [tokenId, reserve, durationSeconds],
      }),
    )
  })

export const bid = (tokenId: bigint, amount: bigint) =>
  runTx('Place a bid', (ctx) =>
    ctx.send('Confirm your bid', () =>
      writeContract(config, { ...marketplace, functionName: 'bid', args: [tokenId], value: amount }),
    ),
  )

export const settleAuction = (tokenId: bigint) =>
  runTx('Settle the auction', (ctx) =>
    ctx.send('Confirm', () => writeContract(config, { ...marketplace, functionName: 'settleAuction', args: [tokenId] })),
  )

export const cancelAuction = (tokenId: bigint) =>
  runTx('Cancel the auction', (ctx) =>
    ctx.send('Confirm', () => writeContract(config, { ...marketplace, functionName: 'cancelAuction', args: [tokenId] })),
  )

export const withdraw = () =>
  runTx('Withdraw earnings', (ctx) =>
    ctx.send('Confirm the withdrawal', () => writeContract(config, { ...marketplace, functionName: 'withdraw' })),
  )
