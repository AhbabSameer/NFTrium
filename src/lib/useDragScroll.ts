import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Click-and-drag horizontal scrolling with a little momentum, for mouse users. Trackpad swipes and
 * Shift+wheel already scroll an `overflow-x: auto` element natively, and touch keeps native panning.
 * A drag suppresses the click that would otherwise fire on release, so links inside don't open.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let startX = 0
    let startScroll = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0 // px per ms
    let dragging = false
    let moved = false
    let frame = 0

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      cancelAnimationFrame(frame)
      dragging = true
      moved = false
      startX = lastX = e.clientX
      startScroll = el.scrollLeft
      lastT = performance.now()
      velocity = 0
    }

    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) > 4) {
        moved = true
        el.setPointerCapture(e.pointerId)
        el.style.cursor = 'grabbing'
      }
      if (!moved) return
      el.scrollLeft = startScroll - dx
      const now = performance.now()
      velocity = (e.clientX - lastX) / Math.max(1, now - lastT)
      lastX = e.clientX
      lastT = now
    }

    const glide = () => {
      if (Math.abs(velocity) < 0.02) return
      el.scrollLeft -= velocity * 16
      velocity *= 0.94
      frame = requestAnimationFrame(glide)
    }

    const onUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      el.style.cursor = ''
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (moved && !reduce) frame = requestAnimationFrame(glide)
    }

    // Swallow the click that ends a drag.
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault()
        e.stopPropagation()
        moved = false
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClick, true)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClick, true)
    }
  }, [ref])
}
