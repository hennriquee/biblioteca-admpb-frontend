import { IconBook } from './Icons.jsx';
import { useEffect, useRef, useState } from 'react';
import ImageLightbox from './ImageLightbox.jsx';

/**
 * Props:
 *  - zoomable: clicar na capa abre ela maior (ImageLightbox), sem opcao de
 *    baixar - so nas telas de DETALHE (cover--lg), onde o clique na capa nao
 *    ja faz outra coisa. Nas listas e nos combos o clique escolhe o livro;
 *    ali a capa continua sem zoomable, para o clique fazer so aquilo.
 */
export default function BookCover({ src, alt, className = '', zoomable = false }) {
  // loading: a foto ainda esta baixando | loaded: ja apareceu | failed: nao carregou
  const [status, setStatus] = useState('loading');
  const [open, setOpen] = useState(false);
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

  const img = (
    <img
      ref={imgRef}
      className={
        'cover ' + (status === 'loading' ? 'cover--loading ' : '') + className
      }
      src={src}
      alt={zoomable ? '' : alt}
      loading="lazy"
      aria-busy={status === 'loading'}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onLoad={handleLoad}
      onError={() => setStatus('failed')}
    />
  );

  if (!zoomable) return img;

  return (
    <>
      <button
        type="button"
        className="imagebtn"
        onClick={() => setOpen(true)}
        aria-label={(alt || 'Capa do livro') + ' — ver maior'}
      >
        {img}
      </button>
      <ImageLightbox open={open} onClose={() => setOpen(false)} src={src} alt={alt} />
    </>
  );
}
