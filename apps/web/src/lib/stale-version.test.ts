import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, reloadForNewVersion } from './stale-version'

describe('isChunkLoadError', () => {
  it('recognises the lazy-page fetch failures of Chrome, Firefox and Safari', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/a.js')),
    ).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: a.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('leaves ordinary errors alone', () => {
    expect(isChunkLoadError(new TypeError('l is not a function'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('reloadForNewVersion', () => {
  const reload = vi.fn()
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    vi.stubGlobal('window', { location: { reload } })
    reload.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reloads once, then refuses to loop within 30 seconds', () => {
    expect(reloadForNewVersion()).toBe(true)
    expect(reloadForNewVersion()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
