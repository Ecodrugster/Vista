import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getArtworks } from '../api/artic.js';
import { ArtworkImage } from '../components/ArtworkImage.jsx';
import { SlideshowModal } from '../components/SlideshowModal.jsx';
import { useExpo } from '../context/ExpoContext.jsx';
import { artistName, decodeExpo } from '../lib/art.js';

export function ExpoViewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { dispatch } = useExpo();

  const decoded = decodeExpo(location.search);
  const idsKey = decoded.ids.join(',');

  const [state, setState] = useState({
    key: '',
    items: [],
    iiifUrl: '',
    error: '',
  });
  const [slideshowIndex, setSlideshowIndex] = useState(null);

  const isLoading = decoded.ids.length > 0 && state.key !== idsKey;

  useEffect(() => {
    if (decoded.ids.length === 0) return;
    const controller = new AbortController();

    getArtworks(decoded.ids, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setState({
          key: idsKey,
          items: res.data,
          iiifUrl: res.iiifUrl,
          error: '',
        });
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setState({
          key: idsKey,
          items: [],
          iiifUrl: '',
          error: err?.message || 'Не удалось загрузить выставку',
        });
      });

    return () => controller.abort();
  }, [decoded.ids, idsKey]);

  function handleSaveToMine() {
    dispatch({ type: 'LOAD', expo: decoded });
    navigate('/expo');
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <span className="view-badge">Просмотр выставки по ссылке</span>
          <h1>{decoded.title}</h1>
          <p className="subtitle">Работ в подборке: {decoded.ids.length}</p>
        </div>

        <div className="expo-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={state.items.length === 0}
            onClick={() => setSlideshowIndex(0)}
          >
            Слайд-шоу
          </button>
          {decoded.ids.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveToMine}
            >
              Скопировать к себе
            </button>
          )}
          <Link to="/" className="btn btn-outline">
            К поиску
          </Link>
        </div>
      </div>

      {decoded.ids.length === 0 ? (
        <div className="status-box">
          <p>В ссылке не указаны корректные работы выставки.</p>
          <Link to="/" className="btn btn-primary">
            На главную
          </Link>
        </div>
      ) : isLoading ? (
        <div className="status-box" role="status">
          Загружаем работы выставки одним пакетным запросом…
        </div>
      ) : state.error ? (
        <div className="status-box is-error" role="alert">
          <p>{state.error}</p>
        </div>
      ) : state.items.length === 0 ? (
        <div className="status-box">
          <p>Работы по указанным идентификаторам не найдены.</p>
        </div>
      ) : (
        <div className="art-grid">
          {state.items.map((work, index) => (
            <article key={work.id} className="art-card">
              <Link to={`/artwork/${work.id}`} className="art-card-media">
                <ArtworkImage
                  iiifBase={state.iiifUrl}
                  imageId={work.image_id}
                  thumbnail={work.thumbnail}
                  title={work.title}
                  width={400}
                />
                <span className="badge-order">#{index + 1}</span>
              </Link>
              <div className="art-card-body">
                <h2 className="art-card-title">
                  <Link to={`/artwork/${work.id}`}>{work.title || 'Без названия'}</Link>
                </h2>
                <p className="art-card-artist">
                  {artistName(work.artist_display) || 'Автор не указан'}
                </p>
                {work.date_display && <p className="art-card-date">{work.date_display}</p>}
              </div>
              <div className="art-card-actions">
                <Link to={`/artwork/${work.id}`} className="btn btn-secondary btn-sm">
                  Карточка
                </Link>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setSlideshowIndex(index)}
                >
                  Слайд
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {slideshowIndex !== null && state.items.length > 0 && (
        <SlideshowModal
          items={state.items}
          iiifBase={state.iiifUrl}
          initialIndex={slideshowIndex}
          onClose={() => setSlideshowIndex(null)}
        />
      )}
    </section>
  );
}
