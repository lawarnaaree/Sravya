import { describe, it, expect, beforeEach } from "vitest";
import { usePlayerStore } from "@/state/player";
import type { Track } from "@/api";

const INITIAL: Parameters<typeof usePlayerStore.setState>[0] = {
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
  isFullScreen: false,
};

const MOCK_TRACK: Track = {
  id: "t1",
  title: "Rahe Na Rahe Hum",
  artist: "Lata Mangeshkar",
  album: "Mamta",
  durationMs: 245000,
  filePath: "/music/rahe.flac",
  fileHash: "abc123",
  codec: "FLAC",
  playCount: 3,
  addedAt: "2025-01-01T00:00:00Z",
};

beforeEach(() => {
  usePlayerStore.setState(INITIAL);
});

describe("usePlayerStore — initial state", () => {
  it("starts stopped", () => {
    expect(usePlayerStore.getState().state).toBe("stopped");
  });

  it("starts with no track", () => {
    expect(usePlayerStore.getState().currentTrack).toBeUndefined();
  });

  it("starts at position 0", () => {
    expect(usePlayerStore.getState().positionMs).toBe(0);
  });

  it("starts with full volume", () => {
    expect(usePlayerStore.getState().volume).toBe(1);
  });

  it("starts not fullscreen", () => {
    expect(usePlayerStore.getState().isFullScreen).toBe(false);
  });
});

describe("usePlayerStore — setPosition", () => {
  it("updates positionMs", () => {
    usePlayerStore.getState().setPosition(32000);
    expect(usePlayerStore.getState().positionMs).toBe(32000);
  });
});

describe("usePlayerStore — setCurrentTrack", () => {
  it("stores the track", () => {
    usePlayerStore.getState().setCurrentTrack(MOCK_TRACK);
    expect(usePlayerStore.getState().currentTrack?.id).toBe("t1");
    expect(usePlayerStore.getState().currentTrack?.title).toBe("Rahe Na Rahe Hum");
  });

  it("can clear the track", () => {
    usePlayerStore.getState().setCurrentTrack(MOCK_TRACK);
    usePlayerStore.getState().setCurrentTrack(undefined);
    expect(usePlayerStore.getState().currentTrack).toBeUndefined();
  });
});

describe("usePlayerStore — setFullScreen", () => {
  it("sets fullscreen to true", () => {
    usePlayerStore.getState().setFullScreen(true);
    expect(usePlayerStore.getState().isFullScreen).toBe(true);
  });

  it("toggles back to false", () => {
    usePlayerStore.getState().setFullScreen(true);
    usePlayerStore.getState().setFullScreen(false);
    expect(usePlayerStore.getState().isFullScreen).toBe(false);
  });
});

describe("usePlayerStore — setStatus", () => {
  it("updates playback state", () => {
    usePlayerStore.getState().setStatus({ ...INITIAL, state: "playing" });
    expect(usePlayerStore.getState().state).toBe("playing");
  });

  it("updates shuffle and repeat together", () => {
    usePlayerStore.getState().setStatus({ ...INITIAL, shuffle: true, repeat: "all" });
    const s = usePlayerStore.getState();
    expect(s.shuffle).toBe(true);
    expect(s.repeat).toBe("all");
  });
});
