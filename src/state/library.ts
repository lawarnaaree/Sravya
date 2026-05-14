import { create } from "zustand";
import type { LibraryStats } from "@/api";

interface LibraryState {
  stats: LibraryStats | null;
  isScanning: boolean;
  scanProgress: number;
  setStats: (stats: LibraryStats) => void;
  setScanning: (scanning: boolean, progress?: number) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  stats: null,
  isScanning: false,
  scanProgress: 0,
  setStats: (stats) => set({ stats }),
  setScanning: (isScanning, scanProgress = 0) => set({ isScanning, scanProgress }),
}));
