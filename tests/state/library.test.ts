import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from '@/state/library'
import type { Track } from '@/api'

const mockTracks: Track[] = [
  {
    id: '1',
    title: 'Alpha',
    artist: 'Artist A',
    album: 'Album 1',
    file_hash: 'hash1',
    file_ext: 'mp3',
    file_path: '/1.mp3',
    added_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    title: 'Beta',
    artist: 'Artist B',
    album: 'Album 2',
    file_hash: 'hash2',
    file_ext: 'flac',
    file_path: '/2.flac',
    added_at: '2024-01-02T00:00:00Z',
  },
]

beforeEach(() => {
  useLibraryStore.setState({ tracks: [], isLoading: false, filterQuery: '', sortKey: 'artist', sortDir: 'asc' })
})

describe('useLibraryStore', () => {
  it('starts empty', () => {
    expect(useLibraryStore.getState().tracks).toHaveLength(0)
  })

  it('sets tracks', () => {
    useLibraryStore.getState().setTracks(mockTracks)
    expect(useLibraryStore.getState().tracks).toHaveLength(2)
  })

  it('sets loading state', () => {
    useLibraryStore.getState().setLoading(true)
    expect(useLibraryStore.getState().isLoading).toBe(true)
  })

  it('sets filter query', () => {
    useLibraryStore.getState().setFilter('Alpha')
    expect(useLibraryStore.getState().filterQuery).toBe('Alpha')
  })

  it('sets sort', () => {
    useLibraryStore.getState().setSort('title', 'desc')
    expect(useLibraryStore.getState().sortKey).toBe('title')
    expect(useLibraryStore.getState().sortDir).toBe('desc')
  })
})
