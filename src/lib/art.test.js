import { describe, expect, it } from 'vitest';
import fixture from './fixtures/sample.json';
import {
  DEFAULT_TITLE,
  MAX_EXPO_ITEMS,
  VARIANT,
  artistName,
  aspectRatio,
  decodeExpo,
  encodeExpo,
  expoReducer,
  hueBucket,
  iiifUrl,
  initialExpoState,
  loadExpoFromStorage,
  maxPage,
  sortChronologically,
} from './art.js';

describe('Variant 17 configuration', () => {
  it('uses gold topic and blue default color', () => {
    expect(VARIANT.number).toBe(17);
    expect(VARIANT.query).toBe('gold');
    expect(VARIANT.color).toBe('blue');
  });
});

describe('artistName', () => {
  it('extracts the first line from artist_display', () => {
    expect(artistName('Claude Monet\nFrench, 1840–1926')).toBe('Claude Monet');
  });

  it('parses real fixture artist_display with multiple lines', () => {
    const snuffBox = fixture.data.find((item) => item.id === 2283);
    expect(artistName(snuffBox.artist_display)).toBe('Jacob Frisard');

    const screenprint = fixture.data.find((item) => item.id === 48662);
    expect(artistName(screenprint.artist_display)).toBe('Lawry Gold');
  });

  it('handles single-line, empty, and null values safely', () => {
    expect(artistName('Egyptian')).toBe('Egyptian');
    expect(artistName('')).toBe('');
    expect(artistName(null)).toBe('');
    expect(artistName(undefined)).toBe('');
  });
});

describe('hueBucket', () => {
  it('maps boundary hue values inclusively into the upper bucket', () => {
    expect(hueBucket({ h: 0, s: 50, l: 50 })).toBe('red');
    expect(hueBucket({ h: 14, s: 50, l: 50 })).toBe('red');
    expect(hueBucket({ h: 15, s: 50, l: 50 })).toBe('orange');
    expect(hueBucket({ h: 44, s: 50, l: 50 })).toBe('orange');
    expect(hueBucket({ h: 45, s: 50, l: 50 })).toBe('yellow');
    expect(hueBucket({ h: 69, s: 50, l: 50 })).toBe('yellow');
    expect(hueBucket({ h: 70, s: 50, l: 50 })).toBe('green');
    expect(hueBucket({ h: 169, s: 50, l: 50 })).toBe('green');
    expect(hueBucket({ h: 170, s: 50, l: 50 })).toBe('blue');
    expect(hueBucket({ h: 259, s: 50, l: 50 })).toBe('blue');
    expect(hueBucket({ h: 260, s: 50, l: 50 })).toBe('purple');
    expect(hueBucket({ h: 344, s: 50, l: 50 })).toBe('purple');
    expect(hueBucket({ h: 345, s: 50, l: 50 })).toBe('red');
    expect(hueBucket({ h: 359, s: 50, l: 50 })).toBe('red');
  });

  it('returns gray for low saturation or missing color', () => {
    expect(hueBucket({ h: 200, s: 14, l: 50 })).toBe('gray');
    expect(hueBucket(null)).toBe('gray');
    expect(hueBucket(undefined)).toBe('gray');
  });

  it('classifies real fixtures accurately including s=0 black-and-white photo', () => {
    const ring = fixture.data.find((item) => item.id === 594);
    const snuffBox = fixture.data.find((item) => item.id === 2283);
    const waterBalance = fixture.data.find((item) => item.id === 147192);
    const print = fixture.data.find((item) => item.id === 48662);

    expect(hueBucket(ring.color)).toBe('orange');
    expect(hueBucket(snuffBox.color)).toBe('blue');
    expect(hueBucket(waterBalance.color)).toBe('gray');
    expect(hueBucket(print.color)).toBe('yellow');
  });
});

