import { afterEach, describe, expect, it, vi } from 'vitest'
import { authedGet, authedPost } from '../../src/services/authedFetch'
import { ApiError } from '../../src/services/apiClient'

type FetchCall = [input: RequestInfo | URL, init?: RequestInit]

describe('authedFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('adds bearer token from terra_auth_token', async () => {
    localStorage.setItem('terra_auth_token', 'token-main')
    const json = vi.fn().mockResolvedValue({ ok: true })
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json,
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await authedGet('/duels/pending')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer token-main')
  })

  it('falls back to tg_access_token when terra_auth_token is missing', async () => {
    localStorage.setItem('tg_access_token', 'token-legacy')
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await authedPost('/players/friends/request', { playerId: 'abc' })

    const [, init] = fetchMock.mock.calls[0]
    expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer token-legacy')
  })

  it('throws ApiError with server message for non-2xx responses', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue({ message: 'No access' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(authedGet('/players/secret')).rejects.toMatchObject<ApiError>({
      name: 'ApiError',
      message: 'No access',
      status: 403,
    })
  })

  it('throws network ApiError when fetch rejects', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockRejectedValue(
      new Error('offline'),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(authedGet('/duels/pending')).rejects.toMatchObject<ApiError>({
      name: 'ApiError',
      code: 'NETWORK_ERROR',
      status: 0,
    })
  })
})
