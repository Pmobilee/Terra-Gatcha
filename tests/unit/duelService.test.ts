import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../src/services/apiClient'
import { duelService } from '../../src/services/duelService'

type FetchCall = [input: RequestInfo | URL, init?: RequestInit]

describe('duelService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('creates a duel challenge and returns duel id', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'duel-1' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(duelService.challengeDuel('friend-1', 50)).resolves.toEqual({ duelId: 'duel-1' })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/duels\/challenge$/)
  })

  it('normalizes wrapped pending duel responses', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ duels: [{ id: 'duel-2' }] }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const rows = await duelService.getPendingDuels()
    expect(rows).toEqual([{ id: 'duel-2' }])
  })

  it('surfaces backend errors on accept', async () => {
    const fetchMock = vi.fn<(...args: FetchCall) => Promise<Response>>().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: vi.fn().mockResolvedValue({ error: 'Already accepted' }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(duelService.acceptDuel('duel-3')).rejects.toMatchObject<ApiError>({
      status: 409,
      message: 'Already accepted',
    })
  })
})
