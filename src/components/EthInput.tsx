import { useId } from 'react'
import { parseEther } from 'viem'

/** Parse a user-typed ETH amount; undefined if it isn't a positive number. */
export function parseEthInput(value: string): bigint | undefined {
  if (!/^\d*\.?\d{0,18}$/.test(value.trim()) || !value.trim() || value.trim() === '.') return undefined
  const wei = parseEther(value.trim())
  return wei > 0n ? wei : undefined
}

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
}

export function EthInput({ label, value, onChange, hint }: Props) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          className="field"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(',', '.'))}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <span className="font-mono text-sm text-dim">ETH</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-dim">
          {hint}
        </p>
      )}
    </div>
  )
}
