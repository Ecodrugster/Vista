import { useState } from 'react';
import { aspectRatio, iiifUrl } from '../lib/art.js';

export function ArtworkImage({
  iiifBase,
  imageId,
  thumbnail,
  title,
  width = 843,
  className = '',
  loading = 'lazy',
}) {
  const src = iiifUrl(iiifBase, imageId, width);
  const ratio = aspectRatio(thumbnail);
  const lqip = thumbnail?.lqip;
  const alt = thumbnail?.alt_text || title || 'Произведение искусства';

  const [loadedSrc, setLoadedSrc] = useState(null);
  const [failedSrc, setFailedSrc] = useState(null);

  const isLoaded = Boolean(src && loadedSrc === src);
  const isImageMissing = !src;
  const isLoadError = Boolean(src && failedSrc === src);

  return (
    <div
      className={`artwork-frame ${className}`.trim()}
      style={{ aspectRatio: String(ratio) }}
    >
      {!isImageMissing && lqip && !isLoaded && (
        <img
          src={lqip}
          alt={isLoadError ? alt : ''}
          aria-hidden={isLoadError ? undefined : true}
          className="artwork-lqip"
        />
      )}

      {isImageMissing || (isLoadError && !lqip) ? (
        <div className="artwork-placeholder" role="img" aria-label={alt}>
          <span>Нет изображения</span>
        </div>
      ) : !isLoadError ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          referrerPolicy="no-referrer"
          className={`artwork-img ${isLoaded ? 'is-loaded' : ''}`}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
    </div>
  );
}
