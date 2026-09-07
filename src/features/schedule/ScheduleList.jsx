import { Link } from 'react-router-dom';
import { formatConcertDate, formatConcertTime } from '../../utils/concert';

export default function ScheduleList({ schedules, compact = false }) {
  return <ol className="schedule-list min-w-0">{schedules.map(slot => <li key={slot.id} className="!items-start">
    <div className="shrink-0">
      <time dateTime={slot.starts_at}>{formatConcertTime(slot.starts_at)}</time>
      {!compact && <><span className="block text-xs text-muted">đến {formatConcertTime(slot.ends_at)}</span><span className="mt-1 block text-xs text-muted">{formatConcertDate(slot.starts_at)}</span>
        {formatConcertDate(slot.ends_at) !== formatConcertDate(slot.starts_at) && <span className="block text-xs text-muted">đến {formatConcertDate(slot.ends_at)}</span>}</>}
    </div>
    <div className="min-w-0">
      <h3 className="break-words">{slot.title}</h3>
      {!compact && <><p>{slot.artist ? <Link className="underline underline-offset-4" to={'/artists/' + encodeURIComponent(slot.artist.slug)}>{slot.artist.name}</Link> : 'Hoạt động chung'}</p><p>{slot.stage || 'Sân khấu sẽ được công bố'}</p></>}
      <p className="break-words">{slot.description || 'Thông tin sẽ được cập nhật.'}</p>
    </div><span className="schedule-dot mt-2" aria-hidden="true" />
  </li>)}</ol>;
}
