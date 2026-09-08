import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function CheckoutPage() {
  return <section className="site-container section-space min-h-[55vh]">
    <p className="eyebrow">Thanh toán</p><h1 className="page-title">Thanh toán</h1>
    <p className="body-copy mt-6 max-w-2xl">Thanh toán sẽ sớm được mở. Lựa chọn vé của bạn vẫn được giữ trong phiên duyệt này. Chưa có đơn hàng được tạo hoặc khoản tiền nào được thu.</p>
    <Link to="/tickets" className="text-link mt-10"><ArrowLeft size={18} aria-hidden="true" />Quay lại chọn vé</Link>
  </section>;
}
