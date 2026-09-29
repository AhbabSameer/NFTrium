# NFTrium

A marketplace for image NFTs on the Ethereum **Sepolia testnet**. Mint an image as an NFT, sell it at a fixed price
or in a timed auction, and earn a royalty every time it resells.

- **Browse without a wallet.** Listings, auctions and history are read from a public Sepolia RPC.
- **Fixed-price sales and English auctions.** Each bid must beat the last by 5%, and a bid in the final 10 minutes
  extends the auction by 10 minutes.
- **Escrow.** A listed NFT is held by the marketplace contract, so it can't change hands behind a buyer's back.
- **Creator royalties** of up to 5% via ERC-2981, paid on every sale through the marketplace.
- **Pull payments.** Sellers, creators, the platform and outbid bidders are credited and withdraw when they like.

## Deployed contracts (Sepolia)

| Contract | Address |
| --- | --- |
| `ImageNFT` | [`0xF4eBc0433626433A15D51Ba3A7Ab4b05CAFfC79C`](https://sepolia.etherscan.io/address/0xF4eBc0433626433A15D51Ba3A7Ab4b05CAFfC79C) |
| `NFTMarketplace` | [`0x338992Aa1eA01A0E02B7411245A8fE4eE1307d53`](https://sepolia.etherscan.io/address/0x338992Aa1eA01A0E02B7411245A8fE4eE1307d53) |

The marketplace is seeded with 31 NFTs: 13 for sale, 11 in auction and 7 held by the creator.

## Getting started

Requires **Node 26** (see `.nvmrc`) and, for the contracts, [Foundry](https://getfoundry.sh).

```sh
nvm use                # Node 26
npm install
cp .env.example .env   # or create .env by hand, see below
npm run dev
```

Browsing works with no configuration. **Minting** uploads images to IPFS through [Pinata](https://pinata.cloud), so
it needs a Pinata JWT in `.env`:

```sh
VITE_PINATA_JWT=your-pinata-jwt
```

The `VITE_` prefix means the key is bundled into the browser code. That's a deliberate trade-off for a testnet
project: anyone could use the key, including to unpin files. Use a key scoped to uploads only if that matters to you.

To buy, bid or mint you need a browser wallet (e.g. MetaMask) on Sepolia with some Sepolia ETH.

### Optional environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SEPOLIA_RPC_URL` | public RPCs | Your own Sepolia RPC, tried first |
| `VITE_IPFS_GATEWAY` | the project's Pinata gateway | IPFS gateway for metadata and images |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | Lint with Oxlint |
| `npm run codegen` | Rebuild the contracts and regenerate typed ABIs into `src/lib/contracts/generated.ts` |

## Tech stack

- **App:** React 19, React Router 8, TypeScript 7, Vite 8, Tailwind CSS 4
- **Web3:** wagmi 3, viem 2, TanStack Query; ABIs generated from the Foundry build with `@wagmi/cli`
- **Motion:** GSAP (ScrollTrigger, SplitText, Flip) with Lenis smooth scrolling, and anime.js for the "How it works"
  story
- **Contracts:** Solidity 0.8.30, OpenZeppelin 5.4, Foundry
- **Storage:** IPFS via Pinata
- **Tooling:** Oxlint

Everything respects `prefers-reduced-motion`: the site stays fully usable with animations off.

## Project structure

```
contracts/            Foundry project: ImageNFT + NFTMarketplace, tests, deploy and seed scripts
scripts/seed/         Uploads the sample collection to IPFS and writes the seed manifest
src/
  pages/              Home, Explore, Token, Create, Profile, 404 and error pages
  components/         Cards, token actions, hero wall, starfield, "How it works" story, layout
  lib/                Contract reads/writes, transactions, IPFS, errors, formatting
    contracts/        Addresses and generated ABIs
  motion/             GSAP setup, smooth scroll, text reveals
  styles.css          Design tokens and global styles
```

## Contracts

See [`contracts/README.md`](contracts/README.md) for the design, tests (unit, fuzz and invariant) and deploy commands.
In short:

```sh
cd contracts
forge test
forge script script/Deploy.s.sol --rpc-url sepolia --account <keystore> --broadcast
```

### Seeding a collection

1. Put images in `NFT-SAMPLES/` and describe them in `scripts/seed/catalog.json` (name, description, and whether each
   is for sale, in auction or kept, with a price or reserve).
2. Upload them to IPFS: `node --env-file=.env scripts/seed/upload.mjs`. This writes
   `contracts/script/seed-manifest.json`.
3. Mint, list and auction everything:
   `cd contracts && forge script script/Seed.s.sol --rpc-url sepolia --account <keystore> --broadcast --slow`

## Deploying

The site is a static build (`npm run build` → `dist/`). `netlify.toml` is set up for Netlify: set
`VITE_PINATA_JWT` in the site's environment variables, since it's embedded at build time.
