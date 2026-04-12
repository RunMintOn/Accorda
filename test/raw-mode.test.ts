import { describe, expect, it, vi } from 'vitest'
import { enableRawMode } from '../src/ui/input/rawMode'

describe('enableRawMode', () => {
  it('enables raw mode while the input shell is mounted', () => {
    const setRawMode = vi.fn()

    const cleanup = enableRawMode({
      isRawModeSupported: true,
      setRawMode,
    })

    expect(setRawMode).toHaveBeenCalledWith(true)

    cleanup()

    expect(setRawMode).toHaveBeenLastCalledWith(false)
  })

  it('does nothing when raw mode is unsupported', () => {
    const setRawMode = vi.fn()

    const cleanup = enableRawMode({
      isRawModeSupported: false,
      setRawMode,
    })
    cleanup()

    expect(setRawMode).not.toHaveBeenCalled()
  })
})
