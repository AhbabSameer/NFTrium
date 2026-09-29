import Lenis from 'lenis'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { ScrollTrigger, gsap, reducedMotion } from './gsap'

/** Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger and Lenis share one clock. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenis = useRef<Lenis | null>(null)
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (reducedMotion()) return
    const instance = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, autoRaf: false })
    const tick = (time: number) => instance.raf(time * 1000)
    instance.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    lenis.current = instance
    return () => {
      gsap.ticker.remove(tick)
      instance.destroy()
      lenis.current = null
    }
  }, [])

  // New pages start at the top; back/forward keeps the browser's restored position.
  useEffect(() => {
    if (navigationType !== 'POP') lenis.current?.scrollTo(0, { immediate: true })
    requestAnimationFrame(() => ScrollTrigger.refresh())
    // `pathname` is deliberately a trigger-only dependency.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [pathname, navigationType])

  return children
}
