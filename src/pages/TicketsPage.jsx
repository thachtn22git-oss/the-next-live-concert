import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTicketSelection } from '../features/tickets/hooks/useTicketSelection';
import TicketDataState from '../features/tickets/components/TicketDataState';
import TicketPass from '../features/tickets/components/TicketPass';
import TicketSelectionSummary from '../features/tickets/components/TicketSelectionSummary';
import { reconcileSelection, sameSelection, selectionSummary } from '../features/tickets/utils/tickets';
import { formatConcertDate } from '../utils/concert';

export default function TicketsPage() {
  const { status, concert, ticketTypes, quantities, summary, notice, now, setQuantity, refresh } = useTicketSelection();
  const { user, status: authStatus } = useAuth();
  const [continuing, setContinuing] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const navigate = useNavigate();
  async function continueSelection() {
    if (pending.current || !summary.totalQuantity || status !== 'success' || authStatus === 'loading') return;
    pending.current = true;
    setContinuing(true);
    setMessage('');
    try {
      const latest = await refresh();
      if (!latest) return;
      const selection = reconcileSelection(quantities, latest.ticketTypes, Date.now());
      const updated = selectionSummary(selection, latest.ticketTypes, Date.now());
      if (!sameSelection(quantities, selection) || updated.totalAmount !== summary.totalAmount) {
        setMessage('Thông tin vé vừa thay đổi. Vui lòng kiểm tra lại lựa chọn và tổng tiền trước khi tiếp tục.');
        return;
      }
      if (updated.totalQuantity) navigate(user ? '/checkout' : '/login', user ? undefined : { state: { from: '/checkout' } });
    } finally { pending.current = false; setContinuing(false); }
  }
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">The Next Live Concert / Vé</p><h1 className="page-title">Chọn vé</h1>
    {concert && <div className="mt-6"><p className="text-lg font-semibold">{concert.name}</p><p className="body-copy mt-2">{formatConcertDate(concert.starts_at)} · {concert.venue || 'Địa điểm sẽ được công bố'}</p>
      {concert.is_sample && <p className="mt-3 text-sm text-muted">Hạng vé mẫu, chưa phải thông tin mở bán chính thức.</p>}
    </div>}
    <div className="mt-10">
      <TicketDataState status={status} empty={!ticketTypes.length} retry={refresh} />
      {status === 'success' && ticketTypes.length > 0 && <div className="grid items-start gap-12 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-2">
          {ticketTypes.map((ticket, index) => <TicketPass key={ticket.id} ticket={ticket} concert={concert} index={index} quantity={quantities[ticket.id] || 0} onQuantityChange={setQuantity} now={now} />)}
        </div>
        <div className="min-w-0 xl:sticky xl:top-32"><TicketSelectionSummary summary={summary}>
          {(notice || message) && <p role="status" className="mt-5 text-sm leading-6">{message || notice}</p>}
          <p className="mt-5 text-sm leading-6 text-muted">Lựa chọn chưa giữ chỗ. Chưa có vé hoặc đơn hàng được tạo.</p>
          <button type="button" onClick={continueSelection} disabled={!summary.totalQuantity || continuing || authStatus === 'loading'} className="button button-pink mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50">
            {continuing ? 'Đang kiểm tra...' : 'Tiếp tục thanh toán'}<ArrowRight size={18} className="shrink-0" aria-hidden="true" />
          </button>
          <button type="button" className="text-link mt-5" onClick={refresh}><RefreshCw size={16} aria-hidden="true" />Cập nhật thông tin vé</button>
        </TicketSelectionSummary></div>
      </div>}
    </div>
  </section>;
}
