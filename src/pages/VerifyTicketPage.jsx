import { useParams } from 'react-router-dom';
import { BadgeCheck, CircleX, RefreshCw } from 'lucide-react';
import DataState from '../components/DataState';
import { useDigitalTickets } from '../features/tickets/hooks/useDigitalTickets';
import { ticketStatusLabel, verificationMessage } from '../features/tickets/utils/digitalTickets';
import { ticketName } from '../features/tickets/utils/tickets';
import { formatConcertDate, formatConcertTime } from '../utils/concert';

export default function VerifyTicketPage({ service }) {
  const { token } = useParams();
  const { status, data: ticket, retry } = useDigitalTickets({ mode: 'verify', code: token, service });
  const valid = ticket?.is_valid === true && ticket.status === 'valid';
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">The Next Live Concert / Xác minh vé</p>
    <DataState status={status} retry={retry} />
    {status === 'success' && <>
      <div className="flex items-start gap-4">{valid ? <BadgeCheck className="mt-2 shrink-0 text-green-700" size={36} aria-hidden="true" /> : <CircleX className="mt-2 shrink-0 text-concert-pink" size={36} aria-hidden="true" />}<h1 className="page-title">{verificationMessage(ticket)}</h1></div>
      {ticket && <div className="mt-8 max-w-2xl border-t border-black/20 pt-8">
        <h2 className="break-words text-2xl font-bold">{ticket.concert_name}</h2>
        <dl className="mt-6 space-y-5">
          {[['Hạng vé', ticketName({ name: ticket.ticket_name, slug: ticket.ticket_name.toLowerCase() })], ['Mã vé', ticket.ticket_code], ['Ngày tổ chức', formatConcertDate(ticket.concert_starts_at) + ' · ' + formatConcertTime(ticket.concert_starts_at)], ['Địa điểm', ticket.venue || 'Chưa công bố'], ['Trạng thái', ticketStatusLabel(ticket.status)]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}
        </dl><p className="body-copy mt-8">Kết quả xác minh không thay thế việc check-in tại sự kiện.</p>
      </div>}
      <button className="text-link mt-8" type="button" onClick={retry}><RefreshCw size={16} aria-hidden="true" />Kiểm tra lại</button>
    </>}
  </section>;
}
