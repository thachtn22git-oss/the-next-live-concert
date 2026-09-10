import { useConcert } from '../hooks/useConcert.js';
import { formatDateTime } from '../utils/concert.js';
import DataState from '../components/DataState.jsx';
export default function ConcertPage() {
  const { concert,status,retry } = useConcert();
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">Sự kiện</p><h1 className="page-title">{concert?.name || 'The Next Live Concert'}</h1>
    <DataState status={status} empty={!concert} retry={retry} emptyMessage="Thông tin sự kiện sẽ sớm được công bố." />
    {concert && <><p className="body-copy mt-6 whitespace-pre-line">{concert.description}</p><p className="body-copy mt-6">{formatDateTime(concert.starts_at)} · {concert.venue || 'Địa điểm sẽ được công bố'}</p>{concert.is_sample && <p className="body-copy mt-4">Thông tin mẫu, chưa phải công bố chính thức.</p>}</>}
  </section>;
}
