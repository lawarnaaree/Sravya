import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import NowPlayingBar from "@/components/NowPlayingBar";
import Library from "@/views/Library";
import Playlists from "@/views/Playlists";
import Search from "@/views/Search";
import Settings from "@/views/Settings";

export default function App() {
  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
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
