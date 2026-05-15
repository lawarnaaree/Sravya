import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Music2,
  ListMusic,
  FileText,
  Volume2,
  VolumeX,
  Heart,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePlayerStore } from "@/state/player";
import { api } from "@/api";
import { cn, formatDuration, coverUrl } from "@/lib/utils";
import Lyrics from "@/components/Lyrics";

type Panel = "lyrics" | "queue";

interface Props {
  onClose: () => void;
}

function useDominantColor(src: string | undefined) {
  const [color, setColor] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 24, 24);
      const data = ctx.getImageData(0, 0, 24, 24).data;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        const sat = max - min;
        const brightness = max;
        if (sat > 25 && brightness > 40) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
      if (count > 4) {
        setColor(`rgb(${Math.round(r / count)},${Math.round(g / count)},${Math.round(b / count)})`);
      } else {
        setColor(null);
      }
    };
    img.src = src;
    imgRef.current = img;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return src ? color : null;
}

export default function NowPlayingFull({ onClose }: Props) {
  const { state, currentTrack, positionMs, durationMs, volume, muted, shuffle, repeat } =
    usePlayerStore();
  const [panel, setPanel] = useState<Panel>("lyrics");

  const isPlaying = state === "playing";
  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const volPct = (muted ? 0 : volume) * 100;
  const artSrc = coverUrl(currentTrack?.coverPath);
  const dominantColor = useDominantColor(artSrc ?? undefined);
  const accentColor = dominantColor ?? "#c9943a";

  const lyricsQuery = useQuery({
    queryKey: ["lyrics", currentTrack?.id],
    queryFn: () => api.lyrics.get(currentTrack!.id),
    enabled: !!currentTrack,
    staleTime: Infinity,
  });

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const VolumeIcon = muted || volume === 0 ? VolumeX : Volume2;
  const codecIsLossless = currentTrack?.codec === "FLAC" || currentTrack?.codec === "ALAC";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        {/* Primary color wash from top-left */}
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse 90% 70% at 22% 0%, ${accentColor}88 0%, transparent 65%)`,
          }}
        />
        {/* Secondary softer glow from bottom-right */}
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 78% 100%, ${accentColor}33 0%, transparent 60%)`,
          }}
        />
        {/* Dark vignette overlay for readability */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)",
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--text-subtle)" }}
          >
            Now Playing
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 transition-all duration-75 hover:scale-110 active:scale-90"
          style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.07)" }}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main layout */}
      <div className="relative z-10 flex min-h-0 flex-1 gap-6 px-8 pb-6">
        {/* ── Left: art + controls ─────────────────────────────────── */}
        <div className="flex w-[340px] shrink-0 flex-col gap-5">
          {/* Album art with glow bloom */}
          <div className="relative">
            {/* Bloom behind art */}
            <div
              className="absolute -inset-6 rounded-3xl blur-3xl transition-all duration-700"
              style={{ background: accentColor, opacity: artSrc ? 0.35 : 0 }}
            />
            <motion.div layoutId="now-playing-art" className="relative z-10">
              {artSrc ? (
                <img
                  src={artSrc}
                  alt={currentTrack?.album}
                  className="aspect-square w-full rounded-2xl object-cover"
                  style={{
                    boxShadow: `0 20px 56px ${accentColor}55, 0 4px 16px rgba(0,0,0,0.6)`,
                  }}
                />
              ) : (
                <div
                  className="flex aspect-square w-full items-center justify-center rounded-2xl"
                  style={{ background: "var(--surface-raised)" }}
                >
                  <Music2 size={64} style={{ color: "var(--text-subtle)" }} />
                </div>
              )}
            </motion.div>
          </div>

          {/* Track info */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-2xl leading-tight font-bold tracking-tight"
                style={{ color: "var(--text)" }}
                title={currentTrack?.title}
              >
                {currentTrack?.title ?? "Not Playing"}
              </p>
              <p className="mt-0.5 truncate text-base" style={{ color: "var(--text-muted)" }}>
                {currentTrack?.artist ?? "—"}
              </p>
            </div>
            <div className="mt-1 flex shrink-0 items-center gap-2">
              {codecIsLossless && (
                <span
                  className="inline-flex items-center rounded px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase"
                  style={{
                    background: `${accentColor}22`,
                    color: accentColor,
                    border: `1px solid ${accentColor}55`,
                  }}
                >
                  {currentTrack?.codec}
                </span>
              )}
              <button
                className="rounded-full p-1.5 transition-all hover:text-[var(--text)]"
                style={{ color: "var(--text-subtle)" }}
                aria-label="Like"
                title="Like (coming soon)"
              >
                <Heart size={18} />
              </button>
            </div>
          </div>

          {/* Scrubber */}
          <div>
            <input
              type="range"
              className="scrubber w-full"
              min={0}
              max={durationMs || 100}
              value={positionMs}
              style={{ "--pct": `${progress}%` } as React.CSSProperties}
              onChange={(e) => api.playback.seek(Number(e.target.value))}
              aria-label="Seek"
            />
            <div
              className="mt-1 flex justify-between text-[11px] tabular-nums"
              style={{ color: "var(--text-subtle)" }}
            >
              <span>{formatDuration(positionMs)}</span>
              <span>{formatDuration(durationMs)}</span>
            </div>
          </div>

          {/* Transport controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => api.playback.command({ type: "setShuffle", enabled: !shuffle })}
              className={cn(
                "rounded p-1.5 transition-all duration-75 active:scale-90",
                shuffle
                  ? "text-[var(--gold)]"
                  : "text-[var(--text-subtle)] hover:text-[var(--text)]"
              )}
              aria-label="Shuffle"
            >
              <Shuffle size={17} />
            </button>

            <button
              onClick={() => api.playback.previous()}
              className="rounded p-1.5 transition-all duration-75 hover:text-[var(--text)] active:scale-90"
              style={{ color: "var(--text-muted)" }}
              aria-label="Previous"
            >
              <SkipBack size={24} fill="currentColor" />
            </button>

            <button
              onClick={() => (isPlaying ? api.playback.pause() : api.playback.resume())}
              className="flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-75 hover:scale-105 active:scale-90"
              style={{
                background: "var(--text)",
                color: "var(--bg)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" style={{ marginLeft: 2 }} />
              )}
            </button>

            <button
              onClick={() => api.playback.next()}
              className="rounded p-1.5 transition-all duration-75 hover:text-[var(--text)] active:scale-90"
              style={{ color: "var(--text-muted)" }}
              aria-label="Next"
            >
              <SkipForward size={24} fill="currentColor" />
            </button>

            <button
              onClick={() =>
                api.playback.command({
                  type: "setRepeat",
                  mode: repeat === "off" ? "all" : repeat === "all" ? "one" : "off",
                })
              }
              className={cn(
                "rounded p-1.5 transition-all duration-75 active:scale-90",
                repeat !== "off"
                  ? "text-[var(--gold)]"
                  : "text-[var(--text-subtle)] hover:text-[var(--text)]"
              )}
              aria-label="Repeat"
            >
              <RepeatIcon size={17} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => api.playback.command({ type: muted ? "unmute" : "mute" })}
              className="shrink-0 transition-all duration-75 hover:text-[var(--text)] active:scale-90"
              style={{ color: "var(--text-subtle)" }}
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
              className="scrubber flex-1"
              style={{ "--pct": `${volPct}%` } as React.CSSProperties}
              aria-label="Volume"
            />
          </div>
        </div>

        {/* ── Right: lyrics / queue ─────────────────────────────────── */}
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl"
          style={{
            background: "rgba(9, 9, 15, 0.6)",
            backdropFilter: "blur(28px)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Panel tabs */}
          <div
            className="flex shrink-0 gap-0 px-4 pt-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            {(["lyrics", "queue"] as Panel[]).map((p) => (
              <button
                key={p}
                onClick={() => setPanel(p)}
                className="relative flex items-center gap-1.5 px-4 pt-1 pb-3 text-sm font-medium capitalize transition-colors duration-75"
                style={{
                  color: panel === p ? "var(--text)" : "var(--text-subtle)",
                }}
              >
                {p === "lyrics" ? <FileText size={13} /> : <ListMusic size={13} />}
                {p}
                {panel === p && (
                  <motion.div
                    layoutId="panel-underline"
                    className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full"
                    style={{ background: accentColor }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {panel === "lyrics" ? (
                <motion.div
                  key="lyrics"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="h-full"
                >
                  {lyricsQuery.isPending ? (
                    <div className="flex h-full items-center justify-center">
                      <div
                        className="h-5 w-5 animate-spin rounded-full border-2"
                        style={{ borderColor: accentColor, borderTopColor: "transparent" }}
                      />
                    </div>
                  ) : lyricsQuery.data ? (
                    <Lyrics
                      lines={lyricsQuery.data.synced}
                      plain={lyricsQuery.data.plain}
                      positionMs={positionMs}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                      <FileText size={32} style={{ color: "var(--text-subtle)" }} />
                      <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
                        No lyrics found
                      </p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="queue"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="h-full overflow-y-auto"
                >
                  <QueuePanel accentColor={accentColor} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function QueuePanel({ accentColor }: { accentColor: string }) {
  const { queue, queueIndex } = usePlayerStore();
  const tracksQuery = useQuery({
    queryKey: ["tracks"],
    queryFn: () => api.library.tracks(5000, 0),
    staleTime: 60_000,
  });
  const trackMap = new Map(tracksQuery.data?.map((t) => [t.id, t]) ?? []);

  if (queue.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <ListMusic size={32} style={{ color: "var(--text-subtle)" }} />
        <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
          Queue is empty
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-2">
      {queue.map((id, i) => {
        const track = trackMap.get(id);
        const isCurrent = i === queueIndex;
        return (
          <div
            key={`${id}-${i}`}
            className="flex cursor-default items-center gap-3 px-4 py-2.5 transition-colors duration-75"
            style={{
              background: isCurrent ? `${accentColor}18` : undefined,
              borderLeft: `2px solid ${isCurrent ? accentColor : "transparent"}`,
            }}
            onMouseEnter={(e) => {
              if (!isCurrent)
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "";
            }}
          >
            <span
              className="w-5 shrink-0 text-center text-xs tabular-nums"
              style={{ color: isCurrent ? accentColor : "var(--text-subtle)" }}
            >
              {isCurrent ? "♪" : i + 1}
            </span>
            {track && coverUrl(track.coverPath) ? (
              <img
                src={coverUrl(track.coverPath)}
                alt=""
                className="h-8 w-8 shrink-0 rounded object-cover"
                style={{ opacity: 0.88 }}
              />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
                style={{ background: "var(--overlay)" }}
              >
                <Music2 size={11} style={{ color: "var(--text-subtle)" }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-medium"
                style={{ color: isCurrent ? accentColor : "var(--text)" }}
              >
                {track?.title ?? id}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                {track?.artist}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums" style={{ color: "var(--text-subtle)" }}>
              {track ? formatDuration(track.durationMs) : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
