import { useEffect, useRef } from 'react'

/*
 * A blue, slowly twinkling starfield fixed behind every page. Deeper stars are smaller, dimmer and
 * drift less when you scroll, which gives a gentle parallax. Plain 2D canvas: cheap enough to run
 * everywhere; it pauses in background tabs and holds still for reduced motion.
 */

interface Star {
  x: number // 0..1 of the viewport width
  y: number // 0..1 of a field one viewport tall; wraps
  depth: number // 0.15 (far) .. 1 (near)
  twinkle: number // phase
  speed: number // twinkle speed
}

/** Small seeded PRNG, so the sky is the same on every visit and between renders. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A soft round glow, pre-rendered once and stamped for the brighter stars. */
function makeGlow() {
  const size = 64
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = size
  const g = sprite.getContext('2d')!
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(205, 225, 255, 1)')
  gradient.addColorStop(0.12, 'rgba(150, 190, 255, 1)')
  gradient.addColorStop(0.32, 'rgba(77, 141, 255, 0.45)')
  gradient.addColorStop(1, 'rgba(77, 141, 255, 0)')
  g.fillStyle = gradient
  g.fillRect(0, 0, size, size)
  return sprite
}

export function StarField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const glow = makeGlow()
    let stars: Star[] = []
    let width = 0
    let height = 0
    let frame = 0

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const random = seeded(42)
      const count = Math.min(240, Math.round((width * height) / 6000))
      stars = Array.from({ length: count }, () => ({
        x: random(),
        y: random(),
        depth: 0.15 + Math.pow(random(), 2.2) * 0.85,
        twinkle: random() * Math.PI * 2,
        speed: 0.4 + random() * 1.6,
      }))
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height)
      const scroll = window.scrollY
      const t = time / 1000
      for (const s of stars) {
        // Parallax: near stars move further as the page scrolls; everything wraps vertically.
        const y = (((s.y * height - scroll * s.depth * 0.12) % height) + height) % height
        const x = s.x * width
        const flicker = still ? 1 : 0.65 + 0.35 * Math.sin(t * s.speed + s.twinkle)
        const alpha = (0.45 + s.depth * 0.55) * flicker
        // Every star is a soft round dot; the nearest few get a wider halo.
        const size = s.depth > 0.9 ? 14 + s.depth * 12 : 5 + s.depth * 7
        ctx!.globalAlpha = alpha
        ctx!.drawImage(glow, x - size / 2, y - size / 2, size, size)
      }
      ctx!.globalAlpha = 1
    }

    function loop(time: number) {
      draw(time)
      frame = requestAnimationFrame(loop)
    }

    resize()
    const onResize = () => {
      resize()
      if (still) draw(0)
    }
    const onScroll = () => still && draw(0)
    const onVisibility = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden && !still) frame = requestAnimationFrame(loop)
    }

    if (still) draw(0)
    else frame = requestAnimationFrame(loop)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* A faint blue haze behind the stars. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_10%,rgb(40_80_170/0.06),transparent_70%),radial-gradient(50%_45%_at_5%_75%,rgb(30_60_140/0.05),transparent_70%),radial-gradient(40%_35%_at_60%_95%,rgb(77_141_255/0.025),transparent_70%)]" />
      <canvas ref={ref} className="absolute inset-0 size-full" />
    </div>
  )
}
