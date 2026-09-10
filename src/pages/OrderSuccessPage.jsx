import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Home } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useOrder } from '../features/orders/hooks/useOrder';
import { orderStatuses, paymentStatuses, orderSummary } from '../features/orders/utils/orders';
import TicketSelectionSummary from '../features/tickets/components/TicketSelectionSummary';
import OrderExpiration from '../features/orders/components/OrderExpiration.jsx';
import { formatDateTime } from '../utils/concert.js';
import DataState from '../components/DataState';

export default function OrderSuccessPage({ service }) {
  const { orderCode } = useParams();
  const { user } = useAuth();
  const { status, order, retry } = useOrder(orderCode, user.id, service);
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">The Next Live Concert / Đơn đặt vé</p>
    {status !== 'success' ? <DataState status={status} retry={retry} /> : !order ? <>
      <h1 className="page-title">Không tìm thấy đơn đặt vé</h1>
      <p className="body-copy mt-6">Mã đơn không tồn tại hoặc không thuộc tài khoản của bạn.</p>
      <Link className="text-link mt-8" to="/">Về trang chủ</Link>
    </> : <>
      <h1 className="page-title">{order.status === 'cancelled' ? 'Thông tin đơn đặt vé' : 'Đơn hàng đã được tạo'}</h1>
      <p className="body-copy mt-6">Đơn đặt vé đã được ghi nhận. {order.payment_status === 'unpaid' && 'Đơn hàng chưa được thanh toán.'}</p>
      {(order.status !== 'confirmed' || order.payment_status !== 'paid') && <p className="body-copy mt-4">{order.status === 'cancelled' || order.payment_status === 'refunded' ? 'Đơn hàng không còn đủ điều kiện phát hành vé.' : 'Vé điện tử sẽ được phát hành sau khi đơn hàng được xác nhận thanh toán.'}</p>}
      <OrderExpiration order={order} onRefresh={retry} />
      <p className="body-copy mt-4">Ngày tạo: {formatDateTime(order.created_at)}</p>
      <div className="mt-10 grid items-start gap-12 lg:grid-cols-2">
        <dl className="divide-y divide-black/15">
          {[['Mã đơn hàng', order.order_code], ['Người đặt vé', order.customer_name], ['Email', order.customer_email], ['Số điện thoại', order.customer_phone], ['Trạng thái đơn', orderStatuses[order.status] || 'Đang cập nhật'], ['Thanh toán', paymentStatuses[order.payment_status] || 'Đang cập nhật']].map(([label, value]) =>
            <div key={label} className="py-4"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 break-words font-semibold">{value}</dd></div>)}
        </dl><TicketSelectionSummary summary={orderSummary(order)} />
      </div>
      <div className="mt-10 flex flex-wrap gap-6"><Link to="/my-tickets" className="button button-pink">Xem vé của tôi <ArrowRight size={18} /></Link><Link to="/" className="text-link"><Home size={18} />Về trang chủ</Link></div>
    </>}
  </section>;
}
