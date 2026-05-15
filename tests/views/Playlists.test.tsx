import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";
import Playlists from "@/views/Playlists";
import type { Playlist, Track } from "@/api";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: (path: string) => `asset://${path}`,
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: vi.fn(),
  }),
}));

function makePl(id: string, name: string): Playlist {
  return {
    id,
    name,
    trackCount: 1,
    totalDurationMs: 180000,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

const MOCK_TRACK: Track = {
  id: "tr1",
  title: "Resham Firiri",
  artist: "Traditional",
  album: "Folk",
  durationMs: 180000,
  filePath: "/music/resham.mp3",
  fileHash: "def",
  codec: "MP3",
  playCount: 0,
  addedAt: "2025-01-01T00:00:00Z",
};

describe("Playlists — empty state", () => {
  it("shows prompt when no playlist is selected", async () => {
    mockInvoke.mockResolvedValue([]);
    renderWithProviders(<Playlists />, { routerProps: { initialEntries: ["/playlists"] } });
    expect(await screen.findByText(/select a playlist/i)).toBeInTheDocument();
  });
});

describe("Playlists — with selected playlist", () => {
  it("shows playlist name and track list when id param is set", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_playlists") return Promise.resolve([makePl("p1", "Nepali Songs")]);
      if (cmd === "get_playlist_tracks") return Promise.resolve([MOCK_TRACK]);
      return Promise.resolve(null);
    });

    renderWithProviders(<Playlists />, {
      routerProps: { initialEntries: ["/playlists?id=p1"] },
    });

    expect(await screen.findByText("Nepali Songs")).toBeInTheDocument();
    expect(await screen.findByText(/1 tracks/)).toBeInTheDocument();
  });
});

describe("Playlists — create dialog via URL", () => {
  it("opens create dialog when ?create=true is in URL", async () => {
    mockInvoke.mockResolvedValue([]);
    renderWithProviders(<Playlists />, {
      routerProps: { initialEntries: ["/playlists?create=true"] },
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("New Playlist")).toBeInTheDocument();
  });

  it("closes dialog on Cancel click and removes ?create param", async () => {
    mockInvoke.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<Playlists />, {
      routerProps: { initialEntries: ["/playlists?create=true"] },
    });

    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("Create button is disabled when name is empty", async () => {
    mockInvoke.mockResolvedValue([]);
    renderWithProviders(<Playlists />, {
      routerProps: { initialEntries: ["/playlists?create=true"] },
    });

    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("Create button enables when name is typed", async () => {
    mockInvoke.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<Playlists />, {
      routerProps: { initialEntries: ["/playlists?create=true"] },
    });

    await screen.findByRole("dialog");
    await user.type(screen.getByPlaceholderText(/playlist name/i), "My New Playlist");
    expect(screen.getByRole("button", { name: /^create$/i })).not.toBeDisabled();
  });
});
