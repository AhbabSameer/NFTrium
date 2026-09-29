import { useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { explorerAddress, imageNft, marketplace } from '@/lib/contracts'
import { SmoothScroll } from '@/motion/SmoothScroll'
import { ConnectButton } from './ConnectButton'
import { StarField } from './StarField'
import { TxTray } from './TxTray'

const nav = [
  { to: '/explore', label: 'Explore' },
  { to: '/create', label: 'Create' },
  { to: '/profile', label: 'Profile' },
]

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const [lastPath, setLastPath] = useState(pathname)
  // Close the mobile menu whenever the route changes.
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setMenuOpen(false)
  }

  return (
    <SmoothScroll>
      <StarField />
      <a href="#main" className="btn sr-only bg-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]">
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-ink via-ink/70 to-transparent">
        <div className="flex items-center gap-8 px-4 py-4 sm:px-8">
          <Link to="/" viewTransition className="flex items-center gap-2.5" aria-label="NFTrium home">
            <span aria-hidden className="size-2 animate-[var(--animate-pulse-light)] rounded-full bg-accent shadow-[0_0_12px_2px_rgb(77_141_255/0.8)]" />
            <span className="display text-2xl leading-none italic">NFTrium</span>
          </Link>
          <nav aria-label="Main" className="hidden gap-6 md:flex">
            {nav.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                viewTransition
                className={({ isActive }) =>
                  `label transition-colors ${isActive ? 'text-paper' : 'hover:text-paper'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ConnectButton />
            <button
              type="button"
              className="btn px-3 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <nav id="mobile-menu" aria-label="Main" className="fixed inset-0 z-40 flex flex-col justify-end gap-2 bg-ink px-4 pb-16 md:hidden">
          {nav.map(({ to, label }) => (
            <NavLink key={to} to={to} viewTransition className="display text-display-lg">
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      <main id="main" className="min-h-dvh">
        <Outlet />
      </main>

      <Footer />
      <TxTray />
      <div aria-hidden className="vignette" />
      <div aria-hidden className="grain" />
      {/* Key by URL: fresh page loads all share the key "default", which restored the wrong page's position. */}
      <ScrollRestoration getKey={(location) => location.pathname + location.search} />
    </SmoothScroll>
  )
}

function Footer() {
  return (
    <footer className="relative mt-32 border-t border-line px-4 pt-16 pb-8 sm:px-8">
      <div className="grid gap-12 md:grid-cols-[1fr_auto]">
        <p className="display max-w-xl text-display-sm text-dim">
          Buy, sell and auction image NFTs. <span className="text-paper italic">Royalties for creators on every resale.</span>
        </p>
        <dl className="grid grid-cols-2 gap-x-10 gap-y-3 self-end">
          <dt className="label">Network</dt>
          <dd className="edge self-center">Sepolia testnet</dd>
          <dt className="label">NFT contract</dt>
          <dd className="edge self-center">
            <a className="hover:text-accent" href={explorerAddress(imageNft.address)} target="_blank" rel="noreferrer">
              ImageNFT ↗
            </a>
          </dd>
          <dt className="label">Marketplace</dt>
          <dd className="edge self-center">
            <a className="hover:text-accent" href={explorerAddress(marketplace.address)} target="_blank" rel="noreferrer">
              NFTMarketplace ↗
            </a>
          </dd>
        </dl>
      </div>
      <p aria-hidden className="display pointer-events-none mt-16 -mb-[0.18em] text-center text-[22vw] leading-none text-ink-3 select-none">
        NFTrium
      </p>
    </footer>
  )
}
