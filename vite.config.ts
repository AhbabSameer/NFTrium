import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Pre-bundle the heavy libraries at startup; discovering them mid-session makes Vite re-optimize
  // and briefly serve two copies of React to open tabs ("Invalid hook call").
  optimizeDeps: {
    include: ['gsap', 'gsap/ScrollTrigger', 'gsap/SplitText', 'gsap/Flip', 'gsap/CustomEase', '@gsap/react', 'lenis', 'wagmi', 'viem', '@tanstack/react-query'],
  },
  build: {
    target: 'es2024',
    rolldownOptions: {
      output: {
        // Keep the web3 stack in its own long-cached chunk.
        codeSplitting: {
          groups: [
            { name: 'web3', test: /node_modules[\\/](viem|wagmi|@wagmi|@tanstack|ox|abitype|@noble|@scure)/ },
          ],
        },
      },
    },
  },
})
