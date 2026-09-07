import DataState from '../components/DataState';
import ScheduleList from '../features/schedule/ScheduleList';
import { useConcert } from '../hooks/useConcert';
import { formatConcertDate } from '../utils/concert';

export default function SchedulePage() {
  const { status, schedules, concert, retry } = useConcert();
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">Lịch trình</p><h1 className="page-title">Lịch trình sự kiện</h1>
    <p className="body-copy mt-6">{concert ? formatConcertDate(concert.starts_at) + ' · ' + concert.venue : 'Cùng chờ đón những khoảnh khắc trên sân khấu.'}</p>
    <p className="mt-3 text-sm text-muted">Giờ Việt Nam (UTC+7). Lịch trình có thể được điều chỉnh.</p>
    {concert?.is_sample && <p className="mt-3 text-sm text-muted">Lịch trình mẫu, chưa phải thông báo chính thức.</p>}
    <div className="mt-10 max-w-4xl">
      <DataState status={status} empty={!schedules.length} retry={retry} emptyMessage="Lịch trình sự kiện sẽ sớm được công bố." />
      {status === 'success' && schedules.length > 0 && <ScheduleList schedules={schedules} />}
    </div>
  </section>;
}
