import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

import { formatDuration, pluralize, cn, coverUrl } from "@/lib/utils";

describe("formatDuration", () => {
  it("formats zero as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatDuration(9000)).toBe("0:09");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(65000)).toBe("1:05");
  });

  it("pads seconds to two digits", () => {
    expect(formatDuration(120000)).toBe("2:00");
  });

  it("formats hours correctly", () => {
    expect(formatDuration(3661000)).toBe("1:01:01");
  });

  it("pads minutes when hours are present", () => {
    expect(formatDuration(3600000)).toBe("1:00:00");
  });
});

describe("pluralize", () => {
  it("uses singular for exactly 1", () => {
    expect(pluralize(1, "track", "tracks")).toBe("1 track");
  });

  it("uses plural for 0", () => {
    expect(pluralize(0, "track", "tracks")).toBe("0 tracks");
  });

  it("uses plural for more than 1", () => {
    expect(pluralize(5, "track", "tracks")).toBe("5 tracks");
  });
});

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false && "b", undefined)).toBe("a");
  });

  it("deduplicates conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("coverUrl", () => {
  it("returns undefined for null", () => {
    expect(coverUrl(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(coverUrl(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(coverUrl("")).toBeUndefined();
  });

  it("converts a file path via convertFileSrc", () => {
    expect(coverUrl("/music/cover.jpg")).toBe("asset:///music/cover.jpg");
  });
});
