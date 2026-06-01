import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useQueryClient } from '@tanstack/react-query'

export function useLibraryEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unlisten = listen('library-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [queryClient])
}
