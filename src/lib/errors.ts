import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, formatEther } from 'viem'

const REVERTS: Record<string, (args: readonly unknown[]) => string> = {
  NotTokenOwner: () => 'You no longer own this NFT.',
  NotSeller: () => 'Only the seller can do that.',
  NotListed: () => 'This NFT is no longer for sale.',
  NotAuctioned: () => 'This auction is no longer running.',
  InvalidPrice: () => 'Enter a price above zero.',
  InvalidDuration: () => 'Auctions must run between 1 hour and 30 days.',
  WrongPayment: ([expected]) => `The price changed. It is now ${formatEther(expected as bigint)} ETH.`,
  SellerCannotBuy: () => 'You can’t buy or bid on your own NFT.',
  AuctionEnded: () => 'This auction has already ended.',
  AuctionNotEnded: () => 'This auction hasn’t ended yet.',
  BidTooLow: ([min]) => `Someone outbid you. The minimum bid is now ${formatEther(min as bigint)} ETH.`,
  HasBids: () => 'An auction can’t be cancelled once it has bids.',
  NothingToWithdraw: () => 'There’s nothing to withdraw.',
  EnforcedPause: () => 'The marketplace is paused right now.',
  RoyaltyTooHigh: () => 'Royalty can’t be more than 5%.',
  EmptyURI: () => 'The upload didn’t finish. Try again.',
}

/** Turn wallet, RPC and contract errors into one sentence a person can act on. */
export function humanizeError(error: unknown): string {
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) return 'You cancelled the request in your wallet.'
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      const message = REVERTS[revert.data.errorName]
      if (message) return message(revert.data.args ?? [])
    }
    if (/insufficient funds/i.test(error.message)) return 'Your wallet doesn’t have enough Sepolia ETH for this.'
    return error.shortMessage
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}
