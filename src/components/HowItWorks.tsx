import { createScope, createTimeline } from 'animejs'
import type { Timeline } from 'animejs'
import { useEffect, useEffectEvent, useRef } from 'react'
import type { ReactNode } from 'react'

/*
 * "How it works" told as a story: one real NFT from the collection, followed from upload to payout.
 * Each scene is an anime.js timeline that plays while the scene is on screen and loops.
 */

interface SceneProps {
  image?: string
  name: string
}

type Build = (tl: Timeline, root: HTMLElement) => void

/**
 * Run a looping anime.js timeline for a scene while it's visible; show the end state if motion is reduced.
 * The timeline is rebuilt when `key` changes (e.g. once the NFT's real name has loaded).
 */
function useScene(build: Build, key: string) {
  const root = useRef<HTMLDivElement>(null)
  // Always calls the latest `build` without making it an effect dependency.
  const buildTimeline = useEffectEvent(build)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scope = createScope({ root: el }).add(() => {
      const tl = createTimeline({
        autoplay: false,
        loop: true,
        loopDelay: 900,
        defaults: { ease: 'outExpo', duration: 700 },
      })
      try {
        buildTimeline(tl, el)
      } catch (error) {
        // A broken animation must never take the page down; the scene just stays static.
        console.warn('HowItWorks scene failed to build', error)
        return
      }
      if (reduce) {
        tl.seek(tl.duration)
        return
      }
      const observer = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? tl.play() : tl.pause()), {
        threshold: 0.35,
      })
      observer.observe(el)
      return () => observer.disconnect()
    })
    return () => scope.revert()
    // `key` is a deliberate rebuild trigger.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [key])

  return root
}

/** Animate a number shown in `selector` from `from` to `to`. */
function count(
  tl: Timeline,
  root: HTMLElement,
  selector: string,
  from: number,
  to: number,
  format: (n: number) => string,
  position: string | number,
  duration = 900,
) {
  const target = root.querySelector(selector)
  const value = { n: from }
  tl.add(value, { n: [from, to], duration, ease: 'outQuad', onUpdate: () => target && (target.textContent = format(value.n)) }, position)
}

const eth = (n: number) => `${n.toFixed(3)} ETH`
const clock = (s: number) => {
  const total = Math.max(0, Math.round(s))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/* ─── Shared scene pieces ────────────────────────────────────────────────── */

function Stage({ children, label, sceneRef }: { children: ReactNode; label: string; sceneRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <figure className="relative">
      {/* Soft halo so the panel floats off the page. */}
      <div aria-hidden className="absolute -inset-8 rounded-[3rem] bg-[radial-gradient(55%_55%_at_50%_45%,rgb(77_141_255/0.16),transparent_70%)] blur-2xl" />
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-[#131826] to-[#0a0c12] shadow-[0_40px_90px_-40px_rgb(0_0_0/0.9)] ring-1 ring-white/10">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(75%_70%_at_50%_40%,black,transparent)]"
        />
        <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <figcaption className="sr-only">{label}</figcaption>
        <div ref={sceneRef} aria-hidden className="absolute inset-0 font-sans">
          {children}
        </div>
      </div>
    </figure>
  )
}

/** The NFT itself: rounded, lifted, with a hairline highlight. */
function Art({ image, className = '' }: { image?: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl shadow-[0_24px_50px_-18px_rgb(0_0_0/0.95)] ring-1 ring-white/15 ${className}`}>
      {image ? (
        <img src={image} alt="" draggable={false} className="size-full object-cover" />
      ) : (
        <div className="size-full bg-gradient-to-br from-accent/40 to-ink-3" />
      )}
    </div>
  )
}

const CHIP = {
  glass: 'bg-white/[0.06] text-dim ring-1 ring-white/10 backdrop-blur-md',
  accent: 'bg-accent/15 text-accent ring-1 ring-accent/40 backdrop-blur-md',
  solid: 'bg-accent text-ink shadow-[0_10px_30px_-8px_rgb(77_141_255/0.9)]',
  paper: 'bg-paper text-ink shadow-[0_10px_24px_-8px_rgb(0_0_0/0.9)]',
}

function Chip({ tone = 'glass', className = '', children }: { tone?: keyof typeof CHIP; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium whitespace-nowrap ${CHIP[tone]} ${className}`}>
      {children}
    </span>
  )
}

/** A small gradient avatar, like a wallet identicon. */
function Avatar({ hue, className = '' }: { hue: number; className?: string }) {
  return (
    <span
      className={`inline-block size-5 shrink-0 rounded-full ring-1 ring-white/20 ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 90% 65%), hsl(${hue + 60} 80% 45%))` }}
    />
  )
}

