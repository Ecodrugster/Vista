import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getArtwork } from '../api/artic.js';
import { ArtworkImage } from '../components/ArtworkImage.jsx';
import { useExpo } from '../context/ExpoContext.jsx';
import { COLOR_BUCKETS, MAX_EXPO_ITEMS, artistName, hueBucket } from '../lib/art.js';

export function ArtworkPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { expo, dispatch } = useExpo();

  const [state, setState] = useState({
    loadedId: '',
    artwork: null,
    iiifUrl: '',
    error: '',
  });

  const isLoading = state.loadedId !== String(id);

  useEffect(() => {
    const controller = new AbortController();

    getArtwork(id, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setState({
          loadedId: String(id),
          artwork: res.data,
          iiifUrl: res.iiifUrl,
          error: res.data ? '' : 'Произведение не найдено',
        });
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setState({
          loadedId: String(id),
          artwork: null,
          iiifUrl: '',
          error: err?.message || 'Ошибка при загрузке работы',
        });
      });

    return () => controller.abort();
  }, [id]);

  const numericId = Number(id);
  const inExpo = expo.ids.includes(numericId);
  const isExpoFull = expo.ids.length >= MAX_EXPO_ITEMS;

  if (isLoading) {
    return (
      <section className="page">
        <div className="status-box" role="status">
          Загружаем карточку работы…
        </div>
      </section>
    );
  }

  if (state.error || !state.artwork) {
    return (
      <section className="page">
        <div className="status-box is-error" role="alert">
          <p>{state.error || 'Работа не найдена'}</p>
          <Link to="/" className="btn btn-primary">
            На главную
          </Link>
        </div>
      </section>
    );
  }

  const work = state.artwork;
  const artist = artistName(work.artist_display) || 'Автор не указан';
  const colorCode = hueBucket(work.color);
  const colorLabel = COLOR_BUCKETS.find((b) => b.id === colorCode)?.label || colorCode;

  return (
    <section className="page">
      <div className="breadcrumb">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <Link to="/" className="btn btn-outline btn-sm">
          К поиску
        </Link>
      </div>

      <div className="artwork-detail">
        <div className="artwork-detail-media">
          <ArtworkImage
            iiifBase={state.iiifUrl}
            imageId={work.image_id}
            thumbnail={work.thumbnail}
            title={work.title}
            width={843}
            loading="eager"
          />
        </div>

        <div className="artwork-detail-info">
          <h1>{work.title || 'Без названия'}</h1>

          <dl className="detail-meta">
            <dt>Автор</dt>
            <dd>
              <strong>{artist}</strong>
              {work.artist_display && work.artist_display !== artist && (
                <div className="detail-subtext">{work.artist_display}</div>
              )}
            </dd>

            <dt>Дата</dt>
            <dd>{work.date_display || 'Не указана'}</dd>

            <dt>Техника / материалы</dt>
            <dd>{work.medium_display || 'Не указана'}</dd>

            <dt>Отдел музея</dt>
            <dd>{work.department_title || 'Не указан'}</dd>

            <dt>Цветовая группа</dt>
            <dd>{colorLabel}</dd>
          </dl>

          <div className="detail-actions">
            {inExpo ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => dispatch({ type: 'REMOVE', id: work.id })}
                >
                  Убрать из выставки
                </button>
                <Link to="/expo" className="btn btn-primary">
                  Открыть выставку ({expo.ids.length}/{MAX_EXPO_ITEMS})
                </Link>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={isExpoFull}
                onClick={() => dispatch({ type: 'ADD', id: work.id })}
              >
                {isExpoFull
                  ? `Выставка заполнена (${MAX_EXPO_ITEMS}/${MAX_EXPO_ITEMS})`
                  : 'В выставку'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
