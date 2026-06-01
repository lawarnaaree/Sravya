import { create } from 'zustand'
import type { Track } from '@/api'

interface PlayerStore {
  currentTrack: Track | null
  queue: Track[]
  queueIndex: number
  isPlaying: boolean
  positionMs: number
  durationMs: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: 'Off' | 'One' | 'All'
  isFullScreen: boolean

  setCurrentTrack: (track: Track | null) => void
  setQueue: (tracks: Track[], index?: number) => void
  setPlaying: (playing: boolean) => void
  setPosition: (ms: number) => void
  setDuration: (ms: number) => void
  setVolume: (vol: number) => void
  setMuted: (muted: boolean) => void
  setShuffle: (shuffle: boolean) => void
  setRepeat: (mode: 'Off' | 'One' | 'All') => void
  setFullScreen: (full: boolean) => void
}

export const usePlayerStore = create<PlayerStore>(set => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: 'Off',
  isFullScreen: false,

  setCurrentTrack: track => set({ currentTrack: track }),
  setQueue: (tracks, index = 0) => set({ queue: tracks, queueIndex: index }),
  setPlaying: playing => set({ isPlaying: playing }),
  setPosition: ms => set({ positionMs: ms }),
  setDuration: ms => set({ durationMs: ms }),
  setVolume: vol => set({ volume: vol }),
  setMuted: muted => set({ muted }),
  setShuffle: shuffle => set({ shuffle }),
  setRepeat: mode => set({ repeat: mode }),
  setFullScreen: full => set({ isFullScreen: full }),
}))
