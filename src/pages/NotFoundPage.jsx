import { Link } from 'react-router-dom';
export default function NotFoundPage() {
  return <section className="site-container section-space min-h-[60vh]">
    <p className="eyebrow">The Next Live Concert / 404</p><h1 className="page-title">Không tìm thấy trang.</h1>
    <p className="body-copy mt-6">Trang bạn đang tìm không tồn tại hoặc đã được di chuyển.</p>
    <div className="mt-8 flex flex-wrap gap-5"><Link className="button button-pink" to="/">VỀ TRANG CHỦ</Link><Link className="text-link" to="/concert">XEM SỰ KIỆN</Link></div>
  </section>;
}