describe('iiifUrl & aspectRatio', () => {
  it('builds valid IIIF URLs from config.iiif_url and image_id', () => {
    const ring = fixture.data[0];
    expect(iiifUrl(fixture.config.iiif_url, ring.image_id)).toBe(
      'https://www.artic.edu/iiif/2/d9067d6e-e133-705c-cf53-528c035a5201/full/843,/0/default.jpg',
    );
    expect(iiifUrl(`${fixture.config.iiif_url}/`, ring.image_id, 400)).toBe(
      'https://www.artic.edu/iiif/2/d9067d6e-e133-705c-cf53-528c035a5201/full/400,/0/default.jpg',
    );
    expect(iiifUrl(fixture.config.iiif_url, null)).toBeNull();
  });

  it('calculates aspectRatio from thumbnail dimensions with safe fallback', () => {
    const ring = fixture.data[0];
    expect(aspectRatio(ring.thumbnail)).toBeCloseTo(2195 / 1756);
    expect(aspectRatio(null)).toBe(1);
    expect(aspectRatio({ width: 0, height: 100 })).toBe(1);
  });
});

describe('maxPage', () => {
  it('caps results at 10,000 and handles zero/negative counts', () => {
    expect(maxPage(45, 20)).toBe(3);
    expect(maxPage(25000, 24)).toBe(416);
    expect(maxPage(fixture.pagination.total, 24)).toBe(416);
    expect(maxPage(10000, 20)).toBe(500);
    expect(maxPage(0, 24)).toBe(0);
    expect(maxPage(-5, 24)).toBe(0);
    expect(maxPage(100, 0)).toBe(0);
  });
});

describe('encodeExpo & decodeExpo', () => {
  it('decodes query params filtering invalid, duplicate, non-positive ids and capping at 12', () => {
    expect(decodeExpo('?ids=5,abc,5,-3,7')).toEqual({
      title: DEFAULT_TITLE,
      ids: [5, 7],
    });

    const tooMany = Array.from({ length: 15 }, (_, i) => i + 1).join(',');
    expect(decodeExpo(`?title=%20%20&ids=${tooMany},0,12.5,9abc`)).toEqual({
      title: DEFAULT_TITLE,
      ids: Array.from({ length: MAX_EXPO_ITEMS }, (_, i) => i + 1),
    });
  });

  it('roundtrips title and ids through encodeExpo and decodeExpo', () => {
    const expo = { title: 'Золотая коллекция', ids: [594, 2283, 147192] };
    const encoded = encodeExpo(expo);
    expect(decodeExpo(encoded)).toEqual(expo);
  });
});

describe('sortChronologically (variant 17)', () => {
  it('orders artworks by date_start ascending including BCE negative dates and missing dates last', () => {
    const withMissing = [
      ...fixture.data,
      { id: 999999, title: 'Undated', date_start: null },
    ];
    const sorted = sortChronologically(withMissing);
    expect(sorted.map((w) => w.id)).toEqual([594, 2283, 48662, 147192, 999999]);
  });
});

describe('expoReducer & storage', () => {
  it('adds, reorders, removes, and respects 12-item cap', () => {
    let state = initialExpoState;
    for (let i = 1; i <= 13; i += 1) {
      state = expoReducer(state, { type: 'ADD', id: i });
    }
    expect(state.ids).toHaveLength(12);
    expect(state.ids).not.toContain(13);

    state = expoReducer(state, { type: 'MOVE', fromIndex: 0, toIndex: 2 });
    expect(state.ids.slice(0, 3)).toEqual([2, 3, 1]);

    state = expoReducer(state, { type: 'REMOVE', id: 3 });
    expect(state.ids).not.toContain(3);
  });

  it('recovers safely from corrupted JSON in localStorage', () => {
    const brokenStorage = {
      getItem: () => '{not-valid-json',
    };
    expect(loadExpoFromStorage(brokenStorage)).toEqual(initialExpoState);
  });
});
