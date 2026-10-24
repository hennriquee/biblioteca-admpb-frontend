import { IconBook } from './Icons.jsx';
import { useEffect, useRef, useState } from 'react';
import {
  coverDisplayUrl,
  isCoverBlank,
  isCoverReady,
  thumbnailRefused,
} from '../utils/coverPreload.js';

// Situacao inicial da capa: se ela ja foi baixada em segundo plano (ver
// utils/coverPreload.js), aparece direto, sem o brilho de "carregando".
function initialStatus(url) {
  if (isCoverReady(url)) return 'loaded';
  if (isCoverBlank(url)) return 'failed';
  return 'loading';
}

// title: quando a capa nao existe (ou nao carregou), mostra o nome do livro no
// lugar do "Sem imagem" - para capas grandes, onde so um icone ficaria vazio.
export default function BookCover({ src, alt, className = '', title = '' }) {
  // Copia reduzida da capa (as do Cloudinary); se ela falhar, o original.
  const reduced = coverDisplayUrl(src);
  const [useOriginal, setUseOriginal] = useState(false);
  const shown = useOriginal ? src : reduced;
  // loading: a foto ainda esta baixando | loaded: ja apareceu | failed: nao carregou
  const [status, setStatus] = useState(() => initialStatus(reduced));
  const imgRef = useRef(null);

  // Se o link falhou e a pessoa escolhe outra capa, tenta carregar de novo.
  useEffect(() => {
    setUseOriginal(false);
    setStatus(initialStatus(coverDisplayUrl(src)));
    // Imagem que ja estava no cache pode ter carregado antes do React ouvir o onLoad.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) handleLoad();
  }, [src]);

  function handleLoad() {
    // Algumas fontes (ex.: Amazon) devolvem um pixel 1x1 quando nao tem a
    // capa, em vez de dar erro. Isso conta como "sem capa".
    const img = imgRef.current;
    const blank = img && img.naturalWidth <= 1;
    // A reduzida falhou e o original abriu: as proximas vao direto ao original.
    if (!blank && useOriginal && reduced !== src) thumbnailRefused();
    setStatus(blank ? 'failed' : 'loaded');
  }

  function handleError() {
    if (!useOriginal && reduced !== src) {
      setUseOriginal(true);
      setStatus('loading');
      return;
    }
    setStatus('failed');
  }

  if (!src || status === 'failed') {
    return (
      <div
        className={'cover cover--empty ' + className}
        role="img"
        aria-label={alt ? 'Sem imagem da capa de ' + alt : 'Sem imagem'}
      >
        <IconBook width={26} height={26} aria-hidden="true" />
        {title ? (
          <span className="cover__title" aria-hidden="true">
            {title}
          </span>
        ) : (
          <span className="cover__label" aria-hidden="true">
            Sem imagem
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      className={
        'cover ' + (status === 'loading' ? 'cover--loading ' : '') + className
      }
      src={shown}
      alt={alt}
      // Ja baixada: entra na hora. As outras esperam chegar perto da tela.
      loading={status === 'loaded' ? 'eager' : 'lazy'}
      aria-busy={status === 'loading'}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
