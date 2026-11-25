import { normalizeExpoIds } from '../lib/art.js';

const API_BASE = 'https://api.artic.edu/api/v1';

export const SEARCH_FIELDS = [
  'id',
  'title',
  'artist_display',
  'date_display',
  'date_start',
  'image_id',
  'thumbnail',
  'color',
].join(',');

export const ARTWORK_FIELDS = [
  'id',
  'title',
  'artist_display',
  'date_display',
  'date_start',
  'medium_display',
  'department_title',
  'image_id',
  'thumbnail',
  'color',
].join(',');

export const RATE_LIMIT_ERROR = 'Слишком много запросов, подождите минуту';

function createAbortError() {
  const err = new Error('Запрос отменён');
  err.name = 'AbortError';
  return err;
}

function waitMs(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(createAbortError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function createArticClient({ fetchImpl, minIntervalMs = 1000 } = {}) {
  const cache = new Map();
  let queueTail = Promise.resolve();
  let lastRequestAt = -Infinity;

  function runFetch(url, signal) {
    const init = { referrerPolicy: 'no-referrer' };
    if (signal) {
      init.signal = signal;
    }
    if (fetchImpl) {
      return fetchImpl(url, init);
    }
    if (typeof globalThis.fetch !== 'function') {
      throw new Error('fetch is not available');
    }
    return globalThis.fetch(url, init);
  }

  function enqueue(task, signal) {
    const run = async () => {
      if (signal?.aborted) throw createAbortError();
      const elapsed = Date.now() - lastRequestAt;
      const delay = minIntervalMs - elapsed;
      if (delay > 0) {
        await waitMs(delay, signal);
      }
      if (signal?.aborted) throw createAbortError();
      lastRequestAt = Date.now();
      return task();
    };

    const next = queueTail.then(run, run);
    queueTail = next.catch(() => {});
    return next;
  }

  async function requestJson(url, { signal } = {}) {
    if (signal?.aborted) {
      throw createAbortError();
    }

    if (cache.has(url)) {
      return cache.get(url);
    }

    const result = await enqueue(async () => {
      if (cache.has(url)) {
        return cache.get(url);
      }
      let res;
      try {
        res = await runFetch(url, signal);
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        throw new Error(
          'Не удалось подключиться к API музея (Failed to fetch). Проверьте интернет, отключите блокировщики/VPN или подождите минуту при общем IP.',
          { cause: err },
        );
      }
      if (res.status === 429) {
        throw new Error(RATE_LIMIT_ERROR);
      }
      if (!res.ok) {
        throw new Error(`Ошибка сервера (${res.status})`);
      }
      const json = await res.json();
      cache.set(url, json);
      return json;
    }, signal);

    return result;
  }

  async function searchArtworks(q, page = 1, { limit = 24, signal } = {}) {
    const params = new URLSearchParams({
      q: String(q ?? '').trim(),
      fields: SEARCH_FIELDS,
      limit: String(limit),
      page: String(Math.max(1, Number(page) || 1)),
    });
    const url = `${API_BASE}/artworks/search?${params.toString()}`;
    const json = await requestJson(url, { signal });
    return {
      data: Array.isArray(json.data) ? json.data : [],
      pagination: json.pagination ?? { total: 0, limit, current_page: page, total_pages: 0 },
      iiifUrl: json.config?.iiif_url ?? '',
    };
  }

  async function getArtwork(id, { signal } = {}) {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
      throw new Error('Некорректный идентификатор работы');
    }
    const url = `${API_BASE}/artworks/${numId}?fields=${ARTWORK_FIELDS}`;
    const json = await requestJson(url, { signal });
    return {
      data: json.data ?? null,
      iiifUrl: json.config?.iiif_url ?? '',
    };
  }

  async function getArtworks(ids, { signal } = {}) {
    const cleanIds = normalizeExpoIds(ids);
    if (cleanIds.length === 0) {
      return { data: [], iiifUrl: '' };
    }
    const params = new URLSearchParams({
      ids: cleanIds.join(','),
      fields: ARTWORK_FIELDS,
    });
    const url = `${API_BASE}/artworks?${params.toString()}`;
    const json = await requestJson(url, { signal });
    const byId = new Map((Array.isArray(json.data) ? json.data : []).map((item) => [item.id, item]));
    const ordered = cleanIds.map((id) => byId.get(id)).filter(Boolean);
    return {
      data: ordered,
      iiifUrl: json.config?.iiif_url ?? '',
    };
  }

  function clearCache() {
    cache.clear();
  }

  function resetQueue() {
    queueTail = Promise.resolve();
    lastRequestAt = -Infinity;
  }

  return {
    searchArtworks,
    getArtwork,
    getArtworks,
    clearCache,
    resetQueue,
  };
}

const defaultClient = createArticClient();

export const searchArtworks = defaultClient.searchArtworks;
export const getArtwork = defaultClient.getArtwork;
export const getArtworks = defaultClient.getArtworks;
export const clearApiCache = defaultClient.clearCache;
export const resetApiQueue = defaultClient.resetQueue;
