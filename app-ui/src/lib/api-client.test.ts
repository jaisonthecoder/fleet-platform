import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { apiClient, ApiRequestError } from './api-client'

describe('apiClient', () => {
  it('GETs and returns parsed JSON from the API base', async () => {
    server.use(http.get('/api/ping', () => HttpResponse.json({ ok: true })))

    await expect(apiClient.get('/ping')).resolves.toEqual({ ok: true })
  })

  it('POSTs a JSON body', async () => {
    server.use(
      http.post('/api/things', async ({ request }) => {
        const body = await request.json()
        return HttpResponse.json({ received: body }, { status: 201 })
      }),
    )

    await expect(apiClient.post('/things', { a: 1 })).resolves.toEqual({
      received: { a: 1 },
    })
  })

  it('normalises non-2xx responses to ApiRequestError', async () => {
    server.use(
      http.get('/api/fail', () =>
        HttpResponse.json({ title: 'Nope', reasons: ['bad'] }, { status: 422 }),
      ),
    )

    await expect(apiClient.get('/fail')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 422,
      message: 'Nope',
      reasons: ['bad'],
    })
    expect(new ApiRequestError(500, 'x')).toBeInstanceOf(Error)
  })

  it('returns undefined for 204 No Content', async () => {
    server.use(
      http.delete(
        '/api/things/1',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(apiClient.delete('/things/1')).resolves.toBeUndefined()
  })
})
