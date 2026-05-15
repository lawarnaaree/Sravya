import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Play, Music2, ListPlus, Check } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

function AddToPlaylistButton({ trackId }: { trackId: string }) {
  const queryClient = useQueryClient();

  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => api.playlists.list(),
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: ({ playlistId }: { playlistId: string }) =>
      api.playlists.addTrack(playlistId, trackId),
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center justify-center rounded p-1 opacity-0 transition-all group-hover:opacity-100 hover:text-[var(--text)] active:scale-90"
          style={{ color: "var(--text-subtle)" }}
          aria-label="Add to playlist"
          title="Add to playlist"
          onClick={(e) => e.stopPropagation()}
        >
          <ListPlus size={14} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="left"
          align="center"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "4px",
            minWidth: "180px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: "6px 10px 4px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-subtle)",
              textTransform: "uppercase",
            }}
          >
            Add to playlist
          </div>

          {playlists.length === 0 ? (
            <div
              style={{
                padding: "8px 10px",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              No playlists yet
            </div>
          ) : (
            playlists.map((pl) => (
              <DropdownMenu.Item
                key={pl.id}
                onSelect={() => addMutation.mutate({ playlistId: pl.id })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "var(--text)",
                  cursor: "pointer",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-high)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "";
                }}
              >
                <span className="truncate">{pl.name}</span>
                {addMutation.isSuccess && addMutation.variables?.playlistId === pl.id && (
                  <Check size={12} style={{ color: "var(--gold)", flexShrink: 0 }} />
                )}
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function TrackList({ tracks, showAlbum = true, onPlayTrack }: TrackListProps) {
  "use no memo";
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
    ? "32px minmax(0,1.6fr) minmax(0,1fr) 80px 52px 28px"
    : "32px minmax(0,1fr) 80px 52px 28px";

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
        <span />
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
                background: isCurrent ? "var(--surface-high)" : undefined,
                transition: "background 0.1s",
                borderRadius: "4px",
              }}
              onMouseEnter={(e) => {
                if (!isCurrent)
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-high)";
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "";
              }}
              onDoubleClick={() => handlePlay(track, vRow.index)}
            >
              {/* Row number / play indicator */}
              <div className="flex items-center justify-center">
                {isPlaying ? (
                  <div className="flex h-4 items-end gap-[2px]">
                    <div className="np-bar" />
                    <div className="np-bar" />
                    <div className="np-bar" />
                  </div>
                ) : isCurrent ? (
                  <>
                    <span
                      className="text-xs tabular-nums group-hover:hidden"
                      style={{ color: "var(--gold)" }}
                    >
                      {vRow.index + 1}
                    </span>
                    <button
                      className="hidden transition-transform duration-75 group-hover:flex active:scale-90"
                      onClick={() => handlePlay(track, vRow.index)}
                      aria-label={`Play ${track.title}`}
                    >
                      <Play size={13} fill="currentColor" style={{ color: "var(--gold)" }} />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="text-xs tabular-nums group-hover:hidden"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {vRow.index + 1}
                    </span>
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

              {/* Add to playlist */}
              <AddToPlaylistButton trackId={track.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
