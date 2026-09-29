import { useEffect, useRef, useState } from 'react'
import { ipfsImageSrcSet, ipfsPlaceholder, ipfsUrls } from '@/lib/ipfs'
import { useMetadata } from '@/lib/queries'

interface Props {
  tokenURI: string
  className?: string
  /** Rendered width hint for picking a `srcset` candidate. */
  sizes?: string
  priority?: boolean
  /** View-transition name, so the print can morph between pages. */
  transitionName?: string
  /** `contain` shows the whole artwork (detail pages); `cover` fills the frame (grids). */
  fit?: 'cover' | 'contain'
}

/**
 * A token's artwork, shown as a print developing: it appears as a negative and develops into the
 * positive once it has loaded and scrolled into view. Starts with resized WebP from our gateway;
 * if that fails, falls through plain gateway URLs one by one.
 */
export function TokenImage({
  tokenURI,
  className = '',
  sizes = '(min-width: 1024px) 25vw, 50vw',
  priority = false,
  transitionName,
  fit = 'cover',
}: Props) {
  const { data: metadata, isError } = useMetadata(tokenURI)
  // -1 = responsive srcset; 0..n = plain fallback gateways
  const [attempt, setAttempt] = useState(-1)
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(priority)
  const ref = useRef<HTMLDivElement>(null)
  const fallbacks = metadata ? ipfsUrls(metadata.image) : []
  const src = attempt === -1 ? fallbacks[0] : fallbacks[attempt]

  useEffect(() => {
    if (inView || !ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [inView])

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-ink-3 ${className}`}
      style={transitionName ? { viewTransitionName: transitionName } : undefined}
    >
      {metadata && attempt === -1 && (
        <img
          aria-hidden
          alt=""
          src={ipfsPlaceholder(metadata.image)}
          className={`absolute inset-0 size-full scale-110 blur-2xl ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
      )}
      {metadata && src ? (
        <img
          src={src}
          srcSet={attempt === -1 ? ipfsImageSrcSet(metadata.image) : undefined}
          sizes={attempt === -1 ? sizes : undefined}
          alt={metadata.name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={`develop relative size-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
          data-developed={loaded && inView}
          onLoad={() => setLoaded(true)}
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <div className="edge grid size-full place-items-center text-faint">
          {isError || (metadata && !src) ? 'Image unavailable' : 'Loading'}
        </div>
      )}
    </div>
  )
}
