import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';
import { formatConcertDate, formatConcertTime, formatDateTime } from '../../../utils/concert';
import { ticketName } from '../utils/tickets';
import { hasUsableQr, ticketStatusLabel } from '../utils/digitalTickets';
import TicketQrCode from './TicketQrCode';

const logo = new URL('../../../assets/the-next-live-concert-logo.png', import.meta.url).href;

export default function DigitalTicketPass({ ticket, detail = false }) {
  const usable = hasUsableQr(ticket);
  const status = !usable && ticket.status === 'valid' ? 'cancelled' : ticket.status;
  return <article className={'concert-pass min-w-0 ' + (usable ? 'bg-concert-lightBlue' : 'bg-gray-100')}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <span className="brand-logo-window"><img className="brand-logo" src={logo} alt="The Next Live Concert" width="432" height="432" /></span>
      <span className={'rounded px-3 py-2 text-xs font-bold ' + (usable ? 'bg-concert-mint' : 'bg-black text-white')}>{ticketStatusLabel(status)}</span>
    </div>
    <div className="my-6"><p className="text-xs font-bold uppercase">Hạng vé</p><h2 className="mt-2 break-words text-3xl font-bold">{ticketName({ name: ticket.ticket_name, slug: ticket.ticket_name.toLowerCase() })}</h2></div>
    <dl className="mb-6 space-y-4 text-sm">
      <div><dt className="font-semibold">Sự kiện</dt><dd className="mt-1 break-words">{ticket.concert_name}</dd></div>
      <div><dt className="font-semibold">Ngày phát hành</dt><dd>{formatDateTime(ticket.issued_at)}</dd></div>
      {ticket.used_at && <div><dt className="font-semibold">Đã sử dụng</dt><dd>{formatDateTime(ticket.used_at)}</dd></div>}
      <div><dt className="font-semibold">Mã vé</dt><dd className="mt-1 break-all font-mono">{ticket.ticket_code}</dd></div>
      <div><dt className="flex items-center gap-2 font-semibold"><CalendarDays size={16} aria-hidden="true" />Ngày tổ chức</dt><dd className="mt-1">{formatConcertDate(ticket.concert_starts_at)} · {formatConcertTime(ticket.concert_starts_at)}</dd></div>
      <div><dt className="flex items-center gap-2 font-semibold"><MapPin size={16} aria-hidden="true" />Địa điểm</dt><dd className="mt-1 break-words">{ticket.venue || 'Địa điểm sẽ được công bố'}</dd></div>
    </dl>
    <div className="flex flex-col items-center gap-4 border-t border-dashed border-black/40 pt-6">
      {usable ? <><TicketQrCode token={ticket.verification_token} />{detail && <p className="text-center text-sm leading-6">Vui lòng xuất trình mã QR này khi check-in.</p>}</> : <p className="py-6 text-center text-sm font-semibold">{status === 'used' ? 'Vé đã được sử dụng.' : 'Vé không còn hiệu lực.'} Mã QR không khả dụng.</p>}
      {!detail && <Link className="text-link mt-2" to={'/my-tickets/' + encodeURIComponent(ticket.ticket_code)}>Xem chi tiết <ArrowUpRight size={18} aria-hidden="true" /></Link>}
    </div>
  </article>;
}
