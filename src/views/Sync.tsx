import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Wifi, Cloud, RefreshCw, ArrowDownToLine } from 'lucide-react'
import { api } from '@/api'
import { useLanSyncStore } from '@/state/lanSync'

type Tab = 'cloud' | 'lan'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {children}
    </div>
  )
}

export function Sync() {
  const [tab, setTab] = useState<Tab>('cloud')
  const lanStore = useLanSyncStore()

  const { data: cloudStatus, refetch: refetchCloud } = useQuery({
    queryKey: ['cloud-status'],
    queryFn: api.cloud.getStatus,
    refetchInterval: 3000,
  })

  const syncAllMutation = useMutation({
    mutationFn: api.cloud.syncAll,
    onSuccess: () => refetchCloud(),
  })

  const pullMutation = useMutation({
    mutationFn: api.cloud.pull,
    onSuccess: () => refetchCloud(),
  })

  const lanSyncMutation = useMutation({
    mutationFn: api.lan.startSync,
    onMutate: () => lanStore.setSyncing(true),
    onSettled: () => lanStore.setSyncing(false),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: '16px' }}>
          Sync
        </h1>

        {/* Pill tab switcher */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--control-bg)',
            borderRadius: '10px',
            padding: '3px',
            marginBottom: '20px',
          }}
        >
          {([
            { value: 'cloud' as Tab, icon: Cloud, label: 'Cloud Sync' },
            { value: 'lan' as Tab, icon: Wifi, label: 'LAN Sync' },
          ]).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                background: tab === value ? 'var(--control-active)' : 'transparent',
                color: tab === value ? 'var(--control-text)' : 'var(--control-text-inactive)',
                boxShadow: tab === value ? 'var(--control-active-shadow)' : 'none',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Panels */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {tab === 'cloud' && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                  Cloud Sync
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                  {cloudStatus?.isConfigured
                    ? 'sravya.api.lawarnaaree.com.np'
                    : 'Configure in Settings → Cloud Sync'}
                </p>
              </div>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: cloudStatus?.isConfigured ? 'var(--green)' : 'var(--text-3)',
                }}
              />
            </div>

            {cloudStatus?.lastSyncedAt && (
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px' }}>
                Last uploaded: {new Date(cloudStatus.lastSyncedAt).toLocaleString()}
              </p>
            )}
            {cloudStatus?.lastPullAt && (
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px' }}>
                Last pulled: {new Date(cloudStatus.lastPullAt).toLocaleString()}
              </p>
            )}
            {!cloudStatus?.lastSyncedAt && !cloudStatus?.lastPullAt && (
              <div style={{ height: '8px' }} />
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => syncAllMutation.mutate()}
                disabled={!cloudStatus?.isConfigured || syncAllMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: cloudStatus?.isConfigured ? 'pointer' : 'not-allowed',
                  background: 'var(--accent)',
                  color: '#fff',
                  opacity: (!cloudStatus?.isConfigured || syncAllMutation.isPending) ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <RefreshCw size={14} style={{ animation: syncAllMutation.isPending ? 'spin 1s linear infinite' : 'none' }} />
                {syncAllMutation.isPending ? 'Uploading…' : 'Upload All'}
              </button>

              <button
                onClick={() => pullMutation.mutate()}
                disabled={!cloudStatus?.isConfigured || pullMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: cloudStatus?.isConfigured ? 'pointer' : 'not-allowed',
                  background: 'var(--border)',
                  color: 'var(--text)',
                  opacity: (!cloudStatus?.isConfigured || pullMutation.isPending) ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <ArrowDownToLine size={14} />
                {pullMutation.isPending ? 'Pulling…' : 'Pull'}
              </button>
            </div>

            {(syncAllMutation.isSuccess || pullMutation.isSuccess) && (
              <p style={{ fontSize: '13px', color: 'var(--green)', marginTop: '12px' }}>✓ Done</p>
            )}
          </Card>
        )}

        {tab === 'lan' && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                  WiFi Sync
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                  {lanStore.isConnected
                    ? `Connected to ${lanStore.serverName ?? lanStore.serverUrl}`
                    : 'Not paired with any desktop'}
                </p>
              </div>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: lanStore.isConnected ? 'var(--green)' : 'var(--text-3)',
                }}
              />
            </div>

            {lanStore.isSyncing && lanStore.fileProgress && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px' }}>
                  Syncing: {lanStore.fileProgress.title}
                </p>
                <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: '2px',
                      background: 'var(--accent)',
                      width: `${Math.round((lanStore.fileProgress.bytesReceived / lanStore.fileProgress.totalBytes) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {lanStore.syncProgress && !lanStore.isSyncing && (
              <p style={{ fontSize: '13px', color: 'var(--green)', marginBottom: '12px' }}>
                ✓ {lanStore.syncProgress.synced} synced, {lanStore.syncProgress.skipped} skipped
                {lanStore.syncProgress.errors > 0 && `, ${lanStore.syncProgress.errors} errors`}
              </p>
            )}

            <button
              onClick={() => lanSyncMutation.mutate()}
              disabled={!lanStore.isConnected || lanStore.isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                cursor: lanStore.isConnected ? 'pointer' : 'not-allowed',
                background: 'var(--accent)',
                color: '#fff',
                opacity: (!lanStore.isConnected || lanStore.isSyncing) ? 0.5 : 1,
              }}
            >
              <RefreshCw size={14} style={{ animation: lanStore.isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              {lanStore.isSyncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </Card>
        )}
      </div>
    </div>
  )
}
