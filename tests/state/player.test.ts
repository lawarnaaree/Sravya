import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '@/state/player'
import type { Track } from '@/api'

const mockTrack: Track = {
  id: 'track-1',
  title: 'Test Track',
  artist: 'Test Artist',
  album: 'Test Album',
  file_hash: 'abc123',
  file_ext: 'mp3',
  file_path: '/music/test.mp3',
  added_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  usePlayerStore.setState({
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
  })
})

describe('usePlayerStore', () => {
  it('starts with no current track', () => {
    expect(usePlayerStore.getState().currentTrack).toBeNull()
  })

  it('sets current track', () => {
    usePlayerStore.getState().setCurrentTrack(mockTrack)
    expect(usePlayerStore.getState().currentTrack?.id).toBe('track-1')
  })

  it('sets playing state', () => {
    usePlayerStore.getState().setPlaying(true)
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it('toggles muted', () => {
    usePlayerStore.getState().setMuted(true)
    expect(usePlayerStore.getState().muted).toBe(true)
    usePlayerStore.getState().setMuted(false)
    expect(usePlayerStore.getState().muted).toBe(false)
  })

  it('sets volume', () => {
    usePlayerStore.getState().setVolume(0.5)
    expect(usePlayerStore.getState().volume).toBe(0.5)
  })

  it('sets repeat mode', () => {
    usePlayerStore.getState().setRepeat('All')
    expect(usePlayerStore.getState().repeat).toBe('All')
  })

  it('sets shuffle', () => {
    usePlayerStore.getState().setShuffle(true)
    expect(usePlayerStore.getState().shuffle).toBe(true)
  })

  it('sets queue', () => {
    usePlayerStore.getState().setQueue([mockTrack], 0)
    expect(usePlayerStore.getState().queue).toHaveLength(1)
    expect(usePlayerStore.getState().queueIndex).toBe(0)
  })

  it('sets full screen', () => {
    usePlayerStore.getState().setFullScreen(true)
    expect(usePlayerStore.getState().isFullScreen).toBe(true)
  })
})
