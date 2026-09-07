import DataState from '../components/DataState';
import ArtistGrid from '../features/artists/ArtistGrid';
import { useConcert } from '../hooks/useConcert';

export default function ArtistsPage() {
  const { status, artists, concert, retry } = useConcert();
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">Nghệ sĩ</p><h1 className="page-title">Dàn nghệ sĩ</h1>
    <p className="body-copy mt-6 mb-12 max-w-2xl">Những âm sắc cùng làm nên The Next Live Concert.</p>
    {concert?.is_sample && <p className="mb-8 text-sm text-muted">Chương trình mẫu với nghệ sĩ hư cấu và hình ảnh minh họa. Đây chưa phải danh sách biểu diễn chính thức.</p>}
    <DataState status={status} empty={!artists.length} retry={retry} emptyMessage="Danh sách nghệ sĩ sẽ sớm được công bố." />
    {status === 'success' && artists.length > 0 && <ArtistGrid artists={artists} />}
  </section>;
}
