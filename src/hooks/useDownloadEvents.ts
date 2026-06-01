import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useQueryClient } from '@tanstack/react-query'
import { useDownloadQueueStore } from '@/state/downloadQueue'

interface ProgressPayload {
  track_id: string
  percent: number
  speed_kbps: number
}

export function useDownloadEvents() {
  const queryClient = useQueryClient()
  const { upsertJob, setToastMessage } = useDownloadQueueStore()

  useEffect(() => {
    const unlisteners = [
      listen<ProgressPayload>('download-progress', ({ payload }) => {
        upsertJob({ trackId: payload.track_id, status: 'downloading', progress: payload.percent })
      }),

      listen<{ track_id: string }>('download-complete', ({ payload }) => {
        upsertJob({ trackId: payload.track_id, status: 'complete', progress: 100 })
        queryClient.invalidateQueries({ queryKey: ['tracks'] })
        setToastMessage('Download complete')
        setTimeout(() => useDownloadQueueStore.getState().clearToast(), 3000)
      }),

      listen<{ track_id: string; error: string }>('download-failed', ({ payload }) => {
        upsertJob({ trackId: payload.track_id, status: 'failed', error: payload.error })
        setToastMessage(`Download failed: ${payload.error}`)
      }),
    ]

    return () => {
      unlisteners.forEach(p => p.then(fn => fn()))
    }
  }, [queryClient, upsertJob, setToastMessage])
}
