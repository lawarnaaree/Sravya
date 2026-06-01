import { create } from 'zustand'

interface FileProgress {
  trackId: string
  title: string
  bytesReceived: number
  totalBytes: number
}

interface LanSyncStore {
  isConnected: boolean
  serverUrl: string | null
  serverName: string | null
  isSyncing: boolean
  syncProgress: { synced: number; skipped: number; errors: number } | null
  lastSyncedAt: string | null
  fileProgress: FileProgress | null

  setPaired: (url: string, name?: string) => void
  setUnpaired: () => void
  setSyncing: (syncing: boolean) => void
  setSyncProgress: (progress: { synced: number; skipped: number; errors: number }) => void
  setLastSyncedAt: (ts: string) => void
  setFileProgress: (fp: FileProgress | null) => void
}

export const useLanSyncStore = create<LanSyncStore>(set => ({
  isConnected: false,
  serverUrl: null,
  serverName: null,
  isSyncing: false,
  syncProgress: null,
  lastSyncedAt: null,
  fileProgress: null,

  setPaired: (url, name) => set({ isConnected: true, serverUrl: url, serverName: name ?? null }),
  setUnpaired: () => set({ isConnected: false, serverUrl: null, serverName: null }),
  setSyncing: syncing => set({ isSyncing: syncing }),
  setSyncProgress: progress => set({ syncProgress: progress }),
  setLastSyncedAt: ts => set({ lastSyncedAt: ts }),
  setFileProgress: fp => set({ fileProgress: fp }),
}))
