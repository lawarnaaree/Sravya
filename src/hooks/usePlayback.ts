import { useEffect, useRef } from 'react'
import { api } from '@/api'
import { usePlayerStore } from '@/state/player'

export function usePlaybackPoller() {
  const store = usePlayerStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const state = await api.player.getState()
        store.setPlaying(state.is_playing)
        store.setPosition(state.position_ms)
        store.setDuration(state.duration_ms)
        store.setVolume(state.volume)
        store.setRepeat(state.repeat)
        store.setShuffle(state.shuffle)
      } catch {
        // Ignore polling errors silently
      }
    }, 500)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
}

export function usePlayback() {
  const store = usePlayerStore()

  const play = async (trackId: string) => {
    await api.player.play(trackId)
    store.setPlaying(true)
  }

  const pause = async () => {
    await api.player.pause()
    store.setPlaying(false)
  }

  const resume = async () => {
    await api.player.resume()
    store.setPlaying(true)
  }

  const togglePlay = () => {
    if (store.isPlaying) pause()
    else resume()
  }

  const seek = (ms: number) => api.player.seek(ms)
  const setVolume = (vol: number) => api.player.setVolume(vol)

  return { play, pause, resume, togglePlay, seek, setVolume }
}
