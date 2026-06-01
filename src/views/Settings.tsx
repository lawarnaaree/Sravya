import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Moon, Sun, Cloud, CloudOff } from 'lucide-react'
import { api } from '@/api'
import type { CloudSettings } from '@/api'
import { useTheme } from '@/hooks/useTheme'
import { EqualizerPanel } from '@/components/EqualizerPanel'
import { QRCodeSVG } from 'qrcode.react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <p
        style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-3)',
          padding: '0 4px',
          marginBottom: '8px',
        }}
      >
        {title}
      </p>
      <div
        style={{
          background: 'var(--surface-raised)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: last ? 'none' : '1px solid var(--separator)',
        minHeight: '48px',
      }}
    >
      <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 400 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center' }}>{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '26px',
        borderRadius: '13px',
        border: 'none',
        cursor: 'pointer',
        padding: '3px',
        background: checked ? 'var(--accent)' : 'var(--border)',
        transition: 'background 0.2s ease',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform 0.2s ease',
        }}
      />
    </button>
  )
}

export function Settings() {
  const { theme, toggle } = useTheme()

  const { data: cloudSettings } = useQuery({
    queryKey: ['cloud-settings'],
    queryFn: api.cloud.getSettings,
  })

  const { data: cloudStatus } = useQuery({
    queryKey: ['cloud-status'],
    queryFn: api.cloud.getStatus,
    refetchInterval: 5000,
  })

  const { data: pairingUrl } = useQuery({
    queryKey: ['pairing-qr'],
    queryFn: api.lan.getPairingQr,
  })

  const [draftCloud, setDraftCloud] = useState<CloudSettings | null>(null)
  const cloud = draftCloud ?? cloudSettings ?? { apiUrl: '', apiKey: '', autoSync: false }

  const saveCloudMutation = useMutation({
    mutationFn: api.cloud.setSettings,
    onSuccess: () => setDraftCloud(null),
  })

  const inputStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid var(--separator)',
    background: 'var(--control-bg)',
    color: 'var(--text)',
    outline: 'none',
    width: '240px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '24px 24px 8px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px' }}>
          Settings
        </h1>
      </div>

      <div style={{ flex: 1, padding: '16px 24px 40px' }}>
        {/* Appearance */}
        <Section title="Appearance">
          <Row label="Theme" last>
            <button
              onClick={toggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: 'var(--bg)',
                color: 'var(--text)',
              }}
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </button>
          </Row>
        </Section>

        {/* Cloud Sync */}
        <Section title="Cloud Sync">
          <Row label="Server URL">
            <input
              type="url"
              value={cloud.apiUrl}
              onChange={e => setDraftCloud({ ...cloud, apiUrl: e.target.value })}
              placeholder="https://sravya.api.lawarnaaree.com.np"
              style={inputStyle}
            />
          </Row>
          <Row label="API Key">
            <input
              type="password"
              value={cloud.apiKey}
              onChange={e => setDraftCloud({ ...cloud, apiKey: e.target.value })}
              placeholder="Bearer token"
              style={inputStyle}
            />
          </Row>
          <Row label="Auto-sync on download">
            <Toggle
              checked={cloud.autoSync}
              onChange={v => setDraftCloud({ ...cloud, autoSync: v })}
            />
          </Row>
          <Row label="Status">
            <span
              style={{
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: cloudStatus?.isConfigured ? 'var(--green)' : 'var(--text-3)',
              }}
            >
              {cloudStatus?.isConfigured ? <Cloud size={13} /> : <CloudOff size={13} />}
              {cloudStatus?.isConfigured ? 'Connected' : 'Not configured'}
            </span>
          </Row>
          <div style={{ padding: '12px 16px' }}>
            <button
              onClick={() => saveCloudMutation.mutate(cloud)}
              disabled={!draftCloud || saveCloudMutation.isPending}
              style={{
                padding: '7px 18px',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: draftCloud ? 'pointer' : 'not-allowed',
                background: 'var(--accent)',
                color: '#fff',
                opacity: (!draftCloud || saveCloudMutation.isPending) ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {saveCloudMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Section>

        {/* Device Pairing */}
        {pairingUrl && (
          <Section title="Device Pairing">
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', textAlign: 'center' }}>
                Scan with iOS Sravya to pair
              </p>
              <div style={{ padding: '12px', background: '#fff', borderRadius: '14px', boxShadow: 'var(--shadow-card)' }}>
                <QRCodeSVG value={pairingUrl} size={160} />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>{pairingUrl}</p>
            </div>
          </Section>
        )}

        {/* Equalizer */}
        <Section title="Equalizer">
          <div style={{ padding: '16px' }}>
            <EqualizerPanel />
          </div>
        </Section>
      </div>
    </div>
  )
}
