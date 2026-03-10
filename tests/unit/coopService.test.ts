import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../src/services/apiClient'
import { createLobby, findByCode } from '../../src/services/coopService'

type FetchCall = [input: RequestInfo | URL, init?: RequestInit]

describe('coopService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('creates a lobby via authenticated helper flow', async () => {
    localStorage.setItem('terra_auth_token', 'token-main')
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ lobby: { id: 'room-1', code: 'ABC123' } }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(createLobby('p1', 'Miner')).resolves.toEqual({ roomId: 'room-1', code: 'ABC123' })

    const [, init] = fetchMock.mock.calls[0]
    expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer token-main')
  })

  it('returns null for missing invite code (404)', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: vi.fn().mockResolvedValue({ error: 'Lobby code not found' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(findByCode('BAD123')).resolves.toBeNull()
  })

  it('surfaces network errors from findByCode', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockRejectedValue(
      new Error('offline'),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(findByCode('NET123')).rejects.toMatchObject<ApiError>({
      name: 'ApiError',
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })
})
