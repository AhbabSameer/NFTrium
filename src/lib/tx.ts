import type { Hash, TransactionReceipt } from 'viem'
import { useSyncExternalStore } from 'react'
import { getConnection, switchChain, waitForTransactionReceipt } from 'wagmi/actions'
import { chain } from './contracts'
import { humanizeError } from './errors'
import { CHAIN_KEY } from './queries'
import { config, queryClient } from './wagmi'

export type TxStatus = 'preparing' | 'signing' | 'pending' | 'confirmed' | 'failed'

interface Tx {
  id: number
  label: string
  status: TxStatus
  /** Current step for multi-step flows, e.g. "Uploading image". */
  step?: string
  hash?: Hash
  error?: string
}

// A tiny global store so any component (e.g. a transaction tray) can follow every transaction.
let txs: Tx[] = []
const listeners = new Set<() => void>()
let nextId = 1

function update(id: number, patch: Partial<Tx>) {
  txs = txs.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx))
  listeners.forEach((l) => l())
}

export function dismissTx(id: number) {
  txs = txs.filter((tx) => tx.id !== id)
  listeners.forEach((l) => l())
}

export const useTxs = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => txs,
  )

export interface TxContext {
  /** Label the current off-chain step (uploads, checks). */
  step: (label: string) => void
  /** Ask the wallet to sign, then wait for the receipt. */
  send: (label: string, write: () => Promise<Hash>) => Promise<TransactionReceipt>
}

/**
 * Run a user action that may involve several steps and transactions, tracking its progress
 * in the global store. Chain state is refetched once it confirms. Throws a readable Error on failure.
 */
export async function runTx<T>(label: string, flow: (ctx: TxContext) => Promise<T>): Promise<T> {
  const id = nextId++
  txs = [...txs, { id, label, status: 'preparing' }]
  listeners.forEach((l) => l())

  const ctx: TxContext = {
    step: (step) => update(id, { status: 'preparing', step }),
    send: async (step, write) => {
      if (getConnection(config).chainId !== chain.id) {
        update(id, { status: 'signing', step: `Switch to ${chain.name}` })
        await switchChain(config, { chainId: chain.id })
      }
      update(id, { status: 'signing', step, hash: undefined })
      const hash = await write()
      update(id, { status: 'pending', hash })
      const receipt = await waitForTransactionReceipt(config, { hash })
      if (receipt.status !== 'success') throw new Error('The transaction reverted.')
      return receipt
    },
  }

  try {
    const result = await flow(ctx)
    update(id, { status: 'confirmed', step: undefined })
    await queryClient.invalidateQueries({ queryKey: [CHAIN_KEY] })
    return result
  } catch (error) {
    const message = humanizeError(error)
    update(id, { status: 'failed', error: message })
    throw new Error(message, { cause: error })
  }
}
