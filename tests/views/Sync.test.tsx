import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { invoke } from '@tauri-apps/api/core'
import { Sync } from '@/views/Sync'
import { renderWithProviders } from '../helpers'

vi.mocked(invoke).mockImplementation(async (cmd: string) => {
  if (cmd === 'get_cloud_sync_status') {
    return { isConfigured: false, isSyncing: false, lastSyncedAt: null, lastPullAt: null }
  }
  return null
})

describe('Sync', () => {
  it('renders LAN Sync tab', () => {
    renderWithProviders(<Sync />)
    expect(screen.getByText('LAN Sync')).toBeInTheDocument()
  })

  it('renders Cloud Sync tab', () => {
    renderWithProviders(<Sync />)
    expect(screen.getAllByText('Cloud Sync').length).toBeGreaterThan(0)
  })

  it('shows cloud panel by default', () => {
    renderWithProviders(<Sync />)
    expect(screen.getByText('Cloud Sync', { selector: 'h3' })).toBeInTheDocument()
  })

  it('switches to LAN panel on tab click', async () => {
    renderWithProviders(<Sync />)
    await userEvent.click(screen.getByRole('button', { name: /lan sync/i }))
    await waitFor(() => {
      expect(screen.getByText('WiFi Sync')).toBeInTheDocument()
    })
  })
})
