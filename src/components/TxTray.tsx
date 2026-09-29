import { explorerTx } from '@/lib/contracts'
import { dismissTx, useTxs } from '@/lib/tx'
import type { TxStatus } from '@/lib/tx'

const STATUS: Record<TxStatus, string> = {
  preparing: 'Preparing',
  signing: 'Waiting for your wallet',
  pending: 'Confirming on-chain',
  confirmed: 'Confirmed',
  failed: 'Failed',
}

/** Live progress for every transaction the user starts. */
export function TxTray() {
  const txs = useTxs()

  return (
    <section aria-label="Transactions" aria-live="polite" className="fixed right-4 bottom-4 z-[65] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {txs.map((tx) => {
        const done = tx.status === 'confirmed' || tx.status === 'failed'
        return (
          <article key={tx.id} className="relative overflow-hidden border border-line-strong bg-ink-2/95 p-4 backdrop-blur">
            {!done && (
              <span aria-hidden className="absolute inset-x-0 top-0 h-px animate-pulse bg-accent shadow-[0_0_12px_rgb(77_141_255)]" />
            )}
            <header className="flex items-start justify-between gap-3">
              <h2 className="display text-xl">{tx.label}</h2>
              {done && (
                <button type="button" className="edge text-dim hover:text-paper" onClick={() => dismissTx(tx.id)} aria-label={`Dismiss ${tx.label}`}>
                  Close
                </button>
              )}
            </header>
            <p className={`edge mt-2 ${tx.status === 'failed' ? 'text-error normal-case tracking-normal' : 'text-dim'}`}>
              {tx.status === 'failed' ? tx.error : (tx.step ?? STATUS[tx.status])}
            </p>
            {tx.hash && (
              <a className="edge mt-3 inline-block text-dim hover:text-paper" href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">
                Etherscan ↗
              </a>
            )}
          </article>
        )
      })}
    </section>
  )
}
