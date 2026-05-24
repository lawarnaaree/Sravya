import { platform } from "@tauri-apps/plugin-os";
import { useState } from "react";

type PlatformKind = "desktop" | "ios";

export function usePlatform(): PlatformKind {
  const [plat] = useState<PlatformKind>(() => {
    try {
      const p = platform();
      return p === "ios" ? "ios" : "desktop";
    } catch {
      return "desktop";
    }
  });
  return plat;
}
