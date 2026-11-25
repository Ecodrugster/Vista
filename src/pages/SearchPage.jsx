import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { searchArtworks } from '../api/artic.js';
import { ArtworkImage } from '../components/ArtworkImage.jsx';
import { useExpo } from '../context/ExpoContext.jsx';
import {
  COLOR_BUCKETS,
  MAX_EXPO_ITEMS,
  VARIANT,
  artistName,
  hueBucket,
  maxPage,
} from '../lib/art.js';

const PAGE_LIMIT = 24;

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { expo, dispatch } = useExpo();

  const urlQuery = searchParams.get('q') ?? VARIANT.query;
  const urlPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const urlColor = searchParams.get('color') ?? VARIANT.color;

  const [inputQuery, setInputQuery] = useState(urlQuery);
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState({
    key: '',
    items: [],
    total: 0,
    iiifUrl: '',
    error: '',
  });

  const activeKey = `${urlQuery}::${urlPage}::${retryCount}`;
  const isLoading = state.key !== activeKey;

  useEffect(() => {
    const controller = new AbortController();

    searchArtworks(urlQuery, urlPage, { limit: PAGE_LIMIT, signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setState({
          key: activeKey,
          items: res.data,
          total: res.pagination?.total ?? 0,
          iiifUrl: res.iiifUrl,
          error: '',
        });
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setState({
          key: activeKey,
          items: [],
          total: 0,
          iiifUrl: '',
          error: err?.message || 'Не удалось загрузить результаты',
        });
      });

    return () => controller.abort();
  }, [activeKey, urlPage, urlQuery]);

  const totalPages = maxPage(state.total, PAGE_LIMIT);
  const filteredItems =
    urlColor === 'all'
      ? state.items
      : state.items.filter((item) => hueBucket(item.color) === urlColor);

  const isExpoFull = expo.ids.length >= MAX_EXPO_ITEMS;

  function updateSearch(nextQuery, nextPage = 1, nextColor = urlColor) {
    const params = new URLSearchParams();
    params.set('q', nextQuery);
    params.set('page', String(nextPage));
    params.set('color', nextColor);
    setSearchParams(params);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const cleaned = inputQuery.trim() || VARIANT.query;
    setInputQuery(cleaned);
    updateSearch(cleaned, 1, urlColor);
  }

  function handleColorChange(nextColor) {
    updateSearch(urlQuery, urlPage, nextColor);
  }

  function handlePageChange(nextPage) {
    if (nextPage < 1 || (totalPages > 0 && nextPage > totalPages)) return;
    updateSearch(urlQuery, nextPage, urlColor);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Поиск произведений искусства</h1>
          <p className="subtitle">
            Вариант {VARIANT.number}: тема «{VARIANT.query}», цвет по умолчанию — {VARIANT.color}
          </p>
        </div>
      </div>

      <form className="search-bar" onSubmit={handleSubmit}>
        <input
          type="search"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Например: gold, portrait, monet..."
          aria-label="Поисковый запрос"
        />
        <button type="submit" className="btn btn-primary">
          Найти
        </button>
      </form>

      <div className="color-filters" role="group" aria-label="Фильтр по цвету">
        {COLOR_BUCKETS.map((bucket) => (
          <button
            key={bucket.id}
            type="button"
            className={`chip ${urlColor === bucket.id ? 'is-active' : ''}`}
            onClick={() => handleColorChange(bucket.id)}
          >
            {bucket.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="status-box" role="status">
          Загружаем работы из коллекции музея…
        </div>
      )}

      {!isLoading && state.error && (
        <div className="status-box is-error" role="alert">
          <p>{state.error}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRetryCount((c) => c + 1)}
          >
            Повторить
          </button>
        </div>
      )}

      {!isLoading && !state.error && state.items.length === 0 && (
        <div className="status-box">
          <p>Ничего не найдено по запросу «{urlQuery}».</p>
        </div>
      )}

      {!isLoading && !state.error && state.items.length > 0 && (
        <>
          <div className="results-meta">
            <span>
              Найдено всего: {state.total.toLocaleString('ru-RU')} (доступно страниц: {totalPages})
            </span>
            {urlColor !== 'all' && (
              <span>
                Показано на странице по цвету: {filteredItems.length} из {state.items.length}
              </span>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="status-box">
              <p>
                На странице {urlPage} нет работ с выбранным цветом. Попробуйте другую страницу или
                сбросьте фильтр цвета.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleColorChange('all')}
              >
                Показать все цвета
              </button>
            </div>
          ) : (
            <div className="art-grid">
              {filteredItems.map((item) => {
                const inExpo = expo.ids.includes(item.id);
                const artist = artistName(item.artist_display) || 'Автор не указан';

                return (
                  <article key={item.id} className="art-card">
                    <Link to={`/artwork/${item.id}`} className="art-card-media">
                      <ArtworkImage
                        iiifBase={state.iiifUrl}
                        imageId={item.image_id}
                        thumbnail={item.thumbnail}
                        title={item.title}
                        width={400}
                      />
                      {inExpo && (
                        <span className="badge-in-expo">Уже в выставке</span>
                      )}
                    </Link>

                    <div className="art-card-body">
                      <h2 className="art-card-title">
                        <Link to={`/artwork/${item.id}`}>{item.title || 'Без названия'}</Link>
                      </h2>
                      <p className="art-card-artist">{artist}</p>
                      {item.date_display && (
                        <p className="art-card-date">{item.date_display}</p>
                      )}
                    </div>

                    <div className="art-card-actions">
                      <Link to={`/artwork/${item.id}`} className="btn btn-secondary btn-sm">
                        Подробнее
                      </Link>
                      {inExpo ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => dispatch({ type: 'REMOVE', id: item.id })}
                        >
                          Убрать
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={isExpoFull}
                          onClick={() => dispatch({ type: 'ADD', id: item.id })}
                        >
                          {isExpoFull ? 'Лимит 12' : 'В выставку'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="pagination" aria-label="Навигация по страницам">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={urlPage <= 1}
                onClick={() => handlePageChange(urlPage - 1)}
              >
                ← Предыдущая
              </button>
              <span className="pagination-info">
                Страница {urlPage} из {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={urlPage >= totalPages}
                onClick={() => handlePageChange(urlPage + 1)}
              >
                Следующая →
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
