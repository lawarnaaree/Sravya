import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import NowPlayingBar from "@/components/NowPlayingBar";
import Library from "@/views/Library";
import Playlists from "@/views/Playlists";
import Search from "@/views/Search";
import Settings from "@/views/Settings";
import { usePlaybackPoller } from "@/hooks/usePlayback";
import { useLibraryEvents } from "@/hooks/useLibraryEvents";

export default function App() {
  usePlaybackPoller();
  useLibraryEvents();

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<Library />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/search" element={<Search />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
      <NowPlayingBar />
    </div>
  );
}
