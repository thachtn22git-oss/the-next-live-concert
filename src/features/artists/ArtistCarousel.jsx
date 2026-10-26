import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import ArtistImage from '../../components/ArtistImage.jsx';

export default function ArtistCarousel({ artists }) {
  const [selectedId, setSelectedId] = useState(null);
  if (!artists.length) return null;
  const index = Math.max(0, artists.findIndex(artist => artist.id === selectedId));
  const current = artists[index];
  function move(step) {
    setSelectedId(artists[(index + step + artists.length) % artists.length].id);
  }
  return <div className="artist-carousel" role="region" aria-roledescription="trình chiếu" aria-label="Dàn nghệ sĩ">
    <div className="artist-carousel-stage">
      {artists.map((artist, i) => {
        const forward = (i - index + artists.length) % artists.length;
        const offset = forward > artists.length / 2 ? forward - artists.length : forward;
        const position = Math.abs(offset) <= 2 ? String(offset) : 'hidden';
        return <div key={artist.id} className={'artist-carousel-slide artist-carousel-slide--' + position} aria-hidden={offset !== 0}>
          <ArtistImage artist={artist} />
        </div>;
      })}
      <button className="artist-carousel-arrow artist-carousel-arrow--previous" type="button" onClick={() => move(-1)} disabled={artists.length < 2} aria-label="Nghệ sĩ trước"><ArrowLeft size={24} aria-hidden="true" /></button>
      <button className="artist-carousel-arrow artist-carousel-arrow--next" type="button" onClick={() => move(1)} disabled={artists.length < 2} aria-label="Nghệ sĩ tiếp theo"><ArrowRight size={24} aria-hidden="true" /></button>
    </div>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{current.name} · {index + 1} / {artists.length}</p>
  </div>;
}
