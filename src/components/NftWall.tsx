import { Link } from 'react-router'
import { tokenNumber } from './TokenCard'

/*
 * The hero's NFT wall, after Zenless Zone Zero's agent roster: slanted panels in columns tilted away
 * from the copy, moving like side-by-side escalators (up, down, up, down) at one shared speed.
 */

export interface WallItem {
  id: bigint
  name: string
  image: string
}

// Escalators: columns alternate up and down at the same speed; each starts a step lower than the last.
const LOOP_SECONDS = 60
const STEP = 9 // % of the column height between neighbouring columns
const COLUMN_COUNT = 4

const MIN_PER_COLUMN = 6

/**
 * Deal items round-robin into columns, repeating them so every column is tall enough to loop and
 * holds the same number of panels (equal heights = equal speeds, which the escalator needs).
 */
function deal(items: WallItem[], columns: number) {
  const out: WallItem[][] = Array.from({ length: columns }, () => [])
  if (items.length === 0) return out
  const total = Math.max(columns * MIN_PER_COLUMN, Math.ceil(items.length / columns) * columns)
  for (let i = 0; i < total; i++) out[i % columns]!.push(items[(i * 7) % items.length]!)
  return out
}

function Panel({ item, interactive }: { item: WallItem; interactive: boolean }) {
  const content = (
    <>
      <img src={item.image} alt="" draggable={false} loading="lazy" decoding="async" className="size-full scale-110 object-cover transition-transform duration-700 group-hover/panel:scale-100" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
      <div className="absolute right-[4%] bottom-3 left-[14%]">
        <p className="edge text-[10px] text-accent">{tokenNumber(item.id)}</p>
        <p className="display truncate text-lg leading-tight text-paper">{item.name}</p>
      </div>
    </>
  )
  const className =
    'group/panel relative block aspect-[3/4] w-full overflow-hidden bg-ink-3 [clip-path:polygon(0_0,91%_0,100%_100%,9%_100%)] transition-[filter] duration-500 brightness-[0.8] hover:brightness-110'

  return interactive ? (
    <Link to={`/token/${item.id}`} viewTransition className={className} aria-label={item.name} tabIndex={-1}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

export function NftWall({ items, interactive }: { items: WallItem[]; interactive: boolean }) {
  const columns = deal(items, COLUMN_COUNT)

  return (
    // Fade in here, not on the hero wrapper: GSAP reads the wrapper's opacity for the scroll-away effect.
    <div aria-hidden className={`group/wall absolute inset-0 animate-[fade-in_1.2s_ease-out] overflow-hidden ${interactive ? 'pointer-events-auto' : ''}`}>
      {/* Tilt the whole wall; oversize it so the tilted edges stay off-screen. */}
      <div className="absolute -top-[30%] -bottom-[30%] left-[-15%] flex w-[130%] rotate-[12deg] gap-3 sm:gap-4 lg:right-[-19%] lg:left-auto lg:w-[68%]">
        {columns.map((column, i) => {
          return (
            <div key={i} className="relative flex-1" style={{ marginTop: `${-i * STEP}%` }}>
              {/* The track holds the column twice, so sliding it by exactly half loops seamlessly.
                  Spacing is per-item padding, not `gap`, so both halves are the same height. */}
              <div
                className="flex flex-col will-change-transform"
                style={{
                  animationName: i % 2 ? 'wall-down' : 'wall-up',
                  animationDuration: `${LOOP_SECONDS}s`,
                  animationTimingFunction: 'linear',
                  animationIterationCount: 'infinite',
                }}
              >
                {[...column, ...column].map((item, j) => (
                  <div key={j} className="pb-3 sm:pb-4">
                    <Panel item={item} interactive={interactive} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
