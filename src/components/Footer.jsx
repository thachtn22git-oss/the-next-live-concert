import { Link } from 'react-router-dom';
import logo from '../assets/the-next-live-concert-logo.jpg';
import { navigationItems } from '../constants/navigation';

export default function Footer() {
  return <footer className="site-footer"><div className="site-container">
    <div className="footer-main"><div className="flex items-center gap-5"><img src={logo} alt="The Next Live Concert" width="88" height="88" className="object-contain" /><div><p className="font-bold">The Next Live Concert</p><p className="mt-2 text-sm text-white/60">Đà Nẵng, Việt Nam</p></div></div>
      <nav aria-label="Điều hướng cuối trang" className="flex flex-wrap gap-x-7 gap-y-4">{navigationItems.slice(1).map(item => <Link key={item.path} to={item.path}>{item.label}</Link>)}</nav>
    </div><div className="footer-bottom"><p>© 2026 The Next Live Concert. Bảo lưu mọi quyền.</p><Link to="/my-tickets">Vé của tôi</Link><span>Kênh mạng xã hội sẽ sớm được công bố.</span></div>
  </div></footer>;
}
