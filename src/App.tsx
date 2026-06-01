import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { BottomTabBar } from '@/components/BottomTabBar'
import { NowPlayingBar } from '@/components/NowPlayingBar'
import { NowPlayingFull } from '@/components/NowPlayingFull'
import { DownloadToast } from '@/components/DownloadToast'
import { Library } from '@/views/Library'
import { Playlists } from '@/views/Playlists'
import { Search } from '@/views/Search'
import { Settings } from '@/views/Settings'
import { Sync } from '@/views/Sync'
import { usePlatform } from '@/hooks/usePlatform'
import { usePlaybackPoller } from '@/hooks/usePlayback'
import { useLibraryEvents } from '@/hooks/useLibraryEvents'
import { useDownloadEvents } from '@/hooks/useDownloadEvents'
import { useLanSyncEvents } from '@/hooks/useLanSyncEvents'
import { useClipboardMonitor } from '@/hooks/useClipboardMonitor'

export default function App() {
  const platform = usePlatform()

  usePlaybackPoller()
  useLibraryEvents()
  useDownloadEvents()
  useLanSyncEvents()
  useClipboardMonitor()

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-1 min-h-0">
        {platform === 'desktop' && <Sidebar />}

        <main className="flex-1 min-w-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<Library />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/search" element={<Search />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sync" element={<Sync />} />
          </Routes>
        </main>
      </div>

      <NowPlayingBar />

      {platform === 'ios' && <BottomTabBar />}

      {platform === 'desktop' && <DownloadToast />}

      <NowPlayingFull />
    </div>
  )
}
