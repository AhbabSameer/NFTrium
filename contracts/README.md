# Contracts

Foundry project for the NFT marketplace. Solidity 0.8.30, OpenZeppelin v5.4.

| Contract | Purpose |
| --- | --- |
| `ImageNFT` | Open-mint ERC-721 (Enumerable + URIStorage) with per-token ERC-2981 creator royalties, capped at 5%. |
| `NFTMarketplace` | Fixed-price sales and English auctions for `ImageNFT`, with a configurable platform fee capped at 10%. |

## Design

- **Escrow**: listed/auctioned tokens are held by the marketplace, so sellers can't move them mid-sale.
- **Pull payments**: sellers, creators, the fee recipient and outbid bidders are credited in
  `pendingWithdrawals` and call `withdraw()`. No settlement depends on a third party accepting ETH.
- **Auctions**: the first bid must meet the reserve, then each bid must beat the last by 5%. A bid placed in the
  last 10 minutes extends the auction by 10 minutes. After the end, anyone can call `settleAuction`.
- **Pausable**: pausing blocks new listings, purchases and bids. Cancels, settlements and withdrawals keep working.

## Usage

```sh
forge build
forge test                 # unit, fuzz and invariant tests
forge test --gas-report

# local
anvil
forge script script/Deploy.s.sol --rpc-url anvil --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# sepolia (uses the Foundry keystore `sepolia-deployer`; set FEE_RECIPIENT / FEE_BPS in the shell to override)
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --account sepolia-deployer
```
