import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Music2, Disc3, Mic2 } from "lucide-react";
import { api } from "@/api";
import TrackList from "@/components/TrackList";
import AlbumGrid from "@/components/AlbumGrid";

type Tab = "songs" | "albums" | "artists";

const tabs: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "songs", label: "Songs", icon: Music2 },
  { value: "albums", label: "Albums", icon: Disc3 },
  { value: "artists", label: "Artists", icon: Mic2 },
];

export default function Library() {
  const [activeTab, setActiveTab] = useState<Tab>("songs");

  const tracksQuery = useQuery({
    queryKey: ["tracks"],
    queryFn: () => api.library.tracks(5000, 0),
  });
  const albumsQuery = useQuery({
    queryKey: ["albums"],
    queryFn: () => api.library.albums(),
  });
  const artistsQuery = useQuery({
    queryKey: ["artists"],
    queryFn: () => api.library.artists(),
  });
  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.library.stats(),
  });

  const tracks = tracksQuery.data ?? [];
  const albums = albumsQuery.data ?? [];
  const artists = artistsQuery.data ?? [];
  const stats = statsQuery.data;

  const totalMs = stats?.totalDurationMs ?? 0;
  const hours = Math.floor(totalMs / 3_600_000);
  const mins = Math.floor((totalMs % 3_600_000) / 60_000);

  return (
    <div className="flex h-full flex-col">
      {/* Gradient header */}
      <div className="page-header-gradient shrink-0">
        <div className="px-6 pt-8 pb-4">
          <p
            className="mb-1 text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Your
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Library
          </h1>
          {stats && (
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {stats.trackCount.toLocaleString()} tracks · {stats.albumCount.toLocaleString()}{" "}
              albums · {stats.artistCount.toLocaleString()} artists
              {totalMs > 0 ? ` · ${hours > 0 ? `${hours}h ` : ""}${mins}m` : ""}
            </p>
          )}
        </div>

        {/* Pill tabs */}
        <div className="flex gap-2 px-6 pb-4">
          {tabs.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-150"
              style={
                activeTab === value
                  ? { background: "var(--gold)", color: "var(--text-on-gold)" }
                  : {
                      background: "var(--surface-raised)",
                      color: "var(--text-muted)",
                    }
              }
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "songs" &&
          (tracksQuery.isPending ? (
            <Spinner />
          ) : tracks.length === 0 ? (
            <EmptyState message="Add a folder in Settings to get started." />
          ) : (
            <TrackList tracks={tracks} showAlbum />
          ))}

        {activeTab === "albums" &&
          (albumsQuery.isPending ? <Spinner /> : <AlbumGrid albums={albums} tracks={tracks} />)}

        {activeTab === "artists" &&
          (artistsQuery.isPending ? (
            <Spinner />
          ) : artists.length === 0 ? (
            <EmptyState message="No artists found." />
          ) : (
            <div className="h-full overflow-auto">
              {artists.map((artist) => (
                <div
                  key={artist.id}
                  className="flex items-center gap-4 px-6 py-3 transition-colors"
                  style={{ cursor: "default", borderBottom: "1px solid var(--border-subtle)" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "var(--surface-high)")
                  }
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "var(--overlay)" }}
                  >
                    <Mic2 size={16} style={{ color: "var(--text-subtle)" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {artist.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex h-full items-center justify-center py-16">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2"
        style={{
          borderColor: "var(--gold)",
          borderTopColor: "transparent",
        }}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16">
      <Music2 size={40} style={{ color: "var(--text-subtle)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {message}
      </p>
    </div>
  );
}
