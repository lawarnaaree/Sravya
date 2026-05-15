import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Play, Music2 } from "lucide-react";
import type { Track } from "@/api";
import { api } from "@/api";
import { usePlayerStore } from "@/state/player";
import { cn, formatDuration, coverUrl } from "@/lib/utils";

interface TrackListProps {
  tracks: Track[];
  showAlbum?: boolean;
  onPlayTrack?: (track: Track, index: number) => void;
}

const codecStyle = (codec: string) => {
  const lossless = codec === "FLAC" || codec === "ALAC";
  return {
    background: lossless ? "rgba(201,148,58,0.12)" : "var(--surface-high)",
    color: lossless ? "var(--gold)" : "var(--text-subtle)",
    border: `1px solid ${lossless ? "rgba(201,148,58,0.28)" : "var(--border)"}`,
  };
};

export default function TrackList({ tracks, showAlbum = true, onPlayTrack }: TrackListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id);
  const playerState = usePlayerStore((s) => s.state);

  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  const handlePlay = useCallback(
    (track: Track, index: number) => {
      if (onPlayTrack) {
        onPlayTrack(track, index);
      } else {
        api.playback.command({
          type: "playQueue",
          track_ids: tracks.map((t) => t.id),
          start_index: index,
        });
      }
    },
    [tracks, onPlayTrack]
  );

  if (tracks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
        <Music2 size={40} style={{ color: "var(--text-subtle)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No tracks here yet
        </p>
      </div>
    );
  }

  const cols = showAlbum
    ? "32px minmax(0,1.6fr) minmax(0,1fr) 80px 52px"
    : "32px minmax(0,1fr) 80px 52px";

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      {/* Column header */}
      <div
        className="sticky top-0 z-10 grid items-center gap-3 border-b px-4 py-2"
        style={{
          gridTemplateColumns: cols,
          background: "var(--surface)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-subtle)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span className="text-center">#</span>
        <span>Title</span>
        {showAlbum && <span>Album</span>}
        <span className="text-right">Time</span>
        <span>Quality</span>
      </div>

      {/* Virtual rows */}
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((vRow) => {
          const track = tracks[vRow.index];
          const isCurrent = track.id === currentTrackId;
          const isPlaying = isCurrent && playerState === "playing";

          return (
            <div
              key={track.id}
              data-index={vRow.index}
              ref={rowVirtualizer.measureElement}
              className={cn(
                "group absolute right-0 left-0 grid cursor-pointer items-center gap-3 px-4"
              )}
              style={{
                top: vRow.start,
                height: 56,
                gridTemplateColumns: cols,
                background: isCurrent ? "var(--surface-raised)" : undefined,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!isCurrent)
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-raised)";
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "";
              }}
              onDoubleClick={() => handlePlay(track, vRow.index)}
            >
              {/* Row number / play indicator */}
              <div
                className="flex items-center justify-center text-xs tabular-nums"
                style={{ color: isCurrent ? "var(--gold)" : "var(--text-subtle)" }}
              >
                {isPlaying ? (
                  <span className="animate-pulse-gold text-[10px]" style={{ color: "var(--gold)" }}>
                    ♪
                  </span>
                ) : (
                  <>
                    <span className="group-hover:hidden">{vRow.index + 1}</span>
                    <button
                      className="hidden transition-transform duration-75 group-hover:flex active:scale-90"
                      onClick={() => handlePlay(track, vRow.index)}
                      aria-label={`Play ${track.title}`}
                    >
                      <Play size={13} fill="currentColor" style={{ color: "var(--text)" }} />
                    </button>
                  </>
                )}
              </div>

              {/* Cover + title / artist */}
              <div className="flex min-w-0 items-center gap-3">
                {coverUrl(track.coverPath) ? (
                  <img
                    src={coverUrl(track.coverPath)}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-sm object-cover"
                    style={{ opacity: 0.92 }}
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
                    style={{ background: "var(--overlay)" }}
                  >
                    <Music2 size={12} style={{ color: "var(--text-subtle)" }} />
                  </div>
                )}
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: isCurrent ? "var(--gold)" : "var(--text)" }}
                  >
                    {track.title}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {track.artist}
                  </p>
                </div>
              </div>

              {/* Album */}
              {showAlbum && (
                <p className="truncate text-sm" style={{ color: "var(--text-muted)" }}>
                  {track.album}
                </p>
              )}

              {/* Duration */}
              <p className="text-right text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                {formatDuration(track.durationMs)}
              </p>

              {/* Codec badge */}
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
                style={codecStyle(track.codec)}
              >
                {track.codec}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
