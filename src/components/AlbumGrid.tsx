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
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
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
    <div
      className="group card-lift cursor-pointer rounded-lg p-3"
      style={{ background: "var(--surface-raised)" }}
      onDoubleClick={onPlay}
    >
      {/* Cover art */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-lg"
        style={{ background: "var(--overlay)" }}
      >
        {img ? (
          <img src={img} alt={album.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Disc3 size={40} style={{ color: "var(--text-subtle)" }} />
          </div>
        )}

        {/* Hover play button — bottom right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className="play-overlay absolute right-2 bottom-2 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-75 hover:scale-110 active:scale-90"
          style={{
            background: "var(--gold)",
            color: "var(--text-on-gold)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
          aria-label={`Play ${album.title}`}
        >
          <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
        </button>
      </div>

      {/* Info */}
      <div className="mt-2 min-w-0">
        <p
          className="truncate text-sm font-semibold"
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
