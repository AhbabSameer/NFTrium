import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { chain } from '@/lib/contracts'
import { humanizeError } from '@/lib/errors'
import { shortAddress } from '@/lib/format'

export function ConnectButton() {
  const { address, chainId, isConnected } = useConnection()
  const connectors = useConnectors()
  const connect = useConnect()
  const disconnect = useDisconnect()
  const switchChain = useSwitchChain()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (isConnected && address && chainId !== chain.id) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => switchChain.mutate({ chainId: chain.id })}>
        Switch to Sepolia
      </button>
    )
  }

  // EIP-6963 wallets announce themselves; hide the generic injected entry when real ones exist.
  const wallets = connectors.length > 1 ? connectors.filter((c) => c.id !== 'injected') : connectors

  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        {isConnected && address ? (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            {shortAddress(address)}
          </>
        ) : (
          'Connect'
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-72 border border-line-strong bg-ink-2 p-2">
          {isConnected && address ? (
            <>
              <Link role="menuitem" to={`/profile/${address}`} className="edge block p-3 hover:bg-ink-3" onClick={() => setOpen(false)}>
                Your profile
              </Link>
              <button role="menuitem" type="button" className="edge block w-full p-3 text-left hover:bg-ink-3" onClick={() => (disconnect.mutate(), setOpen(false))}>
                Disconnect
              </button>
            </>
          ) : wallets.length === 0 || !window.ethereum ? (
            <p className="p-3 text-sm text-dim">
              No browser wallet found.{' '}
              <a className="text-paper underline" href="https://metamask.io/download" target="_blank" rel="noreferrer">
                Install MetaMask
              </a>
            </p>
          ) : (
            wallets.map((connector) => (
              <button
                key={connector.uid}
                role="menuitem"
                type="button"
                className="edge flex w-full items-center gap-3 p-3 text-left hover:bg-ink-3"
                disabled={connect.isPending}
                onClick={() => connect.mutate({ connector }, { onSuccess: () => setOpen(false) })}
              >
                {connector.icon && <img src={connector.icon} alt="" className="size-5" />}
                {connector.name}
              </button>
            ))
          )}
          {connect.error && <p role="alert" className="p-3 text-xs text-error">{humanizeError(connect.error)}</p>}
        </div>
      )}
    </div>
  )
}

declare global {
  interface Window {
    ethereum?: unknown
  }
}
