import { X, Download } from 'lucide-react'
import { useDownloadQueueStore } from '@/state/downloadQueue'
import { api } from '@/api'

export function DownloadToast() {
  const { pendingUrl, toastMessage, setPendingUrl, clearToast, upsertJob } = useDownloadQueueStore()

  const handleDownload = async () => {
    if (!pendingUrl) return
    const url = pendingUrl
    setPendingUrl(null)

    const tempId = `dl-${Date.now()}`
    upsertJob({ trackId: tempId, url, status: 'downloading', progress: 0 })

    try {
      await api.import.url(url)
    } catch (e) {
      upsertJob({ trackId: tempId, status: 'failed', error: String(e) })
    }
  }

  if (!pendingUrl && !toastMessage) return null

  return (
    <div className="fixed bottom-24 right-4 z-50 max-w-xs w-full">
      <div
        className="glass rounded-2xl shadow-xl p-4 border"
        style={{ borderColor: 'var(--separator)', boxShadow: 'var(--shadow-modal)' }}
      >
        {pendingUrl ? (
          <>
            <div className="flex items-start gap-3 mb-3">
              <Download size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium mb-0.5" style={{ color: 'var(--text)' }}>
                  YouTube URL detected
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-2)' }}>
                  {pendingUrl}
                </p>
              </div>
              <button onClick={() => setPendingUrl(null)} style={{ color: 'var(--text-3)' }}>
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 py-1.5 rounded-xl text-[13px] font-medium transition-colors"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Download
              </button>
              <button
                onClick={() => setPendingUrl(null)}
                className="flex-1 py-1.5 rounded-xl text-[13px] font-medium transition-colors"
                style={{ background: 'var(--border)', color: 'var(--text)' }}
              >
                Dismiss
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[13px]" style={{ color: 'var(--text)' }}>
              {toastMessage}
            </p>
            <button onClick={clearToast} style={{ color: 'var(--text-3)' }}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
