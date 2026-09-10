import { useState } from 'react';
import { safePublicUrl } from '../utils/concert';

export default function ArtistImage({ artist, children, className = '' }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = safePublicUrl(artist.image_url);
  return <div className={'artist-image-wrap' + (className ? ' ' + className : '')}>
    {source && failedSource !== source
      ? <img src={source} alt={artist.image_alt || artist.name} loading="lazy" onError={() => setFailedSource(source)} />
      : <div className="artist-image-fallback flex items-center justify-center p-6 text-sm text-concert-black" role="img" aria-label={'Chưa có ảnh của ' + artist.name}>Hình ảnh sẽ được cập nhật</div>}
    {children}
  </div>;
}
