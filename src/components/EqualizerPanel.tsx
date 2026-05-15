import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import type { EqSettings } from "@/api";

const FREQ_LABELS = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

export default function EqualizerPanel() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["eq-settings"],
    queryFn: () => api.eq.getSettings(),
  });

  const mutation = useMutation({
    mutationFn: (s: EqSettings) => api.eq.setSettings(s),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["eq-settings"] }),
  });

  if (!settings) return null;

  const update = (patch: Partial<EqSettings>) => {
    mutation.mutate({ ...settings, ...patch });
  };

  const updateBand = (index: number, gainDb: number) => {
    const bands = settings.bands.map((b, i) => (i === index ? { ...b, gainDb } : b));
    mutation.mutate({ ...settings, bands });
  };

  return (
    <div>
      {/* Enable + preamp row */}
      <div className="mb-4 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2">
          <div
            className="relative h-5 w-9 rounded-full transition-colors"
            style={{ background: settings.enabled ? "var(--gold)" : "var(--overlay)" }}
            onClick={() => update({ enabled: !settings.enabled })}
          >
            <div
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: settings.enabled ? "translateX(16px)" : "translateX(2px)" }}
            />
          </div>
          <span className="text-sm" style={{ color: "var(--text)" }}>
            Equalizer
          </span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
            Preamp
          </span>
          <input
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={settings.preampDb}
            onChange={(e) => update({ preampDb: parseFloat(e.target.value) })}
            className="w-20"
            disabled={!settings.enabled}
          />
          <span
            className="w-10 text-right text-xs tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {settings.preampDb > 0 ? "+" : ""}
            {settings.preampDb.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Band sliders */}
      <div
        className="flex items-end justify-between gap-1 rounded-xl p-4"
        style={{
          background: "var(--surface-raised)",
          opacity: settings.enabled ? 1 : 0.5,
          pointerEvents: settings.enabled ? "auto" : "none",
        }}
      >
        {settings.bands.map((band, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <span
              className="text-[10px] tabular-nums"
              style={{ color: band.gainDb !== 0 ? "var(--gold)" : "var(--text-subtle)" }}
            >
              {band.gainDb > 0 ? "+" : ""}
              {band.gainDb.toFixed(0)}
            </span>
            <div className="relative flex h-28 items-center justify-center">
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={band.gainDb}
                onChange={(e) => updateBand(i, parseFloat(e.target.value))}
                style={{
                  writingMode: "vertical-lr",
                  direction: "rtl",
                  height: "6rem",
                  width: "1.5rem",
                  cursor: "pointer",
                }}
                aria-label={`${FREQ_LABELS[i]} Hz`}
              />
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {FREQ_LABELS[i]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          className="text-xs transition-colors"
          style={{ color: "var(--text-subtle)" }}
          onClick={() =>
            update({ preampDb: 0, bands: settings.bands.map((b) => ({ ...b, gainDb: 0 })) })
          }
        >
          Reset all
        </button>
      </div>
    </div>
  );
}
