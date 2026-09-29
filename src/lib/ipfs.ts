/**
 * Our dedicated Pinata gateway: fast, CDN-backed, serves only our own pins, and resizes images
 * on the fly. Public gateways are fallbacks; they rate-limit hard and are slow.
 */
const PRIMARY_GATEWAY = (
  (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? 'https://gray-familiar-mockingbird-33.mypinata.cloud/ipfs'
).replace(/\/$/, '')

const GATEWAYS = [PRIMARY_GATEWAY, 'https://gateway.pinata.cloud/ipfs', 'https://ipfs.io/ipfs']

/** Strip `ipfs://`, `/ipfs/` prefixes and gateway hosts, leaving `<cid>[/path]`. */
function ipfsPath(uri: string): string {
  if (uri.startsWith('ipfs://')) return uri.slice('ipfs://'.length).replace(/^ipfs\//, '')
  const marker = uri.indexOf('/ipfs/')
  if (marker !== -1) return uri.slice(marker + '/ipfs/'.length)
  return uri
}

/** Every gateway URL for `uri`, best first. Non-IPFS HTTP URLs are returned as-is. */
export function ipfsUrls(uri: string): string[] {
  if (/^https?:\/\//.test(uri) && !uri.includes('/ipfs/')) return [uri]
  const path = ipfsPath(uri)
  return GATEWAYS.map((gateway) => `${gateway}/${path}`)
}

const IMAGE_WIDTHS = [400, 800, 1200, 1800]

/** A single resized WebP from our gateway, e.g. for WebGL textures. */
export const ipfsImageUrl = (uri: string, width: number) =>
  `${PRIMARY_GATEWAY}/${ipfsPath(uri)}?img-width=${width}&img-format=webp`

/** A tiny (≈2 KB) version to blur behind the real image while it loads. */
export const ipfsPlaceholder = (uri: string) => `${PRIMARY_GATEWAY}/${ipfsPath(uri)}?img-width=32&img-format=webp`

/** A resized, WebP-encoded `srcset` from the primary gateway, for responsive `<img>`s. */
export function ipfsImageSrcSet(uri: string): string {
  const base = `${PRIMARY_GATEWAY}/${ipfsPath(uri)}`
  return IMAGE_WIDTHS.map((w) => `${base}?img-width=${w}&img-format=webp ${w}w`).join(', ')
}

/** Fetch JSON from IPFS, falling through gateways until one answers. */
export async function fetchIpfsJson<T>(uri: string, signal?: AbortSignal): Promise<T> {
  let lastError: unknown
  for (const url of ipfsUrls(uri)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(8_000), ...(signal ? [signal] : [])]) })
      if (res.ok) return (await res.json()) as T
      lastError = new Error(`${res.status} from ${url}`)
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
    }
  }
  throw lastError
}

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined

/** Upload a file straight to IPFS through Pinata. Returns the CID. */
export async function uploadToIpfs(file: Blob, name: string): Promise<string> {
  if (!PINATA_JWT) throw new Error('Uploads aren’t set up: add VITE_PINATA_JWT to .env and restart the dev server.')
  const form = new FormData()
  form.append('network', 'public')
  form.append('file', file, name)
  const res = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const { data } = (await res.json()) as { data: { cid: string } }
  return data.cid
}
