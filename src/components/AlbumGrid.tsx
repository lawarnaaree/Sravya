import { Play, Disc3 } from "lucide-react";
import type { Album, Track } from "@/api";
import { api } from "@/api";
import { coverUrl } from "@/lib/utils";

interface AlbumGridProps {
  albums: Album[];
  tracks: Track[];
}

export default function AlbumGrid({ albums, tracks }: AlbumGridProps) {
  if (albums.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
        <Disc3 size={40} style={{ color: "var(--text-subtle)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No albums yet
        </p>
      </div>
    );
  }

  const playAlbum = (album: Album) => {
    const albumTracks = tracks
      .filter(
        (t) =>
          t.album.toLowerCase() === album.title.toLowerCase() &&
          t.artist.toLowerCase() === album.artist.toLowerCase()
      )
      .sort((a, b) => (a.trackNo ?? 99) - (b.trackNo ?? 99));

    if (albumTracks.length > 0) {
      api.playback.command({
        type: "playQueue",
        track_ids: albumTracks.map((t) => t.id),
        start_index: 0,
      });
    }
  };

  return (
    <div className="overflow-auto p-6">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        }}
      >
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} onPlay={() => playAlbum(album)} />
        ))}
      </div>
    </div>
  );
}

function AlbumCard({ album, onPlay }: { album: Album; onPlay: () => void }) {
  const img = coverUrl(album.coverPath);

  return (
    <div className="group flex flex-col gap-2">
      {/* Cover art */}
      <div
        className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg"
        style={{ background: "var(--surface-raised)" }}
        onDoubleClick={onPlay}
      >
        {img ? (
          <img
            src={img}
            alt={album.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Disc3 size={40} style={{ color: "var(--text-subtle)" }} />
          </div>
        )}

        {/* Overlay play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="art-gradient absolute inset-0" />
          <button
            onClick={onPlay}
            className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-75 hover:scale-110 active:scale-90"
            style={{
              background: "var(--gold)",
              color: "var(--text-on-gold)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            }}
            aria-label={`Play ${album.title}`}
          >
            <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p
          className="truncate text-sm font-medium"
          style={{ color: "var(--text)" }}
          title={album.title}
        >
          {album.title}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--text-muted)" }} title={album.artist}>
          {album.artist}
          {album.year ? ` · ${album.year}` : ""}
        </p>
      </div>
    </div>
  );
}
