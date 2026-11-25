import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getArtworks } from '../api/artic.js';
import { ArtworkImage } from '../components/ArtworkImage.jsx';
import { SlideshowModal } from '../components/SlideshowModal.jsx';
import { useExpo } from '../context/ExpoContext.jsx';
import {
  DEFAULT_TITLE,
  MAX_EXPO_ITEMS,
  artistName,
  encodeExpo,
  sortChronologically,
} from '../lib/art.js';

export function ExpoPage() {
  const { expo, dispatch } = useExpo();

  const [worksById, setWorksById] = useState({});
  const [iiifUrl, setIiifUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [slideshowIndex, setSlideshowIndex] = useState(null);

  const missingIds = useMemo(
    () => expo.ids.filter((id) => !worksById[id]),
    [expo.ids, worksById],
  );

  const isLoading = missingIds.length > 0 && !error;

  useEffect(() => {
    if (missingIds.length === 0) return;
    const controller = new AbortController();

    getArtworks(missingIds, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setWorksById((prev) => {
          const next = { ...prev };
          for (const item of res.data) {
            next[item.id] = item;
          }
          return next;
        });
        if (res.iiifUrl) {
          setIiifUrl(res.iiifUrl);
        }
        setError('');
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setError(err?.message || 'Не удалось загрузить работы выставки');
      });

    return () => controller.abort();
  }, [missingIds]);

  const orderedWorks = useMemo(
    () => expo.ids.map((id) => worksById[id]).filter(Boolean),
    [expo.ids, worksById],
  );

  const shareQuery = encodeExpo({
    title: expo.title.trim() || DEFAULT_TITLE,
    ids: expo.ids,
  });
  const sharePath = `/expo/view${shareQuery}`;

  async function handleCopyLink() {
    const fullUrl = `${window.location.origin}${sharePath}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Скопируйте ссылку на выставку:', fullUrl);
    }
  }

  function handleSortChronologically() {
    const sorted = sortChronologically(orderedWorks);
    dispatch({ type: 'SET_IDS', ids: sorted.map((w) => w.id) });
  }

  function handleDrop(targetIndex) {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      dispatch({ type: 'MOVE', fromIndex: dragIndex, toIndex: targetIndex });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Моя выставка</h1>
          <p className="subtitle">
            Собрано работ: {expo.ids.length} из {MAX_EXPO_ITEMS}. Меняйте порядок кнопками или
            перетаскиванием мышью.
          </p>
        </div>
      </div>

      <div className="expo-controls">
        <label className="expo-title-field">
          <span>Название выставки</span>
          <input
            type="text"
            value={expo.title}
            placeholder={DEFAULT_TITLE}
            onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          />
        </label>

        <div className="expo-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={orderedWorks.length === 0}
            onClick={() => setSlideshowIndex(0)}
          >
            Слайд-шоу
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={orderedWorks.length < 2}
            onClick={handleSortChronologically}
            title="Сортировать работы по году создания (date_start)"
          >
            Хронологически
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={expo.ids.length === 0}
            onClick={handleCopyLink}
          >
            {copied ? 'Ссылка скопирована!' : 'Скопировать ссылку'}
          </button>

          {expo.ids.length > 0 && (
            <Link to={sharePath} className="btn btn-outline">
              Открыть как гость
            </Link>
          )}

          {expo.ids.length > 0 && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => dispatch({ type: 'CLEAR' })}
            >
              Очистить
            </button>
          )}
        </div>
      </div>

      {expo.ids.length === 0 ? (
        <div className="status-box">
          <p>В выставке пока нет работ. Выберите произведения в поиске и добавьте их сюда.</p>
          <Link to="/" className="btn btn-primary">
            Перейти к поиску
          </Link>
        </div>
      ) : error ? (
        <div className="status-box is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : isLoading && orderedWorks.length === 0 ? (
        <div className="status-box" role="status">
          Загружаем работы выставки…
        </div>
      ) : (
        <ol className="expo-list">
          {orderedWorks.map((work, index) => {
            const artist = artistName(work.artist_display) || 'Автор не указан';
            const isDragging = dragIndex === index;
            const isOver = dragOverIndex === index && dragIndex !== index;

            return (
              <li
                key={work.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === index) setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={`expo-item ${isDragging ? 'is-dragging' : ''} ${
                  isOver ? 'is-drag-over' : ''
                }`}
              >
                <div className="expo-order">#{index + 1}</div>

                <Link to={`/artwork/${work.id}`} className="expo-thumb">
                  <ArtworkImage
                    iiifBase={iiifUrl}
                    imageId={work.image_id}
                    thumbnail={work.thumbnail}
                    title={work.title}
                    width={200}
                  />
                </Link>

                <div className="expo-item-info">
                  <h2>
                    <Link to={`/artwork/${work.id}`}>{work.title || 'Без названия'}</Link>
                  </h2>
                  <p>
                    {artist}
                    {work.date_display ? ` · ${work.date_display}` : ''}
                    {typeof work.date_start === 'number' ? ` (год: ${work.date_start})` : ''}
                  </p>
                </div>

                <div className="expo-item-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={index === 0}
                    aria-label="Переместить вверх"
                    onClick={() =>
                      dispatch({ type: 'MOVE', fromIndex: index, toIndex: index - 1 })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={index === orderedWorks.length - 1}
                    aria-label="Переместить вниз"
                    onClick={() =>
                      dispatch({ type: 'MOVE', fromIndex: index, toIndex: index + 1 })
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setSlideshowIndex(index)}
                  >
                    Слайд
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => dispatch({ type: 'REMOVE', id: work.id })}
                  >
                    Убрать
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {slideshowIndex !== null && orderedWorks.length > 0 && (
        <SlideshowModal
          items={orderedWorks}
          iiifBase={iiifUrl}
          initialIndex={slideshowIndex}
          onClose={() => setSlideshowIndex(null)}
        />
      )}
    </section>
  );
}
