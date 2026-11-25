export const DEFAULT_TITLE = 'Моя выставка';
export const MAX_EXPO_ITEMS = 12;
export const MAX_SEARCH_RESULTS = 10000;
export const STORAGE_KEY = 'my-expo-state-v1';

export const VARIANT = {
  number: 17,
  query: 'gold',
  color: 'blue',
  label: 'Сортировка по году создания (Хронологически)',
};

export const COLOR_BUCKETS = [
  { id: 'all', label: 'Все цвета' },
  { id: 'red', label: 'Красный' },
  { id: 'orange', label: 'Оранжевый' },
  { id: 'yellow', label: 'Жёлтый' },
  { id: 'green', label: 'Зелёный' },
  { id: 'blue', label: 'Синий' },
  { id: 'purple', label: 'Фиолетовый' },
  { id: 'gray', label: 'Серый / ЧБ' },
];

/**
 * Extracts the artist name (first line) from AIC artist_display string.
 */
export function artistName(artistDisplay) {
  if (typeof artistDisplay !== 'string') return '';
  const firstLine = artistDisplay.split(/\r?\n/)[0].trim();
  return firstLine;
}

/**
 * Maps AIC HSL color object { h, s, l } to a discrete color bucket.
 * Boundaries are inclusive on the upper group (e.g. h=45 -> yellow).
 */
export function hueBucket(color) {
  if (!color || typeof color.h !== 'number' || Number.isNaN(color.h)) {
    return 'gray';
  }
  if (typeof color.s === 'number' && color.s < 15) {
    return 'gray';
  }

  const h = ((color.h % 360) + 360) % 360;
  if (h < 15 || h >= 345) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 260) return 'blue';
  return 'purple';
}

/**
 * Builds an IIIF image URL from the API's config.iiif_url and artwork image_id.
 */
export function iiifUrl(iiifBase, imageId, width = 843) {
  if (!iiifBase || !imageId) return null;
  const base = String(iiifBase).replace(/\/+$/, '');
  return `${base}/${imageId}/full/${width},/0/default.jpg`;
}

/**
 * Computes numeric aspect ratio (width / height) from thumbnail metadata.
 */
export function aspectRatio(thumbnail) {
  const w = thumbnail?.width;
  const h = thumbnail?.height;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    return w / h;
  }
  return 1;
}

/**
 * Returns the last reachable search page respecting AIC's 10,000 result limit.
 */
export function maxPage(total, limit) {
  if (
    typeof total !== 'number' ||
    typeof limit !== 'number' ||
    !Number.isFinite(total) ||
    !Number.isFinite(limit) ||
    total <= 0 ||
    limit <= 0
  ) {
    return 0;
  }

  const maxAllowedPages = Math.max(1, Math.floor(MAX_SEARCH_RESULTS / limit));
  if (total > MAX_SEARCH_RESULTS) {
    return Math.floor(MAX_SEARCH_RESULTS / limit);
  }
  return Math.min(Math.ceil(total / limit), maxAllowedPages);
}

/**
 * Normalizes an array of artwork IDs: positive unique integers, max 12.
 */
export function normalizeExpoIds(rawIds) {
  if (!Array.isArray(rawIds)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of rawIds) {
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (
      Number.isSafeInteger(n) &&
      n > 0 &&
      (typeof raw === 'number' || /^\d+$/.test(String(raw).trim())) &&
      !seen.has(n)
    ) {
      seen.add(n);
      result.push(n);
      if (result.length >= MAX_EXPO_ITEMS) break;
    }
  }
  return result;
}

/**
 * Encodes an exhibition { title, ids } into a URL query string (?title=...&ids=...).
 */
export function encodeExpo(expo) {
  const params = new URLSearchParams();
  const title = typeof expo?.title === 'string' ? expo.title.trim() : '';
  params.set('title', title || DEFAULT_TITLE);

  const ids = normalizeExpoIds(expo?.ids);
  if (ids.length > 0) {
    params.set('ids', ids.join(','));
  }

  return `?${params.toString()}`;
}

/**
 * Decodes a URL query string into a sanitized exhibition { title, ids }.
 */
export function decodeExpo(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  const rawTitle = params.get('title');
  const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : DEFAULT_TITLE;

  const rawIds = params.get('ids');
  const tokens = typeof rawIds === 'string' && rawIds.trim() ? rawIds.split(',') : [];
  const ids = normalizeExpoIds(tokens);

  return { title, ids };
}

/**
 * Sorts artworks chronologically by date_start (null/undefined placed at the end).
 */
export function sortChronologically(artworks) {
  if (!Array.isArray(artworks)) return [];
  return [...artworks].sort((a, b) => {
    const da = typeof a?.date_start === 'number' && Number.isFinite(a.date_start) ? a.date_start : Infinity;
    const db = typeof b?.date_start === 'number' && Number.isFinite(b.date_start) ? b.date_start : Infinity;
    if (da !== db) return da - db;
    return (a?.id ?? 0) - (b?.id ?? 0);
  });
}

export const initialExpoState = {
  title: DEFAULT_TITLE,
  ids: [],
};

/**
 * Pure reducer managing exhibition title and ordered artwork IDs (max 12).
 */
export function expoReducer(state = initialExpoState, action) {
  switch (action?.type) {
    case 'ADD': {
      const id = Number(action.id ?? action.artwork?.id);
      if (!Number.isSafeInteger(id) || id <= 0) return state;
      if (state.ids.includes(id) || state.ids.length >= MAX_EXPO_ITEMS) {
        return state;
      }
      return { ...state, ids: [...state.ids, id] };
    }
    case 'REMOVE': {
      const id = Number(action.id);
      if (!state.ids.includes(id)) return state;
      return { ...state, ids: state.ids.filter((item) => item !== id) };
    }
    case 'MOVE': {
      const { fromIndex, toIndex } = action;
      if (
        !Number.isInteger(fromIndex) ||
        !Number.isInteger(toIndex) ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.ids.length ||
        toIndex >= state.ids.length ||
        fromIndex === toIndex
      ) {
        return state;
      }
      const next = [...state.ids];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...state, ids: next };
    }
    case 'SET_TITLE': {
      const title = typeof action.title === 'string' ? action.title : '';
      return { ...state, title };
    }
    case 'SET_IDS': {
      return { ...state, ids: normalizeExpoIds(action.ids) };
    }
    case 'LOAD': {
      const nextTitle =
        typeof action.expo?.title === 'string' && action.expo.title.trim()
          ? action.expo.title
          : DEFAULT_TITLE;
      return {
        title: nextTitle,
        ids: normalizeExpoIds(action.expo?.ids),
      };
    }
    case 'CLEAR': {
      return { ...state, ids: [] };
    }
    default:
      return state;
  }
}

export function loadExpoFromStorage(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return initialExpoState;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initialExpoState;
    const parsed = JSON.parse(raw);
    const title =
      typeof parsed?.title === 'string' && parsed.title.trim() ? parsed.title : DEFAULT_TITLE;
    const ids = normalizeExpoIds(parsed?.ids);
    return { title, ids };
  } catch {
    return initialExpoState;
  }
}

export function saveExpoToStorage(
  expo,
  storage = typeof localStorage !== 'undefined' ? localStorage : null,
) {
  if (!storage) return;
  try {
    const payload = {
      title: typeof expo?.title === 'string' && expo.title.trim() ? expo.title.trim() : DEFAULT_TITLE,
      ids: normalizeExpoIds(expo?.ids),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota or private mode storage errors
  }
}
