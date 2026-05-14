import { Play, Pause, SkipBack, SkipForward, Volume2, Shuffle, Repeat } from "lucide-react";
import { usePlayerStore } from "@/state/player";
import { api } from "@/api";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function NowPlayingBar() {
  const { state, currentTrack, positionMs, durationMs, volume, shuffle, repeat } = usePlayerStore();

  const isPlaying = state === "playing";
  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  const handlePlayPause = () => {
    if (isPlaying) api.playback.pause();
    else api.playback.resume();
  };

  return (
    <footer className="flex h-20 shrink-0 items-center border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      {/* Track info */}
      <div className="flex w-56 min-w-0 items-center gap-3">
        {currentTrack?.coverPath ? (
          <img
            src={currentTrack.coverPath}
            alt={currentTrack.album}
            className="h-12 w-12 rounded-sm object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[var(--color-surface-raised)]">
            <Volume2 size={16} className="text-[var(--color-text-subtle)]" />
          </div>
        )}
        {currentTrack && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{currentTrack.title}</p>
            <p className="truncate text-xs text-[var(--color-text-muted)]">{currentTrack.artist}</p>
          </div>
        )}
      </div>

      {/* Controls + scrubber */}
      <div className="flex flex-1 flex-col items-center gap-1 px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => api.playback.command({ type: "setShuffle", enabled: !shuffle })}
            className={cn(
              "text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]",
              shuffle && "text-[var(--color-accent)]"
            )}
          >
            <Shuffle size={15} />
          </button>

          <button
            onClick={() => api.playback.previous()}
            className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={handlePlayPause}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </button>

          <button
            onClick={() => api.playback.next()}
            className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={() =>
              api.playback.command({
                type: "setRepeat",
                mode: repeat === "off" ? "one" : repeat === "one" ? "all" : "off",
              })
            }
            className={cn(
              "text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]",
              repeat !== "off" && "text-[var(--color-accent)]"
            )}
          >
            <Repeat size={15} />
          </button>
        </div>

        {/* Scrubber */}
        <div className="flex w-full max-w-lg items-center gap-2">
          <span className="w-10 text-right text-xs text-[var(--color-text-subtle)]">
            {formatDuration(positionMs)}
          </span>
          <div className="relative flex-1">
            <div className="h-1 w-full rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[var(--color-text)] transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="w-10 text-xs text-[var(--color-text-subtle)]">
            {formatDuration(durationMs)}
          </span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex w-56 items-center justify-end gap-2">
        <Volume2 size={15} className="text-[var(--color-text-muted)]" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => api.playback.setVolume(Number(e.target.value))}
          className="w-24 accent-[var(--color-accent)]"
        />
      </div>
    </footer>
  );
}
