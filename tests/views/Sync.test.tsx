import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sync from "../../src/views/Sync";
import { renderWithProviders } from "../helpers";
import { useLanSyncStore } from "../../src/state/lanSync";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: vi.fn().mockResolvedValue("windows"),
}));

describe("Sync view", () => {
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

  it("renders 'Not connected' when not paired", () => {
    renderWithProviders(<Sync />);
    expect(screen.getByText("Not connected")).toBeTruthy();
  });

  it("shows Find Desktop button", () => {
    renderWithProviders(<Sync />);
    expect(screen.getByRole("button", { name: /find desktop/i })).toBeTruthy();
  });

  it("calls discover_servers when Find Desktop is clicked", async () => {
    const user = userEvent.setup();
    const { invoke } = await import("@tauri-apps/api/core");
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    renderWithProviders(<Sync />);
    await user.click(screen.getByRole("button", { name: /find desktop/i }));

    expect(invoke).toHaveBeenCalledWith("discover_servers", expect.objectContaining({ timeoutSecs: 5 }));
  });

  it("shows Sync Now when paired", () => {
    useLanSyncStore.setState({ isPaired: true, serverUrl: "http://192.168.1.1:7272", serverName: "Desktop" });
    renderWithProviders(<Sync />);
    expect(screen.getByRole("button", { name: /sync now/i })).toBeTruthy();
  });

  it("shows sync progress bar when syncing", () => {
    useLanSyncStore.setState({
      isPaired: true,
      serverUrl: "http://192.168.1.1:7272",
      serverName: "Desktop",
      isSyncing: true,
      syncProgress: 0.5,
    });
    renderWithProviders(<Sync />);
    expect(screen.getAllByText(/syncing/i).length).toBeGreaterThan(0);
  });
});
