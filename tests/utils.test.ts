import { describe, it, expect } from 'vitest'
import { formatDuration, pluralize, cn } from '@/lib/utils'

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(65000)).toBe('1:05')
  })

  it('formats minutes', () => {
    expect(formatDuration(3661000)).toBe('1:01:01')
  })

  it('pads single digit seconds', () => {
    expect(formatDuration(5000)).toBe('0:05')
  })

  it('returns 0:00 for 0', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('returns 0:00 for negative', () => {
    expect(formatDuration(-100)).toBe('0:00')
  })
})

describe('pluralize', () => {
  it('singular', () => {
    expect(pluralize(1, 'track')).toBe('1 track')
  })

  it('plural', () => {
    expect(pluralize(5, 'track')).toBe('5 tracks')
  })

  it('zero is plural', () => {
    expect(pluralize(0, 'track')).toBe('0 tracks')
  })

  it('custom plural', () => {
    expect(pluralize(2, 'library', 'libraries')).toBe('2 libraries')
  })
})

describe('cn', () => {
  it('merges classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates tailwind conflicts', () => {
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).toBe('text-blue-500')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'skip', 'end')).toBe('base end')
  })
})
