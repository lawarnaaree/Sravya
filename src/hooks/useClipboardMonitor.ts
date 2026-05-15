import { useEffect, useRef } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useDownloadQueueStore } from "@/state/downloadQueue";

const YOUTUBE_RE = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|live)|youtu\.be\/)/;

const POLL_MS = 1500;

export function useClipboardMonitor() {
  const lastSeen = useRef<string | null>(null);
  const setPendingUrl = useDownloadQueueStore((s) => s.setPendingUrl);
  const pendingUrl = useDownloadQueueStore((s) => s.pendingUrl);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        const text = await readText();
        if (text && text !== lastSeen.current && !pendingUrl && YOUTUBE_RE.test(text.trim())) {
          lastSeen.current = text.trim();
          setPendingUrl(text.trim());
        }
      } catch {
        // Clipboard empty or permission denied — ignore silently
      }
    }

    const id = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [setPendingUrl, pendingUrl]);
}
