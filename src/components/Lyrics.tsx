import { useEffect, useRef } from "react";
import type { LyricsLine } from "@/api";

interface Props {
  lines: LyricsLine[];
  plain?: string;
  positionMs: number;
}

export default function Lyrics({ lines, plain, positionMs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const activeIndex = (() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timeMs <= positionMs) idx = i;
      else break;
    }
    return idx;
  })();

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  if (lines.length === 0) {
    if (plain) {
      return (
        <div
          ref={containerRef}
          className="h-full overflow-y-auto px-6 py-4 text-center text-sm leading-7"
          style={{ color: "var(--text-muted)", whiteSpace: "pre-line" }}
        >
          {plain}
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
          No lyrics found
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-6 py-8">
      <div className="flex flex-col items-center gap-3">
        {lines.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className="max-w-lg text-center transition-all duration-300"
              style={{
                fontSize: isActive ? "1.1rem" : "0.95rem",
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? "var(--gold)"
                  : isPast
                    ? "var(--text-subtle)"
                    : "var(--text-muted)",
                opacity: isPast ? 0.5 : isActive ? 1 : 0.75,
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
