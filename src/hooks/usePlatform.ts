import { useEffect, useState } from 'react'
import { platform } from '@tauri-apps/plugin-os'

type Platform = 'desktop' | 'ios'

export function usePlatform(): Platform {
  const [plat, setPlat] = useState<Platform>('desktop')

  useEffect(() => {
    try {
      const p = platform()
      setPlat(p === 'ios' ? 'ios' : 'desktop')
    } catch {
      // outside Tauri environment
    }
  }, [])

  return plat
}
