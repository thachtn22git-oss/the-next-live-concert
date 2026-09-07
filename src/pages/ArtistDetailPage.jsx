import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import DataState from '../components/DataState';
import ArtistImage from '../components/ArtistImage';
import ScheduleList from '../features/schedule/ScheduleList';
import { useConcert } from '../hooks/useConcert';
import { safePublicUrl } from '../utils/concert';

const socialLabels = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', spotify: 'Spotify', website: 'Trang web' };

export default function ArtistDetailPage() {
  const { slug } = useParams();
  const { status, artists, schedules, concert, retry } = useConcert();
  const artist = artists.find(item => item.slug === slug);
  const links = Object.entries(artist?.social_links ?? {})
    .filter(([platform, url]) => socialLabels[platform] && safePublicUrl(url));
  const performances = artist ? schedules.filter(slot => slot.artist_id === artist.id) : [];
  return <section className="site-container section-space min-h-[55vh]">
    <Link to="/artists" className="text-link mb-10"><ArrowLeft size={18} aria-hidden="true" />Tất cả nghệ sĩ</Link>
    <DataState status={status} empty={!artist} retry={retry} emptyMessage="Không tìm thấy nghệ sĩ trong chương trình hiện tại." />
    {status === 'success' && artist && <>
      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        <ArtistImage artist={artist} />
        <div className="min-w-0"><p className="eyebrow">{artist.billing || 'Nghệ sĩ'}</p><h1 className="page-title">{artist.name}</h1>
          <p className="mt-4 font-semibold">{artist.genre || 'Thể loại sẽ được cập nhật'}</p>
          <p className="body-copy mt-6 whitespace-pre-line break-words">{artist.biography || 'Tiểu sử nghệ sĩ sẽ sớm được cập nhật.'}</p>
          {concert?.is_sample && <p className="mt-6 text-sm text-muted">Nghệ sĩ hư cấu trong chương trình mẫu. Hình ảnh minh họa.</p>}
          <nav aria-label="Liên kết của nghệ sĩ" className="mt-8 flex flex-wrap gap-5">
            {links.map(([platform, url]) => <a key={platform} href={safePublicUrl(url)} target="_blank" rel="noopener noreferrer" className="text-link">{socialLabels[platform]}<ArrowUpRight size={16} aria-hidden="true" /></a>)}
            {!links.length && <p className="text-sm text-muted">Liên kết chính thức sẽ được cập nhật.</p>}
          </nav>
        </div>
      </div>
      <div className="mt-16 grid gap-8 md:grid-cols-[1fr_1.5fr]"><div><p className="eyebrow">Lịch biểu diễn</p><h2 className="mt-6">Hẹn bạn tại sân khấu.</h2><p className="body-copy mt-4">Giờ Việt Nam (UTC+7).</p></div><div>
        {performances.length ? <ScheduleList schedules={performances} /> : <p className="body-copy py-8">Lịch biểu diễn của nghệ sĩ sẽ sớm được công bố.</p>}
      </div></div>
    </>}
  </section>;
}
