import { create } from "zustand";

export interface DiscoveredServer {
  name: string;
  host: string;
  port: number;
  address: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  platform: string;
  pairedAt: string;
  lastSeenAt?: string;
}

interface LanSyncState {
  isPaired: boolean;
  serverUrl: string | null;
  serverName: string | null;
  isSyncing: boolean;
  syncProgress: number;
  lastSyncedAt: string | null;
  discoveredServers: DiscoveredServer[];
  fileProgress: Record<string, number>;

  setPaired: (serverUrl: string, serverName: string) => void;
  setUnpaired: () => void;
  setSyncing: (syncing: boolean, progress: number) => void;
  setLastSyncedAt: (ts: string | null) => void;
  setDiscoveredServers: (servers: DiscoveredServer[]) => void;
  setFileProgress: (hash: string, progress: number) => void;
}

export const useLanSyncStore = create<LanSyncState>((set) => ({
  isPaired: false,
  serverUrl: null,
  serverName: null,
  isSyncing: false,
  syncProgress: 0,
  lastSyncedAt: null,
  discoveredServers: [],
  fileProgress: {},

  setPaired: (serverUrl, serverName) => set({ isPaired: true, serverUrl, serverName }),
  setUnpaired: () => set({ isPaired: false, serverUrl: null, serverName: null }),
  setSyncing: (isSyncing, syncProgress) => set({ isSyncing, syncProgress }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setDiscoveredServers: (discoveredServers) => set({ discoveredServers }),
  setFileProgress: (hash, progress) =>
    set((s) => ({ fileProgress: { ...s.fileProgress, [hash]: progress } })),
}));
