import { useRef, useEffect } from 'react'

interface LyricLine {
  time: number
  text: string
}

interface Props {
  lines: LyricLine[]
  positionMs: number
}

export function Lyrics({ lines, positionMs }: Props) {
  let activeIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].time * 1000 <= positionMs) { activeIdx = i; break }
  }
  const activeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIdx])

  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--text-3)] text-sm">No lyrics available</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto py-8 px-6 space-y-3">
      {lines.map((line, i) => {
        const isActive = i === activeIdx
        const isPast = i < activeIdx

        return (
          <div
            key={i}
            ref={isActive ? activeRef : null}
            className="text-center transition-all duration-300"
            style={{
              color: isActive ? 'var(--accent)' : isPast ? 'var(--text-2)' : 'var(--text-3)',
              fontWeight: isActive ? 600 : 400,
              fontSize: isActive ? '18px' : '15px',
            }}
          >
            {line.text}
          </div>
        )
      })}
    </div>
  )
}
