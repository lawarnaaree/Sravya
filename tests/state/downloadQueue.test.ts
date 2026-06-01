import { describe, it, expect, beforeEach } from 'vitest'
import { useDownloadQueueStore } from '@/state/downloadQueue'

beforeEach(() => {
  useDownloadQueueStore.setState({ jobs: [], pendingUrl: null, toastMessage: null })
})

describe('useDownloadQueueStore', () => {
  it('starts empty', () => {
    expect(useDownloadQueueStore.getState().jobs).toHaveLength(0)
  })

  it('enqueues a new job', () => {
    useDownloadQueueStore.getState().upsertJob({ trackId: 'a', url: 'https://yt.be/1', status: 'queued', progress: 0 })
    expect(useDownloadQueueStore.getState().jobs).toHaveLength(1)
    expect(useDownloadQueueStore.getState().jobs[0].status).toBe('queued')
  })

  it('updates existing job progress', () => {
    useDownloadQueueStore.getState().upsertJob({ trackId: 'a', url: 'https://yt.be/1', status: 'downloading', progress: 0 })
    useDownloadQueueStore.getState().upsertJob({ trackId: 'a', progress: 50, status: 'downloading' })
    expect(useDownloadQueueStore.getState().jobs[0].progress).toBe(50)
    expect(useDownloadQueueStore.getState().jobs).toHaveLength(1)
  })

  it('marks job complete', () => {
    useDownloadQueueStore.getState().upsertJob({ trackId: 'a', url: '', status: 'downloading', progress: 0 })
    useDownloadQueueStore.getState().upsertJob({ trackId: 'a', status: 'complete', progress: 100 })
    expect(useDownloadQueueStore.getState().jobs[0].status).toBe('complete')
  })

  it('marks job failed with error', () => {
    useDownloadQueueStore.getState().upsertJob({ trackId: 'a', url: '', status: 'downloading', progress: 0 })
    useDownloadQueueStore.getState().upsertJob({ trackId: 'a', status: 'failed', error: 'network error' })
    const job = useDownloadQueueStore.getState().jobs[0]
    expect(job.status).toBe('failed')
    expect(job.error).toBe('network error')
  })

  it('sets and clears pending url', () => {
    useDownloadQueueStore.getState().setPendingUrl('https://yt.be/2')
    expect(useDownloadQueueStore.getState().pendingUrl).toBe('https://yt.be/2')
    useDownloadQueueStore.getState().setPendingUrl(null)
    expect(useDownloadQueueStore.getState().pendingUrl).toBeNull()
  })

  it('sets toast message and clears it', () => {
    useDownloadQueueStore.getState().setToastMessage('Download complete')
    expect(useDownloadQueueStore.getState().toastMessage).toBe('Download complete')
    useDownloadQueueStore.getState().clearToast()
    expect(useDownloadQueueStore.getState().toastMessage).toBeNull()
  })
})
