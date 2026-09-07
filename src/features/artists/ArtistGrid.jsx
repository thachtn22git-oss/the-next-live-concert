import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import ArtistImage from '../../components/ArtistImage';
import { formatConcertTime } from '../../utils/concert';

export default function ArtistGrid({ artists }) {
  return <div className="artist-grid">{artists.map((artist, index) => <article key={artist.id} className="artist-item min-w-0">
    <ArtistImage artist={artist}><span className="artist-status">{artist.billing || 'Nghệ sĩ'}</span></ArtistImage>
    <div className="artist-caption"><span>{String(index + 1).padStart(2, '0')}</span><div className="min-w-0">
      <p className="eyebrow">{artist.billing || 'Nghệ sĩ'}</p>
      <h3 className="break-words">{artist.name}</h3>
      <p className="mt-2 text-sm text-muted">{artist.genre || 'Thể loại sẽ được cập nhật'}</p>
      {artist.performances.length > 0 && <p className="mt-2 text-sm">Biểu diễn: {artist.performances.map(slot => formatConcertTime(slot.starts_at)).join(', ')}</p>}
      <Link className="text-link mt-4" to={'/artists/' + encodeURIComponent(artist.slug)} aria-label={'Xem chi tiết nghệ sĩ ' + artist.name}>Xem chi tiết <ArrowUpRight size={18} aria-hidden="true" /></Link>
    </div></div>
  </article>)}</div>;
}
