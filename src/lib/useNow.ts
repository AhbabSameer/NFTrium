import { useSyncExternalStore } from 'react'

// One shared 1s ticker for every countdown on the page.
let now = Math.floor(Date.now() / 1000)
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  timer ??= setInterval(() => {
    now = Math.floor(Date.now() / 1000)
    listeners.forEach((l) => l())
  }, 1000)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** Current Unix time in seconds, updating every second. */
export const useNow = () => useSyncExternalStore(subscribe, () => now)
