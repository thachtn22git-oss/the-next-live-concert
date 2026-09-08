import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import DataState from '../components/DataState';
import DigitalTicketPass from '../features/tickets/components/DigitalTicketPass';
import { useDigitalTickets } from '../features/tickets/hooks/useDigitalTickets';

export default function MyTicketDetailPage({ service }) {
  const { ticketCode } = useParams();
  const { user } = useAuth();
  const { status, data: ticket, retry } = useDigitalTickets({ mode: 'detail', code: ticketCode, userId: user.id, service });
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">The Next Live Concert / Vé của tôi</p><h1 className="page-title">{ticket?.concert_name || 'Chi tiết vé'}</h1>
    <DataState status={status} retry={retry} />
    {status === 'success' && (ticket ? <div className="mx-auto mt-10 max-w-lg"><DigitalTicketPass ticket={ticket} detail /></div> : <p className="body-copy mt-8">Không tìm thấy vé. Vé không tồn tại hoặc không thuộc tài khoản của bạn.</p>)}
    <div className="mt-10 flex flex-wrap justify-between gap-6"><Link className="text-link" to="/my-tickets"><ArrowLeft size={18} aria-hidden="true" />Vé của tôi</Link><button className="text-link" type="button" onClick={retry} disabled={status === 'loading'}><RefreshCw size={16} aria-hidden="true" />Làm mới</button></div>
  </section>;
}
