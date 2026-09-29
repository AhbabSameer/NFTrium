import { useRef } from 'react'
import type { ReactNode } from 'react'
import { SplitText, gsap, reducedMotion, useGSAP } from './gsap'

interface Props {
  as?: 'div' | 'p' | 'span' | 'h1' | 'h2' | 'h3'
  children: ReactNode
  className?: string
  /** Seconds before the reveal starts. */
  delay?: number
  /** Reveal on mount instead of when scrolled into view. */
  immediate?: boolean
}

/**
 * Text that rises line by line out of a mask, the way a print surfaces in the tray.
 * Real text stays in the DOM, so it's readable by screen readers and search engines.
 */
export function Reveal({ as: Tag = 'div', children, className, delay = 0, immediate = false }: Props) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      if (!ref.current || reducedMotion()) return
      SplitText.create(ref.current, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (split) =>
          gsap.from(split.lines, {
            yPercent: 110,
            duration: 1.4,
            stagger: 0.09,
            delay,
            ease: 'nftrium.out',
            scrollTrigger: immediate ? undefined : { trigger: ref.current, start: 'top 88%', once: true },
          }),
      })
    },
    { scope: ref },
  )

  // Every allowed tag is a plain HTMLElement; typing it as `div` keeps the ref assignable.
  const Element = Tag as 'div'
  return (
    <Element ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </Element>
  )
}
