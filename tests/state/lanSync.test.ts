import { describe, it, expect, beforeEach } from "vitest";
import { useLanSyncStore } from "../../src/state/lanSync";

describe("useLanSyncStore", () => {
  beforeEach(() => {
    useLanSyncStore.setState({
      isPaired: false,
      serverUrl: null,
      serverName: null,
      isSyncing: false,
      syncProgress: 0,
      lastSyncedAt: null,
      discoveredServers: [],
      fileProgress: {},
    });
  });

  it("starts unpaired", () => {
    const { isPaired, serverUrl } = useLanSyncStore.getState();
    expect(isPaired).toBe(false);
    expect(serverUrl).toBeNull();
  });

  it("setPaired marks as paired with URL and name", () => {
    useLanSyncStore.getState().setPaired("http://192.168.1.42:7272", "Sravya-Desktop");
    const { isPaired, serverUrl, serverName } = useLanSyncStore.getState();
    expect(isPaired).toBe(true);
    expect(serverUrl).toBe("http://192.168.1.42:7272");
    expect(serverName).toBe("Sravya-Desktop");
  });

  it("setUnpaired resets server info", () => {
    useLanSyncStore.getState().setPaired("http://192.168.1.42:7272", "Sravya-Desktop");
    useLanSyncStore.getState().setUnpaired();
    const { isPaired, serverUrl, serverName } = useLanSyncStore.getState();
    expect(isPaired).toBe(false);
    expect(serverUrl).toBeNull();
    expect(serverName).toBeNull();
  });

  it("setSyncing updates syncing state and progress", () => {
    useLanSyncStore.getState().setSyncing(true, 0.42);
    const { isSyncing, syncProgress } = useLanSyncStore.getState();
    expect(isSyncing).toBe(true);
    expect(syncProgress).toBeCloseTo(0.42);
  });

  it("setFileProgress tracks per-file progress", () => {
    useLanSyncStore.getState().setFileProgress("abc123", 0.75);
    useLanSyncStore.getState().setFileProgress("def456", 0.25);
    const { fileProgress } = useLanSyncStore.getState();
    expect(fileProgress["abc123"]).toBeCloseTo(0.75);
    expect(fileProgress["def456"]).toBeCloseTo(0.25);
  });

  it("setFileProgress merges without overwriting other files", () => {
    useLanSyncStore.getState().setFileProgress("abc123", 0.5);
    useLanSyncStore.getState().setFileProgress("xyz789", 1.0);
    const { fileProgress } = useLanSyncStore.getState();
    expect(fileProgress["abc123"]).toBeCloseTo(0.5);
    expect(fileProgress["xyz789"]).toBeCloseTo(1.0);
  });

  it("setDiscoveredServers replaces the list", () => {
    useLanSyncStore.getState().setDiscoveredServers([
      { name: "Sravya-PC._sravya._tcp.local.", host: "192.168.1.10", port: 7272, address: "http://192.168.1.10:7272" },
    ]);
    const { discoveredServers } = useLanSyncStore.getState();
    expect(discoveredServers).toHaveLength(1);
    expect(discoveredServers[0].host).toBe("192.168.1.10");
  });
});
