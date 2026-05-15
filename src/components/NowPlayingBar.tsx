import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Music2,
  Maximize2,
  Heart,
} from "lucide-react";
import { motion } from "framer-motion";
import { usePlayerStore } from "@/state/player";
import { api } from "@/api";
import { cn, formatDuration, coverUrl } from "@/lib/utils";

export default function NowPlayingBar() {
  const {
    state,
    currentTrack,
    positionMs,
    durationMs,
    volume,
    muted,
    shuffle,
    repeat,
    setFullScreen,
  } = usePlayerStore();

  const isPlaying = state === "playing";
  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  const handlePlayPause = () => {
    if (isPlaying) api.playback.pause();
    else api.playback.resume();
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    api.playback.seek(Number(e.target.value));
  };

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const VolumeIcon = muted || volume === 0 ? VolumeX : Volume2;

  const codecIsLossless = currentTrack?.codec === "FLAC" || currentTrack?.codec === "ALAC";

  return (
    <footer
      className="flex shrink-0 items-center gap-4 px-4"
      style={{
        height: "var(--nowplay-h)",
        background: "var(--surface)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      {/* Track info — left 30% */}
      <div className="group flex w-[30%] min-w-0 items-center gap-3">
        {currentTrack ? (
          <>
            <motion.div
              layoutId="now-playing-art"
              className="shrink-0 cursor-pointer"
              onClick={() => setFullScreen(true)}
              title="Open full player"
            >
              {coverUrl(currentTrack.coverPath) ? (
                <img
                  src={coverUrl(currentTrack.coverPath)}
                  alt={currentTrack.album}
                  className="h-14 w-14 rounded-sm object-cover"
                  style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-sm"
                  style={{ background: "var(--surface-raised)" }}
                >
                  <Music2 size={18} style={{ color: "var(--text-subtle)" }} />
                </div>
              )}
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
                {currentTrack.title}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                {currentTrack.artist}
              </p>
              {codecIsLossless && (
                <span
                  className="mt-0.5 inline-flex items-center rounded px-1 py-px text-[9px] font-semibold tracking-wider"
                  style={{
                    background: "rgba(201,148,58,0.12)",
                    color: "var(--gold)",
                    border: "1px solid rgba(201,148,58,0.25)",
                  }}
                >
                  {currentTrack.codec}
                </span>
              )}
            </div>
            <button
              className="shrink-0 rounded p-1 opacity-0 transition-all group-hover:opacity-100 hover:text-[var(--text)]"
              style={{ color: "var(--text-subtle)" }}
              aria-label="Like"
              title="Like (coming soon)"
            >
              <Heart size={14} />
            </button>
          </>
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm"
            style={{ background: "var(--surface-raised)" }}
          >
            <Music2 size={18} style={{ color: "var(--text-subtle)" }} />
          </div>
        )}
      </div>

      {/* Controls + scrubber — center */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        {/* Transport buttons */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => api.playback.command({ type: "setShuffle", enabled: !shuffle })}
            className={cn(
              "transition-all duration-75 active:scale-90",
              shuffle ? "text-[var(--gold)]" : "text-[var(--text-subtle)] hover:text-[var(--text)]"
            )}
            aria-label="Shuffle"
          >
            <Shuffle size={15} />
          </button>

          <button
            onClick={() => api.playback.previous()}
            className="transition-all duration-75 hover:text-[var(--text)] active:scale-90"
            style={{ color: "var(--text-muted)" }}
            aria-label="Previous"
          >
            <SkipBack size={18} />
          </button>

          {/* Play / Pause — white Spotify-style circle */}
          <button
            onClick={handlePlayPause}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-75 hover:scale-105 active:scale-90"
            style={{
              background: "var(--text)",
              color: "var(--bg)",
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />
            )}
          </button>

          <button
            onClick={() => api.playback.next()}
            className="transition-all duration-75 hover:text-[var(--text)] active:scale-90"
            style={{ color: "var(--text-muted)" }}
            aria-label="Next"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={() =>
              api.playback.command({
                type: "setRepeat",
                mode: repeat === "off" ? "all" : repeat === "all" ? "one" : "off",
              })
            }
            className={cn(
              "transition-all duration-75 active:scale-90",
              repeat !== "off"
                ? "text-[var(--gold)]"
                : "text-[var(--text-subtle)] hover:text-[var(--text)]"
            )}
            aria-label="Repeat"
          >
            <RepeatIcon size={15} />
          </button>
        </div>

        {/* Scrubber */}
        <div className="flex w-full max-w-lg items-center gap-2">
          <span
            className="w-9 text-right text-[11px] tabular-nums"
            style={{ color: "var(--text-subtle)" }}
          >
            {formatDuration(positionMs)}
          </span>
          <input
            type="range"
            className="scrubber flex-1"
            min={0}
            max={durationMs || 100}
            value={positionMs}
            style={{ "--pct": `${progress}%` } as React.CSSProperties}
            onChange={handleScrub}
            aria-label="Seek"
          />
          <span className="w-9 text-[11px] tabular-nums" style={{ color: "var(--text-subtle)" }}>
            {formatDuration(durationMs)}
          </span>
        </div>
      </div>

      {/* Volume + maximize — right 30% */}
      <div className="flex w-[30%] items-center justify-end gap-2">
        <button
          onClick={() => api.playback.command({ type: muted ? "unmute" : "mute" })}
          style={{ color: "var(--text-muted)" }}
          className="transition-colors hover:text-[var(--text)]"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          <VolumeIcon size={15} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => api.playback.setVolume(Number(e.target.value))}
          className="scrubber w-20"
          style={{ "--pct": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
          aria-label="Volume"
        />
        {currentTrack && (
          <button
            onClick={() => setFullScreen(true)}
            className="ml-1 shrink-0 rounded p-0.5 transition-all hover:text-[var(--text)]"
            style={{ color: "var(--text-subtle)" }}
            title="Open full player"
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>
    </footer>
  );
}
