import { create } from 'zustand'

interface TransportState {
  isPlaying: boolean
  currentTime: number
  bpm: number
  loopEnabled: boolean
  loopStart: number
  loopEnd: number
  play: () => void
  pause: () => void
  togglePlay: () => void
  stop: () => void
  seek: (time: number) => void
  setLoop: (enabled: boolean, start?: number, end?: number) => void
}

type SetState = (
  partial: Partial<TransportState> | ((state: TransportState) => Partial<TransportState>),
  replace?: boolean
) => void
type GetState = () => TransportState

export const useTransport = create<TransportState>()((set, get) => {
  // internal: startTime absolute timestamp when play started
  let startWallTime = 0
  let startPlayhead = 0
  let rafId: number | null = null

  const tick = () => {
    const { isPlaying, loopEnabled, loopEnd, loopStart } = get()
    if (!isPlaying) return
    const elapsed = (performance.now() - startWallTime) / 1000
    let nextTime = startPlayhead + elapsed
    if (loopEnabled && nextTime > loopEnd) {
      nextTime = loopStart + ((nextTime - loopStart) % (loopEnd - loopStart))
      // reset reference
      startWallTime = performance.now()
      startPlayhead = nextTime
    }
    set({ currentTime: nextTime })
    rafId = requestAnimationFrame(tick)
  }

  const startRaf = () => {
    if (rafId == null) rafId = requestAnimationFrame(tick)
  }
  const stopRaf = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  return {
    isPlaying: false,
    currentTime: 0,
    bpm: 120,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 8,
    play: () => {
      if (get().isPlaying) return
      startWallTime = performance.now()
      startPlayhead = get().currentTime
      startRaf()
      set({ isPlaying: true })
    },
    pause: () => {
      if (!get().isPlaying) return
      stopRaf()
      set({ isPlaying: false })
    },
    togglePlay: () => {
      get().isPlaying ? get().pause() : get().play()
    },
    stop: () => {
      stopRaf()
      set({ isPlaying: false, currentTime: 0 })
    },
    seek: (time: number) => {
      const clamped = Math.max(0, time)
      if (get().isPlaying) {
        // update playhead reference so playback continues smoothly
        startPlayhead = clamped
        startWallTime = performance.now()
      }
      set({ currentTime: clamped })
    },
    setLoop: (enabled: boolean, start?: number, end?: number) => {
      set((state: TransportState) => ({
        loopEnabled: enabled,
        loopStart: start ?? state.loopStart,
        loopEnd: end ?? state.loopEnd
      }))
    }
  }
}) 