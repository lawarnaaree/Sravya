import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NowPlayingBar from "@/components/NowPlayingBar";
import { usePlayerStore } from "@/state/player";
import type { Track } from "@/api";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  convertFileSrc: (path: string) => `asset://${path}`,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { layoutId?: string }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const MOCK_TRACK: Track = {
  id: "t1",
  title: "Ek Pyaar Ka Nagma",
  artist: "Lata Mangeshkar",
  album: "Shor",
  durationMs: 195000,
  filePath: "/music/epkn.flac",
  fileHash: "abc",
  codec: "FLAC",
  playCount: 1,
  addedAt: "2025-01-01T00:00:00Z",
};

const INITIAL_STORE = {
  state: "stopped" as const,
  currentTrack: undefined,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: "off" as const,
  queue: [],
  queueIndex: 0,
  isFullScreen: false,
};

beforeEach(() => {
  usePlayerStore.setState(INITIAL_STORE);
});

describe("NowPlayingBar — idle (no track)", () => {
  it("renders transport controls", () => {
    render(<NowPlayingBar />);
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("renders shuffle and repeat buttons", () => {
    render(<NowPlayingBar />);
    expect(screen.getByRole("button", { name: /shuffle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /repeat/i })).toBeInTheDocument();
  });

  it("renders volume control", () => {
    render(<NowPlayingBar />);
    expect(screen.getByRole("slider", { name: /volume/i })).toBeInTheDocument();
  });

  it("does not show maximize button when no track", () => {
    render(<NowPlayingBar />);
    // The maximize button only renders when a track is loaded
    expect(screen.queryByRole("button", { name: /open full player/i })).not.toBeInTheDocument();
  });
});

describe("NowPlayingBar — with track", () => {
  beforeEach(() => {
    usePlayerStore.setState({ currentTrack: MOCK_TRACK, durationMs: 195000, state: "playing" });
  });

  it("shows track title and artist", () => {
    render(<NowPlayingBar />);
    expect(screen.getByText("Ek Pyaar Ka Nagma")).toBeInTheDocument();
    expect(screen.getByText("Lata Mangeshkar")).toBeInTheDocument();
  });

  it("shows FLAC lossless badge", () => {
    render(<NowPlayingBar />);
    expect(screen.getByText("FLAC")).toBeInTheDocument();
  });

  it("shows Pause button when playing", () => {
    render(<NowPlayingBar />);
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("shows maximize button", () => {
    render(<NowPlayingBar />);
    // The button element specifically (not the album art wrapper which also has the title)
    expect(screen.getAllByTitle(/open full player/i).find((el) => el.tagName === "BUTTON")).toBeTruthy();
  });
});

describe("NowPlayingBar — with MP3 track", () => {
  it("does not show lossless badge for MP3", () => {
    usePlayerStore.setState({
      currentTrack: { ...MOCK_TRACK, codec: "MP3" },
      durationMs: 195000,
      state: "playing",
    });
    render(<NowPlayingBar />);
    expect(screen.queryByText("MP3")).not.toBeInTheDocument();
  });
});

describe("NowPlayingBar — mute button", () => {
  it("shows mute button label", () => {
    usePlayerStore.setState({ muted: false });
    render(<NowPlayingBar />);
    expect(screen.getByRole("button", { name: /mute/i })).toBeInTheDocument();
  });

  it("shows unmute label when muted", () => {
    usePlayerStore.setState({ muted: true });
    render(<NowPlayingBar />);
    expect(screen.getByRole("button", { name: /unmute/i })).toBeInTheDocument();
  });
});

describe("NowPlayingBar — fullscreen button", () => {
  it("calls setFullScreen when maximize is clicked", async () => {
    usePlayerStore.setState({ currentTrack: MOCK_TRACK });
    const user = userEvent.setup();
    render(<NowPlayingBar />);
    const btn = screen.getAllByTitle(/open full player/i).find((el) => el.tagName === "BUTTON")!;
    await user.click(btn);
    expect(usePlayerStore.getState().isFullScreen).toBe(true);
  });
});
