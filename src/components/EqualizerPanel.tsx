import React, { useState } from 'react'

const BANDS = [
  { freq: '32', label: '32Hz' },
  { freq: '64', label: '64Hz' },
  { freq: '125', label: '125Hz' },
  { freq: '250', label: '250Hz' },
  { freq: '500', label: '500Hz' },
  { freq: '1k', label: '1kHz' },
  { freq: '2k', label: '2kHz' },
  { freq: '4k', label: '4kHz' },
  { freq: '8k', label: '8kHz' },
  { freq: '16k', label: '16kHz' },
]

export function EqualizerPanel() {
  const [gains, setGains] = useState<number[]>(Array(10).fill(0))
  const [preamp, setPreamp] = useState(0)

  const setGain = (index: number, value: number) => {
    const next = [...gains]
    next[index] = value
    setGains(next)
  }

  const reset = () => {
    setGains(Array(10).fill(0))
    setPreamp(0)
  }

  return (
    <div
      className="p-4 rounded-2xl"
      style={{ background: 'var(--surface-raised)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
          Equalizer
        </h3>
        <button
          onClick={reset}
          className="text-[13px] font-medium"
          style={{ color: 'var(--accent)' }}
        >
          Reset
        </button>
      </div>

      {/* Preamp */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[12px] w-16 shrink-0" style={{ color: 'var(--text-2)' }}>
          Preamp
        </span>
        <input
          type="range"
          min={-12}
          max={12}
          step={0.5}
          value={preamp}
          onChange={e => setPreamp(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: 'var(--accent)' }}
        />
        <span className="text-[12px] w-10 text-right tabular-nums" style={{ color: 'var(--text-3)' }}>
          {preamp > 0 ? '+' : ''}{preamp}dB
        </span>
      </div>

      {/* Bands */}
      <div className="flex gap-2 justify-between">
        {BANDS.map((band, i) => (
          <div key={band.freq} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>
              {gains[i] > 0 ? '+' : ''}{gains[i]}
            </span>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={gains[i]}
              onChange={e => setGain(i, Number(e.target.value))}
              className="h-24 cursor-pointer"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                appearance: 'auto',
                accentColor: 'var(--accent)',
              } as React.CSSProperties}
            />
            <span className="text-[9px]" style={{ color: 'var(--text-3)' }}>
              {band.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
