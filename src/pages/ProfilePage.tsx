import { useState } from 'react'
import { useParams } from 'react-router'
import { isAddress } from 'viem'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { TokenGrid } from '@/components/TokenCard'
import { withdraw } from '@/lib/actions'
import { formatEth, shortAddress } from '@/lib/format'
import { useProfile } from '@/lib/queries'
import { useAction } from '@/lib/useAction'
import { NotFoundPage } from './NotFoundPage'

const TABS = [
  { id: 'owned', label: 'Owned' },
  { id: 'listed', label: 'Listed' },
  { id: 'created', label: 'Created' },
] as const

export function ProfilePage() {
  const { address: param } = useParams()
  const { address: me } = useConnection()
  const address = (param ?? me) as Address | undefined
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('owned')
  const { data: profile } = useProfile(address && isAddress(address) ? address : undefined)
  const action = useAction()
  const isMe = !!me && me.toLowerCase() === address?.toLowerCase()

  if (!address)
    return (
      <div className="px-4 pt-32 sm:px-8">
        <h1 className="display text-display-lg">Your profile</h1>
        <p className="mt-6 text-dim">Connect a wallet to see your NFTs.</p>
      </div>
    )
  if (!isAddress(address)) return <NotFoundPage />

  return (
    <div className="space-y-10 px-4 pt-32 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label mb-4">{isMe ? 'Your profile' : 'Profile'}</p>
          <h1 className="display text-display-lg">{shortAddress(address)}</h1>
        </div>
        {isMe && profile && profile.pendingWithdrawal > 0n && (
          <div className="flex items-center gap-6 border border-accent/50 p-5 shadow-[0_0_60px_-20px_rgb(77_141_255/0.5)]">
            <div>
              <p className="label">Available to withdraw</p>
              <p className="font-mono text-2xl">{formatEth(profile.pendingWithdrawal)} ETH</p>
            </div>
            <button type="button" className="btn btn-primary" disabled={action.busy} onClick={() => action.run(withdraw)}>
              Withdraw
            </button>
          </div>
        )}
      </header>
      {action.error && <p role="alert" className="font-mono text-xs text-error">{action.error}</p>}

      <div role="tablist" aria-label="Pieces" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            className="btn"
            onClick={() => setTab(t.id)}
          >
            {t.label} {profile && <span className="opacity-60">{profile[t.id].length}</span>}
          </button>
        ))}
      </div>

      <TokenGrid tokens={profile?.[tab]} empty="Nothing here yet." />
    </div>
  )
}
