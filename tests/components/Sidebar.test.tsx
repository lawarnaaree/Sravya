import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import Sidebar from "@/components/Sidebar";
import type { Playlist } from "@/api";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: (path: string) => `asset://${path}`,
}));

function makePl(id: string, name: string): Playlist {
  return {
    id,
    name,
    trackCount: 2,
    totalDurationMs: 300000,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("Sidebar — navigation", () => {
  it("renders Library and Search nav links", async () => {
    mockInvoke.mockResolvedValue([]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("renders Settings nav link", () => {
    mockInvoke.mockResolvedValue([]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders Your Library section heading", () => {
    mockInvoke.mockResolvedValue([]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Your Library")).toBeInTheDocument();
  });
});

describe("Sidebar — empty playlists", () => {
  it("shows empty state text when no playlists", async () => {
    mockInvoke.mockResolvedValue([]);
    renderWithProviders(<Sidebar />);
    // React Query fetches async; empty message shows while loading or after empty resolve
    expect(await screen.findByText("No playlists yet")).toBeInTheDocument();
  });
});

describe("Sidebar — with playlists", () => {
  it("renders playlist names", async () => {
    mockInvoke.mockResolvedValue([makePl("1", "Nepali Songs"), makePl("2", "Chill Mix")]);
    renderWithProviders(<Sidebar />);
    expect(await screen.findByText("Nepali Songs")).toBeInTheDocument();
    expect(screen.getByText("Chill Mix")).toBeInTheDocument();
  });

  it("playlist links point to /playlists?id=<id>", async () => {
    mockInvoke.mockResolvedValue([makePl("abc", "My Playlist")]);
    renderWithProviders(<Sidebar />);
    const link = await screen.findByRole("link", { name: "My Playlist" });
    expect(link).toHaveAttribute("href", "/playlists?id=abc");
  });
});
