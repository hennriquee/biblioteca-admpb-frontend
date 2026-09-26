import { IconBook } from './Icons.jsx';
import { useState } from 'react';

export default function BookCover({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={'cover cover--empty ' + className} aria-hidden="true">
        <IconBook width={26} height={26} />
      </div>
    );
  }

  return (
    <img
      className={'cover ' + className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
