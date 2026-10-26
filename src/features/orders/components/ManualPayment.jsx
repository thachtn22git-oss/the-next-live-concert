import { useEffect, useState } from 'react';
import { manualPaymentDetails, paymentAccount } from '../utils/manualPayment.js';
import { formatVnd } from '../../tickets/utils/tickets.js';

export default function ManualPayment({ order, onRefresh }) {
  const [now, setNow] = useState(Date.now);
  const [failedImage, setFailedImage] = useState(null);
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.clearInterval(timer);
  }, []);
  const payment = manualPaymentDetails(order, now);
  if (!payment) return null;
  return <section className="mt-10 border border-black/15 p-6 sm:p-8" aria-labelledby="manual-payment-heading">
    <h2 id="manual-payment-heading">Thanh toán chuyển khoản</h2>
    <p className="body-copy mt-4">Quét QR bằng ứng dụng ngân hàng. Kiểm tra đúng người nhận, số tiền và giữ nguyên nội dung chuyển khoản.</p>
    <div className="mt-8 grid items-start gap-8 md:grid-cols-[300px_1fr]">
      <div className="max-w-[300px] bg-white">
        {failedImage === payment.qrUrl ? <p role="alert" className="p-4">Chưa tải được QR. Bạn có thể chuyển khoản bằng thông tin bên cạnh.<button type="button" className="text-link mt-4" onClick={() => setFailedImage(null)}>Tải lại QR</button></p>
          : <img key={payment.qrUrl} src={payment.qrUrl} width="300" className="h-auto w-full" alt="QR chuyển khoản Vietcombank cho đơn đặt vé" referrerPolicy="no-referrer" onError={() => setFailedImage(payment.qrUrl)} />}
      </div>
      <div className="min-w-0">
        <dl className="space-y-4">
          {[['Ngân hàng', paymentAccount.bank], ['Số tài khoản', paymentAccount.number], ['Chủ tài khoản', paymentAccount.holder], ['Số tiền', formatVnd(payment.amount)], ['Nội dung chuyển khoản', payment.reference]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 select-all break-all font-semibold">{value}</dd></div>)}
        </dl>
        <p className="body-copy mt-6">Sau khi chuyển khoản, vui lòng chờ ban tổ chức kiểm tra và xác nhận. Vé sẽ xuất hiện trong “Vé của tôi” sau khi được duyệt.</p>
        <button type="button" className="button button-pink mt-6" onClick={onRefresh}>Kiểm tra trạng thái thanh toán</button>
        <p className="mt-3 text-sm text-muted">Nút này chỉ làm mới trạng thái đơn hàng.</p>
      </div>
    </div>
  </section>;
}