/** A pointer that moves around the scene and "clicks" things. */
function Cursor({ className }: { className: string }) {
  return (
    <svg className={`s-cursor pointer-events-none absolute z-20 size-6 drop-shadow-[0_3px_6px_rgb(0_0_0/0.7)] ${className}`} viewBox="0 0 24 24">
      <path d="M5 3l14 8.2-6.2 1.5L9.6 19z" fill="#f4f6fa" stroke="#08090c" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function Panel({ className = '', children }: { className?: string; children?: ReactNode }) {
  return <div className={`rounded-2xl bg-white/[0.035] ring-1 ring-white/10 ${className}`}>{children}</div>
}

/* ─── Scene 1: Create ────────────────────────────────────────────────────── */

function CreateScene({ image, name }: SceneProps) {
  const fileName = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.webp`

  // Positions are the centres of things, as % of the stage. The drop zone is centred at (50%, 35%).
  const ref = useScene((tl, root) => {
    const status = root.querySelector('.s-status')
    const setStatus = (text: string) => () => void (status && (status.textContent = text))
    tl.call(setStatus(`Uploading ${fileName} to IPFS`), 0)
      .add('.s-file', { opacity: [0, 1], scale: [0.85, 1], duration: 450, ease: 'outBack(1.8)' }, 0)
      .add('.s-cursor', { left: ['30%', '24%'], top: ['92%', '84%'], opacity: [0, 1], duration: 450, ease: 'outCubic' }, 150)
      // Grab: the file lifts off the desk.
      .add('.s-cursor', { scale: [1, 0.82], duration: 140, ease: 'outQuad' }, '+=60')
      .add('.s-file', { scale: [1, 1.05], rotate: [0, -3], duration: 200, ease: 'outQuad' }, '<<')
      // Drag it into the drop zone.
      .add('.s-file', { left: ['20%', '50%'], top: ['80%', '35%'], rotate: [-3, 2], duration: 850, ease: 'inOutCubic' }, '+=40')
      .add('.s-cursor', { left: ['24%', '54%'], top: ['84%', '39%'], duration: 850, ease: 'inOutCubic' }, '<<')
      .add(
        '.s-drop',
        { borderColor: ['rgba(255, 255, 255, 0.15)', 'rgba(77, 141, 255, 0.9)'], backgroundColor: ['rgba(255, 255, 255, 0.02)', 'rgba(77, 141, 255, 0.1)'], scale: [1, 1.03], duration: 280 },
        '<<+=480',
      )
      // Drop: the file becomes the artwork.
      .add('.s-cursor', { scale: [0.82, 1], duration: 140, ease: 'outQuad' }, '+=120')
      .add('.s-file', { scale: [1.05, 0.6], opacity: [1, 0], duration: 320, ease: 'inQuad' }, '<<')
      .add('.s-img', { opacity: [0, 1], scale: [0.9, 1], duration: 550, ease: 'outBack(1.6)' }, '<<+=120')
      .add('.s-drop', { opacity: [1, 0], duration: 250 }, '<<')
      // Upload to IPFS while the cursor heads for the button.
      .add('.s-upload', { opacity: [0, 1], y: [8, 0], duration: 300 }, '<+=50')
      .add('.s-fill', { scaleX: [0, 1], duration: 1100, ease: 'inOutQuad' }, '<<')
    count(tl, root, '.s-pct', 0, 100, (n) => `${Math.round(n)}%`, '<<', 1100)
    tl.call(setStatus(`✓ Uploaded ${fileName}`), '<')
      .add('.s-cursor', { left: ['54%', '53%'], top: ['39%', '86%'], duration: 700, ease: 'inOutCubic' }, '<<+=250')
      .add('.s-mint', { scale: [1, 0.92, 1], duration: 320, ease: 'outQuad' }, '+=120')
      .add('.s-cursor', { scale: [1, 0.8, 1], duration: 320, ease: 'outQuad' }, '<<')
      .add('.s-glow', { opacity: [0, 1], scale: [0.85, 1], duration: 700 }, '<+=40')
      .add('.s-badge', { opacity: [0, 1], y: [12, 0], scale: [0.8, 1], duration: 550, ease: 'outBack(2)' }, '<<+=80')
      .add('.s-royalty', { opacity: [0, 1], y: [12, 0], scale: [0.8, 1], duration: 550, ease: 'outBack(2)' }, '<+=100')
      .add('.s-cursor', { opacity: [1, 0], duration: 300 }, '+=200')
  }, name)

  return (
    <Stage sceneRef={ref} label={`Animation: the file ${fileName} is dragged in, uploaded to IPFS and minted as an NFT with a 5% royalty.`}>
      <div className="s-drop absolute top-[8%] left-1/2 grid aspect-square h-[54%] -translate-x-1/2 place-items-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02]">
        <span className="flex flex-col items-center gap-2 text-xs text-faint">
          <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Drop your image
        </span>
      </div>
      <div className="s-glow absolute top-[8%] left-1/2 aspect-square h-[54%] -translate-x-1/2 rounded-3xl bg-accent/50 opacity-0 blur-2xl" />
      {/* Animate a stable wrapper: the <img> inside is swapped in once metadata loads. */}
      <div className="s-img absolute top-[8%] left-1/2 aspect-square h-[54%] -translate-x-1/2 opacity-0">
        <Art image={image} className="size-full" />
      </div>

      {/* The file being uploaded, as it would look dragged from the desktop. */}
      <div className="s-file absolute top-[80%] left-[20%] z-10 flex w-[36%] -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-xl bg-[#1b2131] p-2 opacity-0 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.9)] ring-1 ring-white/15">
        <Art image={image} className="aspect-square w-9 shrink-0 rounded-lg" />
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-medium text-paper">{fileName}</span>
          <span className="block text-[10px] text-faint">WebP image · 2.4 MB</span>
        </span>
      </div>

      <div className="s-upload absolute top-[69%] right-[20%] left-[20%] opacity-0">
        <div className="mb-2 flex justify-between gap-3 text-[11px] text-dim">
          <span className="s-status truncate">Uploading {fileName} to IPFS</span>
          <span className="s-pct font-mono tabular-nums">0%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="s-fill h-full origin-left rounded-full bg-gradient-to-r from-accent to-[#7fd3ff] shadow-[0_0_12px_rgb(77_141_255)]" style={{ transform: 'scaleX(0)' }} />
        </div>
      </div>
      <div className="s-mint btn btn-primary pointer-events-none absolute bottom-[6%] left-1/2 min-h-10 -translate-x-1/2">Mint NFT</div>
      <Chip tone="solid" className="s-badge absolute top-[9%] right-[5%] opacity-0">✓ Minted · #032</Chip>
      <Chip tone="accent" className="s-royalty absolute top-[19%] right-[5%] opacity-0">5% royalty</Chip>
      <Cursor className="top-[92%] left-[30%] opacity-0" />
    </Stage>
  )
}

/* ─── Scene 2: List ──────────────────────────────────────────────────────── */

function ListScene({ image, name }: SceneProps) {
  const ref = useScene((tl, root) => {
    tl.add('.s-card', { opacity: [0, 1], scale: [0.9, 1], y: [10, 0], duration: 550 }, 100)
      .add('.s-tag', { opacity: [0, 1], y: [8, 0], scale: [0.8, 1], ease: 'outBack(2)' }, '+=120')
    count(tl, root, '.s-price', 0, 0.05, eth, '<<', 700)
    // The card is 28% of the stage wide; the escrow panel's centre is 50% of the stage further right = 178.6% of the card.
    tl.add('.s-card', { x: ['0%', '178.6%'], rotate: [0, 4, 0], duration: 1000, ease: 'inOutCubic' }, '+=250')
      .add('.s-escrow', { backgroundColor: ['rgba(77, 141, 255, 0.05)', 'rgba(77, 141, 255, 0.12)'], duration: 500 }, '-=250')
      .add('.s-shackle', { y: [-5, 0], duration: 380, ease: 'outBack(2.5)' }, '+=40')
      .add('.s-lock', { scale: [1, 1.25, 1], duration: 500 }, '<<')
      .add('.s-listed', { opacity: [0, 1], y: [12, 0], scale: [0.8, 1], ease: 'outBack(2)' }, '<+=120')
  }, name)

  return (
    <Stage sceneRef={ref} label={`Animation: ${name} is priced at 0.05 ETH and moved into the marketplace's escrow.`}>
      <Panel className="absolute top-[10%] bottom-[18%] left-[5%] w-[40%]">
        <div className="flex items-center gap-2 p-3 text-[11px] text-dim">
          <Avatar hue={210} />
          Your wallet
        </div>
      </Panel>
      <div className="s-escrow absolute top-[10%] right-[5%] bottom-[18%] w-[40%] rounded-2xl bg-accent/5 ring-1 ring-accent/30">
        <div className="flex items-center gap-2 p-3 text-[11px] text-accent">
          <span className="s-lock grid size-5 place-items-center rounded-full bg-accent/20">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path className="s-shackle" d="M8 10V7.5a4 4 0 018 0V10" strokeLinecap="round" style={{ transform: 'translateY(-5px)' }} />
              <rect x="5.5" y="10" width="13" height="10" rx="2.5" />
            </svg>
          </span>
          Marketplace escrow
        </div>
      </div>
      <div className="s-card absolute top-[26%] left-[11%] w-[28%] opacity-0">
        <Art image={image} className="aspect-square w-full" />
        <Chip tone="paper" className="s-tag absolute -bottom-3 left-1/2 -translate-x-1/2 font-mono opacity-0">
          <span className="s-price tabular-nums">0.000 ETH</span>
        </Chip>
      </div>
      <Chip tone="solid" className="s-listed absolute bottom-[6%] left-1/2 -translate-x-1/2 opacity-0">
        ✓ Listed for sale
      </Chip>
    </Stage>
  )
}

/* ─── Scene 3: Bid ───────────────────────────────────────────────────────── */

const BIDS = [
  { who: '0x3f…a1', amount: 0.05, hue: 20 },
  { who: '0x9c…77', amount: 0.0525, hue: 150 },
  { who: 'You', amount: 0.0552, hue: 210 },
]

function BidScene({ image, name }: SceneProps) {
  const ref = useScene((tl, root) => {
    count(tl, root, '.s-timer', 58, 40, clock, 0, 1200)
    tl.add('.s-bid-0', { opacity: [0, 1], y: [14, 0], duration: 500 }, 150)
      .add('.s-bid-1', { opacity: [0, 1], y: [14, 0], duration: 500 }, '+=400')
      .add('.s-out-0', { opacity: [0, 1], scale: [0.8, 1], ease: 'outBack(2)' }, '<+=150')
      .add('.s-row-0', { opacity: [1, 0.45], duration: 500 }, '<<')
      .add('.s-coin-0', { opacity: [0, 1, 1, 0], left: ['70%', '12%'], top: ['40%', '88%'], scale: [1, 0.6], duration: 800, ease: 'inOutQuad' }, '<<')
      .add('.s-balance', { scale: [1, 1.1, 1], duration: 400 }, '<+=500')
    count(tl, root, '.s-timer', 40, 8, clock, '<<', 1000)
    tl.add('.s-bid-2', { opacity: [0, 1], y: [14, 0], duration: 500 }, '<+=100')
      .add('.s-out-1', { opacity: [0, 1], scale: [0.8, 1], ease: 'outBack(2)' }, '<+=150')
      .add('.s-row-1', { opacity: [1, 0.45], duration: 500 }, '<<')
      .add('.s-extend', { opacity: [0, 1], y: [10, 0], scale: [0.85, 1], ease: 'outBack(2)' }, '<+=200')
      .add('.s-timerpill', { backgroundColor: ['rgba(255, 255, 255, 0.06)', 'rgba(77, 141, 255, 0.2)'], duration: 300 }, '<<')
    count(tl, root, '.s-timer', 8, 608, clock, '<<+=150', 700)
  }, name)

  return (
    <Stage sceneRef={ref} label={`Animation: bidders compete for ${name}; outbid ETH is refunded and a late bid extends the timer.`}>
      <Panel className="absolute top-[6%] right-[5%] left-[5%] flex items-center gap-3 p-2.5">
        <Art image={image} className="aspect-square w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-paper">{name}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-dim">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" /> Live auction
          </p>
        </div>
        <span className="s-timerpill rounded-full bg-white/[0.06] px-3 py-1.5 font-mono text-sm text-paper tabular-nums ring-1 ring-white/10">
          <span className="s-timer">00:58</span>
        </span>
      </Panel>
      <ol className="absolute top-[31%] right-[5%] left-[5%] space-y-2">
        {BIDS.map((b, i) => (
          <li
            key={b.who}
            className={`s-bid-${i} flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-0 ring-1 ${b.who === 'You' ? 'bg-accent/10 ring-accent/50' : 'bg-white/[0.035] ring-white/10'}`}
          >
            <span className={`s-row-${i} flex flex-1 items-center gap-3`}>
              <Avatar hue={b.hue} />
              <span className="text-xs text-paper">{b.who}</span>
            </span>
            {i < 2 && (
              <Chip className={`s-out-${i} px-2! py-1! opacity-0`}>
                Outbid · refunded
              </Chip>
            )}
            <span className="font-mono text-xs text-paper tabular-nums">{b.amount.toFixed(4)} ETH</span>
          </li>
        ))}
      </ol>
      <span className="s-coin-0 absolute top-[40%] left-[70%] z-10 size-4 rounded-full bg-gradient-to-br from-[#9cc2ff] to-accent opacity-0 shadow-[0_0_14px_rgb(77_141_255)]" />
      <Chip className="s-balance absolute bottom-[6%] left-[5%]">↺ Refund credited to bidder</Chip>
      <Chip tone="solid" className="s-extend absolute right-[5%] bottom-[6%] opacity-0">
        Late bid · +10 min
      </Chip>
    </Stage>
  )
}

/* ─── Scene 4: Get paid ──────────────────────────────────────────────────── */

const SPLIT = [
  { label: 'Seller', share: 0.85, bar: 'bg-gradient-to-r from-accent to-[#7fd3ff]' },
  { label: 'Creator royalty', share: 0.05, bar: 'bg-paper/80' },
  { label: 'Platform fee', share: 0.1, bar: 'bg-white/40' },
]

function PaidScene({ image, name }: SceneProps) {
  const ref = useScene((tl, root) => {
    tl.add('.s-ended', { opacity: [0, 1], y: [8, 0], scale: [0.85, 1], ease: 'outBack(2)' }, 80)
      // Card is 22% of the stage wide; the winner panel's inner slot is 59% further right = 268% of the card.
      .add('.s-card', { x: ['0%', '268%'], y: ['0%', '22%'], rotate: [0, 5, 0], duration: 950, ease: 'inOutCubic' }, '+=150')
      .add('.s-winner', { backgroundColor: ['rgba(255, 255, 255, 0.035)', 'rgba(77, 141, 255, 0.12)'], duration: 450 }, '-=200')
    SPLIT.forEach((s, i) => {
      tl.add(`.s-fill-${i}`, { scaleX: [0, s.share / 0.85], duration: 700, ease: 'outCubic' }, i === 0 ? '+=120' : '<<+=120')
      count(tl, root, `.s-amt-${i}`, 0, 0.0552 * s.share, (n) => n.toFixed(4), '<<', 700)
    })
    tl.add('.s-withdraw', { opacity: [0, 1], y: [10, 0] }, '+=120')
      .add('.s-cursor', { left: ['60%', '17%'], top: ['70%', '90%'], opacity: [0, 1], duration: 700, ease: 'inOutCubic' }, '<<')
      .add('.s-withdraw', { scale: [1, 0.9, 1], duration: 360, ease: 'outQuad' }, '+=60')
      .add('.s-cursor', { scale: [1, 0.8, 1], duration: 360, ease: 'outQuad' }, '<<')
      .add('.s-done', { opacity: [0, 1], x: [-8, 0], scale: [0.9, 1], ease: 'outBack(2)' }, '<+=150')
      .add('.s-cursor', { opacity: [1, 0], duration: 300 }, '+=250')
  }, name)

  return (
    <Stage sceneRef={ref} label={`Animation: ${name} goes to the winner and 0.0552 ETH is split between seller, creator and platform.`}>
      <Chip className="s-ended absolute top-[6%] left-[5%] opacity-0">Auction ended · 0.0552 ETH</Chip>
      <div className="s-card absolute top-[18%] left-[8%] w-[22%]">
        <Art image={image} className="aspect-square w-full" />
      </div>
      <div className="s-winner absolute top-[14%] right-[7%] aspect-[1/1.1] w-[30%] rounded-2xl bg-white/[0.035] ring-1 ring-white/10">
        <div className="flex items-center gap-2 p-3 text-[11px] text-dim">
          <Avatar hue={210} />
          Winner
        </div>
      </div>
      <ul className="absolute right-[5%] bottom-[22%] left-[5%] space-y-2.5">
        {SPLIT.map((s, i) => (
          <li key={s.label} className="grid grid-cols-[6.5rem_1fr_3.75rem] items-center gap-3 text-[11px]">
            <span className="text-dim">{s.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <span className={`s-fill-${i} block h-full origin-left rounded-full ${s.bar}`} style={{ transform: 'scaleX(0)' }} />
            </span>
            <span className={`s-amt-${i} text-right font-mono text-paper tabular-nums`}>0.0000</span>
          </li>
        ))}
      </ul>
      <div className="absolute right-[5%] bottom-[5%] left-[5%] flex items-center gap-3">
        <span className="s-withdraw btn btn-primary pointer-events-none min-h-9 opacity-0">Withdraw</span>
        <Chip tone="accent" className="s-done opacity-0">
          ✓ 0.0469 ETH sent to the seller
        </Chip>
      </div>
      <Cursor className="top-[70%] left-[60%] opacity-0" />
    </Stage>
  )
}

/* ─── The section ────────────────────────────────────────────────────────── */

const STEPS = [
  {
    title: 'Create',
    body: 'Upload an image and mint it. The file is stored on IPFS and the NFT is recorded on Ethereum, with your royalty (up to 5%) attached for good.',
    Scene: CreateScene,
  },
  {
    title: 'List',
    body: 'Set a fixed price or start a timed auction. The NFT moves into escrow: the marketplace contract holds it, so it can’t change hands behind a buyer’s back.',
    Scene: ListScene,
  },
  {
    title: 'Bid',
    body: 'Each bid must beat the last by 5%. Outbid? Your ETH is credited straight back. A bid in the final 10 minutes adds 10 more, so nobody gets sniped.',
    Scene: BidScene,
  },
  {
    title: 'Get paid',
    body: 'When the sale settles, the buyer receives the NFT and the price is split between the seller, the creator’s royalty and the platform. Everyone withdraws their share whenever they like.',
    Scene: PaidScene,
  },
] as const

export function HowItWorks({ image, name }: SceneProps) {
  return (
    <section aria-labelledby="how" className="px-4 py-24 sm:px-8">
      <header className="mx-auto mb-20 max-w-3xl text-center">
        <p className="label mb-4">03 — How it works</p>
        <h2 id="how" className="display text-display-lg">
          The life of an NFT
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-dim">
          Follow <span className="text-paper">{name}</span> from upload to payout.
        </p>
      </header>
      <ol className="relative mx-auto max-w-6xl space-y-24 lg:space-y-36">
        {STEPS.map(({ title, body, Scene }, i) => (
          <li key={title} className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
            <div className={i % 2 ? 'lg:order-2' : ''}>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/30">
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-semibold text-ink">{i + 1}</span>
                Step {i + 1} of {STEPS.length}
              </span>
              <h3 className="display mt-5 text-display-md">{title}</h3>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-dim">{body}</p>
            </div>
            <Scene image={image} name={name} />
          </li>
        ))}
      </ol>
    </section>
  )
}
