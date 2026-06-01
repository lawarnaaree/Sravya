import { useEffect, useRef } from 'react'
import { readText } from '@tauri-apps/plugin-clipboard-manager'
import { useDownloadQueueStore } from '@/state/downloadQueue'
import { usePlatform } from './usePlatform'

const YT_PATTERN = /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/)/

export function useClipboardMonitor() {
  const platform = usePlatform()
  const { setPendingUrl, pendingUrl } = useDownloadQueueStore()
  const lastClipRef = useRef<string>('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = async () => {
    try {
      const text = await readText()
      if (!text || text === lastClipRef.current) return
      lastClipRef.current = text
      if (YT_PATTERN.test(text) && !pendingUrl) {
        setPendingUrl(text)
      }
    } catch {
      // Clipboard read may fail silently
    }
  }

  useEffect(() => {
    if (platform === 'desktop') {
      intervalRef.current = setInterval(check, 1500)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } else {
      document.addEventListener('visibilitychange', check)
      return () => document.removeEventListener('visibilitychange', check)
    }
  }, [platform, pendingUrl])
}
