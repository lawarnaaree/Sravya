import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Sidebar } from '@/components/Sidebar'
import { renderWithProviders } from '../helpers'

describe('Sidebar', () => {
  it('renders navigation links', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('Library')).toBeInTheDocument()
    expect(screen.getByText('Playlists')).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Sync')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders the app name', () => {
    renderWithProviders(<Sidebar />)
    expect(screen.getByText('Sravya')).toBeInTheDocument()
  })

  it('library link points to /library', () => {
    renderWithProviders(<Sidebar />)
    const link = screen.getByText('Library').closest('a')
    expect(link).toHaveAttribute('href', '/library')
  })
})
