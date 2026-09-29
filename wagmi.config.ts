import { defineConfig } from '@wagmi/cli'
import { foundry } from '@wagmi/cli/plugins'

// Generates typed ABIs from the Foundry build: `npm run codegen`
export default defineConfig({
  out: 'src/lib/contracts/generated.ts',
  plugins: [
    foundry({
      project: 'contracts',
      include: ['ImageNFT.sol/**', 'NFTMarketplace.sol/**'],
      forge: { build: false }, // built by `npm run codegen`; the CLI mis-quotes paths with spaces
    }),
  ],
})
