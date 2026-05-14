import { create } from "zustand";
import type { PlaybackStatus, Track } from "@/api";

interface PlayerState extends PlaybackStatus {
  setStatus: (status: PlaybackStatus) => void;
  setPosition: (positionMs: number) => void;
  setCurrentTrack: (track: Track | undefined) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  state: "stopped",
  currentTrack: undefined,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: "off",
  queue: [],
  queueIndex: 0,

  setStatus: (status) => set(status),
  setPosition: (positionMs) => set({ positionMs }),
  setCurrentTrack: (currentTrack) => set({ currentTrack }),
}));
