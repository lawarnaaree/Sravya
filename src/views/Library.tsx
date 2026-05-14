import * as Tabs from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { Music2, Disc3, Mic2 } from "lucide-react";
import { api } from "@/api";
import TrackList from "@/components/TrackList";
import AlbumGrid from "@/components/AlbumGrid";

export default function Library() {
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
      {/* Header */}
      <div
        className="shrink-0 px-6 pt-6 pb-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <h1 className="mb-0.5 text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Library
        </h1>
        {stats && (
          <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
            {stats.trackCount.toLocaleString()} tracks · {stats.albumCount.toLocaleString()} albums
            · {stats.artistCount.toLocaleString()} artists
            {totalMs > 0 ? ` · ${hours > 0 ? `${hours}h ` : ""}${mins}m` : ""}
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs.Root defaultValue="songs" className="flex min-h-0 flex-1 flex-col">
        <Tabs.List
          className="flex shrink-0 gap-0 px-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          {[
            { value: "songs", label: "Songs", icon: Music2 },
            { value: "albums", label: "Albums", icon: Disc3 },
            { value: "artists", label: "Artists", icon: Mic2 },
          ].map(({ value, label, icon: Icon }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="sravya-tab flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-colors outline-none data-[state=active]:border-[var(--gold)] data-[state=active]:text-[var(--gold)]"
              style={{ color: "var(--text-muted)" }}
            >
              <Icon size={14} />
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="songs" className="min-h-0 flex-1 overflow-hidden outline-none">
          {tracksQuery.isPending ? (
            <Spinner />
          ) : tracks.length === 0 ? (
            <EmptyState message="Add a folder in Settings to get started." />
          ) : (
            <TrackList tracks={tracks} showAlbum />
          )}
        </Tabs.Content>

        <Tabs.Content value="albums" className="min-h-0 flex-1 overflow-auto outline-none">
          {albumsQuery.isPending ? <Spinner /> : <AlbumGrid albums={albums} tracks={tracks} />}
        </Tabs.Content>

        <Tabs.Content value="artists" className="min-h-0 flex-1 overflow-auto outline-none">
          {artistsQuery.isPending ? (
            <Spinner />
          ) : artists.length === 0 ? (
            <EmptyState message="No artists found." />
          ) : (
            <div>
              {artists.map((artist) => (
                <div
                  key={artist.id}
                  className="flex items-center gap-4 border-b px-6 py-3 transition-colors"
                  style={{
                    borderColor: "var(--border-subtle)",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "var(--surface-raised)")
                  }
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "var(--overlay)" }}
                  >
                    <Mic2 size={14} style={{ color: "var(--text-subtle)" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                      {artist.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
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
