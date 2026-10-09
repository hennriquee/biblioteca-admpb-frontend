import { IconBook } from './Icons.jsx';
import { useEffect, useRef, useState } from 'react';

export default function BookCover({ src, alt, className = '' }) {
  // loading: a foto ainda esta baixando | loaded: ja apareceu | failed: nao carregou
  const [status, setStatus] = useState('loading');
  const imgRef = useRef(null);

  // Se o link falhou e a pessoa escolhe outra capa, tenta carregar de novo.
  useEffect(() => {
    setStatus('loading');
    // Imagem que ja estava no cache pode ter carregado antes do React ouvir o onLoad.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) handleLoad();
  }, [src]);

  function handleLoad() {
    // Algumas fontes (ex.: Amazon) devolvem um pixel 1x1 quando nao tem a
    // capa, em vez de dar erro. Isso conta como "sem capa".
    const img = imgRef.current;
    setStatus(img && img.naturalWidth <= 1 ? 'failed' : 'loaded');
  }

  if (!src || status === 'failed') {
    return (
      <div
        className={'cover cover--empty ' + className}
        role="img"
        aria-label={alt ? 'Sem imagem da capa de ' + alt : 'Sem imagem'}
      >
        <IconBook width={26} height={26} aria-hidden="true" />
        <span className="cover__label" aria-hidden="true">
          Sem imagem
        </span>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      className={
        'cover ' + (status === 'loading' ? 'cover--loading ' : '') + className
      }
      src={src}
      alt={alt}
      loading="lazy"
      aria-busy={status === 'loading'}
      onLoad={handleLoad}
      onError={() => setStatus('failed')}
    />
  );
}
