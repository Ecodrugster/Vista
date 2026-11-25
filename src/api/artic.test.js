import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../lib/fixtures/sample.json';
import { RATE_LIMIT_ERROR, createArticClient } from './artic.js';

function makeJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

describe('artic API client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queues requests to at most 1 request per second using fake timers', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(makeJsonResponse(fixture)));
    const client = createArticClient({ fetchImpl: fetchMock, minIntervalMs: 1000 });

    const p1 = client.searchArtworks('gold', 1);
    const p2 = client.searchArtworks('gold', 2);
    const p3 = client.searchArtworks('gold', 3);

    // Wait microtasks for the first request to fire immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // At 999ms the second request must still be queued
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // At 1000ms the second request runs
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // At 2000ms the third request runs
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await Promise.all([p1, p2, p3]);
  });

  it('serves repeated identical requests from Map cache without hitting fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(makeJsonResponse(fixture)));
    const client = createArticClient({ fetchImpl: fetchMock, minIntervalMs: 1000 });

    const first = await client.searchArtworks('gold', 1);
    const second = await client.searchArtworks('gold', 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.data).toEqual(first.data);
    expect(second.iiifUrl).toBe('https://www.artic.edu/iiif/2');
  });

  it('throws friendly Russian message on HTTP 429', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(makeJsonResponse({}, 429)));
    const client = createArticClient({ fetchImpl: fetchMock, minIntervalMs: 1000 });

    await expect(client.searchArtworks('gold', 1)).rejects.toThrow(RATE_LIMIT_ERROR);
  });

  it('aborts stale queued requests via AbortController without calling fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(makeJsonResponse(fixture)));
    const client = createArticClient({ fetchImpl: fetchMock, minIntervalMs: 1000 });

    const p1 = client.searchArtworks('gold', 1);
    const controller = new AbortController();
    const p2 = client.searchArtworks('silver', 1, { signal: controller.signal });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    controller.abort();
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' });

    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await p1;
  });

  it('loads multiple artworks in a single batch request preserving requested order', async () => {
    const reversed = {
      config: fixture.config,
      data: [...fixture.data].reverse(),
    };
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(makeJsonResponse(reversed)));
    const client = createArticClient({ fetchImpl: fetchMock, minIntervalMs: 1000 });

    const res = await client.getArtworks([594, 2283, 147192]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/artworks?ids=594%2C2283%2C147192');
    expect(res.data.map((w) => w.id)).toEqual([594, 2283, 147192]);
  });
});
