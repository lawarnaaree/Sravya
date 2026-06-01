import { create } from 'zustand'

export type DownloadStatus = 'queued' | 'downloading' | 'complete' | 'failed'

export interface DownloadJob {
  trackId: string
  url: string
  status: DownloadStatus
  progress: number
  error?: string
}

interface DownloadQueueStore {
  jobs: DownloadJob[]
  pendingUrl: string | null
  toastMessage: string | null

  upsertJob: (job: Partial<DownloadJob> & { trackId: string }) => void
  setPendingUrl: (url: string | null) => void
  setToastMessage: (msg: string | null) => void
  clearToast: () => void
}

export const useDownloadQueueStore = create<DownloadQueueStore>(set => ({
  jobs: [],
  pendingUrl: null,
  toastMessage: null,

  upsertJob: job =>
    set(state => {
      const idx = state.jobs.findIndex(j => j.trackId === job.trackId)
      if (idx >= 0) {
        const updated = [...state.jobs]
        updated[idx] = { ...updated[idx], ...job }
        return { jobs: updated }
      }
      return {
        jobs: [
          ...state.jobs,
          { url: '', status: 'queued', progress: 0, ...job } as DownloadJob,
        ],
      }
    }),

  setPendingUrl: url => set({ pendingUrl: url }),
  setToastMessage: msg => set({ toastMessage: msg }),
  clearToast: () => set({ toastMessage: null }),
}))
