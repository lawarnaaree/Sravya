import { create } from 'zustand'
import type { Track } from '@/api'

type SortKey = 'title' | 'artist' | 'album' | 'added_at'
type SortDir = 'asc' | 'desc'

interface LibraryStore {
  tracks: Track[]
  isLoading: boolean
  filterQuery: string
  sortKey: SortKey
  sortDir: SortDir

  setTracks: (tracks: Track[]) => void
  setLoading: (loading: boolean) => void
  setFilter: (query: string) => void
  setSort: (key: SortKey, dir: SortDir) => void
}

export const useLibraryStore = create<LibraryStore>(set => ({
  tracks: [],
  isLoading: false,
  filterQuery: '',
  sortKey: 'artist',
  sortDir: 'asc',

  setTracks: tracks => set({ tracks }),
  setLoading: loading => set({ isLoading: loading }),
  setFilter: query => set({ filterQuery: query }),
  setSort: (key, dir) => set({ sortKey: key, sortDir: dir }),
}))
