import { useEffect, useState } from 'react';
import { formatDateTime } from '../../../utils/concert.js';
export default function OrderExpiration({ order, onRefresh }) {
  const [now,setNow] = useState(Date.now);
  const pending = order.status === 'pending' && order.payment_status === 'unpaid' && order.expires_at;
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  },[pending]);
  if (order.status === 'cancelled') return <div className="feedback feedback-error"><p>{order.expired_at ? 'Đơn hàng đã hết hạn và bị hủy. Vé giữ chỗ đã được hoàn lại.' : 'Đơn hàng đã bị hủy và không còn hiệu lực.'}</p></div>;
  if (!pending) return null;
  const remaining = Math.max(0,Math.ceil((Date.parse(order.expires_at) - now) / 1000));
  return <aside className="feedback" aria-label="Thời hạn đơn hàng">
    <p>Đơn hàng sẽ hết hạn nếu chưa được xác nhận thanh toán.</p>
    <p>Hạn giữ chỗ: <time dateTime={order.expires_at}>{formatDateTime(order.expires_at)} (giờ Việt Nam)</time></p>
    {remaining > 0 ? <p role="timer" aria-live="off">Còn lại: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2,'0')}</p> : <p>Đã đến hạn giữ chỗ. Vui lòng làm mới để kiểm tra trạng thái xử lý từ hệ thống.</p>}
    <p className="text-sm">Thời gian đếm ngược chỉ để tham khảo; trạng thái trong hệ thống là thông tin chính thức.</p>
    {onRefresh && <button type="button" className="text-link mt-3" onClick={onRefresh}>Làm mới trạng thái</button>}
  </aside>;
}
