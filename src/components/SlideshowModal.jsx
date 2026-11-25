import { useCallback, useEffect, useState } from 'react';
import { artistName, iiifUrl } from '../lib/art.js';
import { ArtworkImage } from './ArtworkImage.jsx';

export function SlideshowModal({ items, iiifBase, initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex);

  const total = items.length;
  const safeIndex = total > 0 ? ((index % total) + total) % total : 0;
  const current = items[safeIndex];

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setIndex((prev) => (prev + 1) % total);
  }, [total]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onClose]);

  // Preload next slide image for smooth transitions
  useEffect(() => {
    if (total <= 1 || !iiifBase) return;
    const nextItem = items[(safeIndex + 1) % total];
    const nextUrl = iiifUrl(iiifBase, nextItem?.image_id, 843);
    if (nextUrl) {
      const img = new Image();
      img.src = nextUrl;
    }
  }, [iiifBase, items, safeIndex, total]);

  if (!current) return null;

  const artist = artistName(current.artist_display) || 'Автор не указан';

  return (
    <div
      className="slideshow-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Слайд-шоу выставки"
      onClick={onClose}
    >
      <div className="slideshow-content" onClick={(e) => e.stopPropagation()}>
        <div className="slideshow-topbar">
          <span className="slideshow-counter">
            {safeIndex + 1} / {total}
          </span>
          <span className="slideshow-hint">← → для переключения · Esc для выхода</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Закрыть (Esc)
          </button>
        </div>

        <div className="slideshow-stage">
          <button
            type="button"
            className="slideshow-nav"
            onClick={goPrev}
            disabled={total <= 1}
            aria-label="Предыдущий слайд"
          >
            ←
          </button>

          <div className="slideshow-image-wrap">
            <ArtworkImage
              iiifBase={iiifBase}
              imageId={current.image_id}
              thumbnail={current.thumbnail}
              title={current.title}
              width={843}
              loading="eager"
              className="slideshow-frame"
            />
          </div>

          <button
            type="button"
            className="slideshow-nav"
            onClick={goNext}
            disabled={total <= 1}
            aria-label="Следующий слайд"
          >
            →
          </button>
        </div>

        <div className="slideshow-caption">
          <h2>{current.title || 'Без названия'}</h2>
          <p>
            {artist}
            {current.date_display ? ` · ${current.date_display}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
