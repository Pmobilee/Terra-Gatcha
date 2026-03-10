import { afterEach, describe, expect, it } from 'vitest'
import {
  clearAllAuthTokens,
  persistAccessToken,
  persistRefreshToken,
  readAccessToken,
  readRefreshToken,
} from '../../src/services/authTokens'

describe('authTokens', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('prefers the canonical access token key', () => {
    localStorage.setItem('terra_auth_token', 'canonical-token')
    localStorage.setItem('tg_access_token', 'legacy-token')

    expect(readAccessToken()).toBe('canonical-token')
  })

  it('falls back to the legacy key when canonical key is missing', () => {
    localStorage.setItem('tg_access_token', 'legacy-token')

    expect(readAccessToken()).toBe('legacy-token')
  })

  it('writes canonical key and clears legacy key on persistAccessToken', () => {
    localStorage.setItem('tg_access_token', 'legacy-token')

    persistAccessToken('new-token')

    expect(localStorage.getItem('terra_auth_token')).toBe('new-token')
    expect(localStorage.getItem('tg_access_token')).toBeNull()
  })

  it('reads and clears refresh token via helpers', () => {
    persistRefreshToken('refresh-token')
    expect(readRefreshToken()).toBe('refresh-token')

    clearAllAuthTokens()
    expect(localStorage.getItem('terra_auth_token')).toBeNull()
    expect(localStorage.getItem('tg_access_token')).toBeNull()
    expect(localStorage.getItem('terra_refresh_token')).toBeNull()
  })
})
