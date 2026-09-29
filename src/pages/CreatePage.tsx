import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useConnection } from 'wagmi'
import { mint } from '@/lib/actions'
import { useAction } from '@/lib/useAction'

const ACCEPT = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
const MAX_BYTES = 10 * 1024 * 1024

export function CreatePage() {
  const { address } = useConnection()
  const navigate = useNavigate()
  const action = useAction()
  const ids = { file: useId(), name: useId(), description: useId(), royalty: useId() }

  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState<string>()
  const [fileError, setFileError] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [royalty, setRoyalty] = useState(5)

  // Free the preview's object URL when it's replaced or the page unmounts.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  function pick(next: File | undefined) {
    setFileError(undefined)
    if (!next) return
    if (!ACCEPT.includes(next.type)) return setFileError('Use a JPEG, PNG, GIF, WebP or AVIF image.')
    if (next.size > MAX_BYTES) return setFileError('Images must be 10 MB or smaller.')
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  const ready = !!address && !!file && name.trim().length > 0

  return (
    <div className="grid gap-12 px-4 pt-32 sm:px-8 lg:grid-cols-2 lg:gap-16">
      {/* Drag-and-drop is a pointer enhancement; keyboard users reach the same input via this label. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <label
        htmlFor={ids.file}
        className={`relative grid aspect-[4/5] cursor-pointer place-items-center overflow-hidden border border-dashed bg-ink-2 transition-colors lg:sticky lg:top-24 ${dragging ? 'border-accent bg-accent-deep/20' : 'border-line-strong hover:border-paper'}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          pick(e.dataTransfer.files[0])
        }}
      >
        {preview ? (
          <>
            <img src={preview} alt="Preview of your NFT" className="size-full object-contain" />
            <span className="edge absolute right-3 bottom-3 bg-ink/80 px-2 py-1">Replace</span>
          </>
        ) : (
          <span className="p-8 text-center">
            <span className="display block text-display-sm">Drop your image here</span>
            <span className="edge mt-4 block text-dim">or click to choose · JPEG, PNG, GIF, WebP, AVIF · 10 MB</span>
          </span>
        )}
      </label>

      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ready) return
          action.run(async () => {
            const tokenId = await mint({
              image: file,
              name: name.trim(),
              description: description.trim(),
              royaltyBps: royalty * 100,
            })
            navigate(`/token/${tokenId}`)
          })
        }}
      >
        <div>
          <p className="label mb-4">Mint a new NFT</p>
          <h1 className="display text-display-lg">Create an NFT</h1>
        </div>

        <input
          id={ids.file}
          type="file"
          accept={ACCEPT.join(',')}
          className="sr-only"
          aria-label="Image"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {fileError && (
          <p role="alert" className="text-sm text-error">
            {fileError}
          </p>
        )}
        {file && <p className="edge text-dim">{file.name}</p>}

        <div className="space-y-1">
          <label htmlFor={ids.name} className="label">
            Title
          </label>
          <input id={ids.name} className="field" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-1">
          <label htmlFor={ids.description} className="label">
            Description
          </label>
          <textarea
            id={ids.description}
            className="field min-h-28"
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={ids.royalty} className="label">
            Royalty on resales: {royalty}%
          </label>
          <input
            id={ids.royalty}
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={royalty}
            onChange={(e) => setRoyalty(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={!ready || action.busy}>
          {address ? 'Mint NFT' : 'Connect a wallet to mint'}
        </button>
        {action.error && (
          <p role="alert" className="edge text-error normal-case tracking-normal">
            {action.error}
          </p>
        )}
      </form>
    </div>
  )
}
