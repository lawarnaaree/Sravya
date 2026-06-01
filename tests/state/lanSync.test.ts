import { describe, it, expect, beforeEach } from 'vitest'
import { useLanSyncStore } from '@/state/lanSync'

beforeEach(() => {
  useLanSyncStore.setState({
    isConnected: false,
    serverUrl: null,
    serverName: null,
    isSyncing: false,
    syncProgress: null,
    lastSyncedAt: null,
    fileProgress: null,
  })
})

describe('useLanSyncStore', () => {
  it('starts disconnected', () => {
    expect(useLanSyncStore.getState().isConnected).toBe(false)
  })

  it('pairs with server', () => {
    useLanSyncStore.getState().setPaired('http://192.168.1.1:41892', 'My Desktop')
    const state = useLanSyncStore.getState()
    expect(state.isConnected).toBe(true)
    expect(state.serverUrl).toBe('http://192.168.1.1:41892')
    expect(state.serverName).toBe('My Desktop')
  })

  it('unpairs', () => {
    useLanSyncStore.getState().setPaired('http://192.168.1.1:41892')
    useLanSyncStore.getState().setUnpaired()
    expect(useLanSyncStore.getState().isConnected).toBe(false)
    expect(useLanSyncStore.getState().serverUrl).toBeNull()
  })

  it('sets syncing state', () => {
    useLanSyncStore.getState().setSyncing(true)
    expect(useLanSyncStore.getState().isSyncing).toBe(true)
    useLanSyncStore.getState().setSyncing(false)
    expect(useLanSyncStore.getState().isSyncing).toBe(false)
  })

  it('updates sync progress', () => {
    useLanSyncStore.getState().setSyncProgress({ synced: 5, skipped: 2, errors: 0 })
    expect(useLanSyncStore.getState().syncProgress?.synced).toBe(5)
  })

  it('sets last synced at', () => {
    useLanSyncStore.getState().setLastSyncedAt('2024-01-01T00:00:00Z')
    expect(useLanSyncStore.getState().lastSyncedAt).toBe('2024-01-01T00:00:00Z')
  })
})
