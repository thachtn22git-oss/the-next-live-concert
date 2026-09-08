import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import DataState from '../components/DataState';
import DigitalTicketPass from '../features/tickets/components/DigitalTicketPass';
import { useDigitalTickets } from '../features/tickets/hooks/useDigitalTickets';
import { groupTickets } from '../features/tickets/utils/digitalTickets';

function TicketList({ userId, service }) {
  const [page, setPage] = useState(0);
  const { status, data, retry } = useDigitalTickets({ mode: 'list', userId, page, service });
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">The Next Live Concert</p>
    <div className="flex flex-wrap items-center justify-between gap-6"><h1 className="page-title">Vé của tôi</h1><button type="button" className="text-link" onClick={retry} disabled={status === 'loading'}><RefreshCw size={16} aria-hidden="true" />Làm mới</button></div>
    <p className="body-copy mt-6">Vé điện tử sẽ được phát hành sau khi đơn hàng được xác nhận thanh toán.</p>
    <DataState status={status} retry={retry} />
    {status === 'success' && <>
      {!data.tickets.length ? <div className="py-12"><p className="body-copy">{page === 0 ? 'Bạn chưa có vé nào.' : 'Không có vé ở trang này.'}</p><Link className="button button-pink mt-6" to="/tickets">Mua vé <ArrowRight size={18} aria-hidden="true" /></Link></div> : groupTickets(data.tickets).map(group => <section className="mt-12" key={group.id}>
        <h2 className="break-words text-2xl font-bold">{group.name}</h2>
        <div className="mt-6 grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">{group.tickets.map(ticket => <DigitalTicketPass key={ticket.ticket_code} ticket={ticket} />)}</div>
      </section>)}
    </>}
    {(page > 0 || data?.hasNext) && <nav className="mt-10 flex items-center justify-center gap-6" aria-label="Trang vé">
      <button className="text-link disabled:opacity-30" type="button" aria-label="Trang trước" title="Trang trước" disabled={page === 0 || status === 'loading'} onClick={() => setPage(value => value - 1)}><ArrowLeft size={20} /></button>
      <span className="text-sm">Trang {page + 1}</span>
      <button className="text-link disabled:opacity-30" type="button" aria-label="Trang sau" title="Trang sau" disabled={status !== 'success' || !data?.hasNext} onClick={() => setPage(value => value + 1)}><ArrowRight size={20} /></button>
    </nav>}
  </section>;
}

export default function MyTicketsPage({ service }) {
  const { user } = useAuth();
  return <TicketList key={user.id} userId={user.id} service={service} />;
}
