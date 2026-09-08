import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthField, AuthMessage } from '../features/auth/AuthForm';
import { useTicketSelection } from '../features/tickets/hooks/useTicketSelection';
import TicketDataState from '../features/tickets/components/TicketDataState';
import TicketSelectionSummary from '../features/tickets/components/TicketSelectionSummary';
import { reconcileSelection, sameSelection } from '../features/tickets/utils/tickets';
import { validateCustomer } from '../features/orders/utils/orders';
import { useOrderCreation } from '../features/orders/hooks/useOrderCreation';
import { orderService } from '../features/orders/services/orderService';

function CheckoutContent({ user, profile, service }) {
  const { concert, status, ticketTypes, quantities, summary, refresh, clearSelection } = useTicketSelection();
  const [values, setValues] = useState({ fullName: profile?.full_name || '', email: user.email || '', phone: profile?.phone || '' });
  const [errors, setErrors] = useState({});
  const [selectionError, setSelectionError] = useState('');
  const touched = useRef({});
  const navigate = useNavigate();
  const onSuccess = useCallback(order => {
    clearSelection();
    navigate('/order-success/' + encodeURIComponent(order.order_code), { replace: true });
  }, [clearSelection, navigate]);
  const creation = useOrderCreation({ userId: user.id, onSuccess, service });
  useEffect(() => {
    setValues(previous => ({
      fullName: touched.current.fullName ? previous.fullName : profile?.full_name || previous.fullName,
      phone: touched.current.phone ? previous.phone : profile?.phone || previous.phone,
      email: touched.current.email ? previous.email : user.email || previous.email,
    }));
  }, [profile, user.email]);

  function change(event) {
    const { name, value } = event.target;
    touched.current[name] = true;
    setValues(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: '' }));
  }
  async function submit(event) {
    event.preventDefault();
    if (creation.busy || creation.recovering) return;
    const invalid = validateCustomer(values);
    setErrors(invalid);
    setSelectionError('');
    if (Object.keys(invalid).length) return;
    const valid = reconcileSelection(quantities, ticketTypes, Date.now());
    if (status !== 'success' || !concert || !Object.keys(valid).length || !sameSelection(valid, quantities)) {
      setSelectionError('Lựa chọn vé không hợp lệ. Vui lòng kiểm tra lại số lượng và thời gian mở bán.');
      return;
    }
    await creation.submit({
      concertId: concert.id, customer: values,
      items: Object.entries(valid).map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity })),
    });
  }
  const ready = status === 'success' && summary.totalQuantity > 0;
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">The Next Live Concert / Đơn đặt vé</p><h1 className="page-title">Thanh toán</h1>
    <AuthMessage error={creation.error || selectionError} />
    {creation.recovering && <p role="status" className="body-copy mt-6">Đang kiểm tra đơn đặt vé...</p>}
    {creation.hasPendingRequest && !creation.busy && !creation.recovering && <button type="button" className="text-link mt-4" onClick={creation.recover}>Kiểm tra đơn vừa gửi</button>}
    <div className="mt-10"><TicketDataState status={status} empty={false} retry={refresh} />
      {status === 'success' && !ready && !creation.recovering && <p className="body-copy">Bạn chưa có lựa chọn vé hợp lệ. Vui lòng quay lại chọn vé.</p>}
      {ready && <form onSubmit={submit} noValidate className="grid items-start gap-12 lg:grid-cols-2">
        <fieldset disabled={creation.busy || creation.recovering} className="min-w-0 space-y-5">
          <legend className="mb-6 text-2xl font-bold">Thông tin người đặt vé</legend>
          <AuthField name="fullName" label="Họ và tên" autoComplete="name" required maxLength={120} value={values.fullName} onChange={change} error={errors.fullName} />
          <AuthField name="email" label="Email" type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={change} error={errors.email} />
          <AuthField name="phone" label="Số điện thoại" type="tel" autoComplete="tel" required maxLength={32} value={values.phone} onChange={change} error={errors.phone} />
        </fieldset>
        <div className="min-w-0"><TicketSelectionSummary summary={summary}>
          <p className="mt-6 text-sm leading-6 text-muted">Đơn đặt vé sẽ ở trạng thái chờ xác nhận và chưa thanh toán. Chưa có khoản tiền nào được thu.</p>
          <p className="mt-3 text-sm leading-6 text-muted">Giá và số lượng vé được kiểm tra lại khi xác nhận đơn.</p>
          {creation.busy && <p role="status" className="mt-5 text-sm">Đang xử lý đơn đặt vé...</p>}
          <button className="button button-pink mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={creation.busy || creation.recovering}><Check size={18} aria-hidden="true" />Xác nhận đặt vé</button>
        </TicketSelectionSummary></div>
      </form>}
    </div>
    {!creation.busy && <Link to="/tickets" className="text-link mt-10"><ArrowLeft size={18} aria-hidden="true" />Quay lại chọn vé</Link>}
  </section>;
}

export default function CheckoutPage({ service = orderService }) {
  const { user, profile } = useAuth();
  return <CheckoutContent key={user.id} user={user} profile={profile} service={service} />;
}
