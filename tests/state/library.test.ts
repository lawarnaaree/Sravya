import { describe, it, expect, beforeEach } from "vitest";
import { useLibraryStore } from "@/state/library";
import type { LibraryStats } from "@/api";

const MOCK_STATS: LibraryStats = {
  trackCount: 120,
  albumCount: 14,
  artistCount: 8,
  totalDurationMs: 345600000,
  watchedFolders: ["/music"],
};

beforeEach(() => {
  useLibraryStore.setState({ stats: null, isScanning: false, scanProgress: 0 });
});

describe("useLibraryStore — initial state", () => {
  it("has no stats", () => {
    expect(useLibraryStore.getState().stats).toBeNull();
  });

  it("is not scanning", () => {
    expect(useLibraryStore.getState().isScanning).toBe(false);
  });

  it("has zero scan progress", () => {
    expect(useLibraryStore.getState().scanProgress).toBe(0);
  });
});

describe("useLibraryStore — setStats", () => {
  it("stores library stats", () => {
    useLibraryStore.getState().setStats(MOCK_STATS);
    const s = useLibraryStore.getState();
    expect(s.stats?.trackCount).toBe(120);
    expect(s.stats?.albumCount).toBe(14);
    expect(s.stats?.watchedFolders).toEqual(["/music"]);
  });
});

describe("useLibraryStore — setScanning", () => {
  it("sets scanning to true with progress", () => {
    useLibraryStore.getState().setScanning(true, 42);
    const s = useLibraryStore.getState();
    expect(s.isScanning).toBe(true);
    expect(s.scanProgress).toBe(42);
  });

  it("defaults progress to 0 when not provided", () => {
    useLibraryStore.getState().setScanning(true);
    expect(useLibraryStore.getState().scanProgress).toBe(0);
  });

  it("sets scanning to false", () => {
    useLibraryStore.getState().setScanning(true, 100);
    useLibraryStore.getState().setScanning(false);
    expect(useLibraryStore.getState().isScanning).toBe(false);
  });
});
