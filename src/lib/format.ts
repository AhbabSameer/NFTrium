import { formatEther } from 'viem'

/** Trim to at most 4 decimals without rounding up: 0.012345 → "0.0123". */
export function formatEth(wei: bigint): string {
  const [whole, frac = ''] = formatEther(wei).split('.')
  const trimmed = frac.slice(0, 4).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole!
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

const pad = (n: number) => String(n).padStart(2, '0')

/** "2d 04h", "3h 12m", "4m 09s". */
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return 'ended'
  const d = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3_600)
  const m = Math.floor((seconds % 3_600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${pad(h)}h`
  if (h > 0) return `${h}h ${pad(m)}m`
  return `${m}m ${pad(s)}s`
}
