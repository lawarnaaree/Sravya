import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useLanSyncStore } from '@/state/lanSync'

export function useLanSyncEvents() {
  const store = useLanSyncStore()

  useEffect(() => {
    const unlisteners = [
      listen<{ peer_id: string }>('lan-sync-started', () => {
        store.setSyncing(true)
      }),

      listen<{ track_id: string; title: string; bytes_received: number; total_bytes: number }>(
        'lan-sync-file-progress',
        ({ payload }) => {
          store.setFileProgress({
            trackId: payload.track_id,
            title: payload.title,
            bytesReceived: payload.bytes_received,
            totalBytes: payload.total_bytes,
          })
        },
      ),

      listen<{ synced: number; skipped: number; errors: number }>('lan-sync-complete', ({ payload }) => {
        store.setSyncing(false)
        store.setSyncProgress(payload)
        store.setLastSyncedAt(new Date().toISOString())
        store.setFileProgress(null)
      }),

      listen<{ error: string }>('lan-sync-failed', () => {
        store.setSyncing(false)
        store.setFileProgress(null)
      }),
    ]

    return () => {
      unlisteners.forEach(p => p.then(fn => fn()))
    }
  }, [])
}
