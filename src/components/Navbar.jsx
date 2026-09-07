import { useState } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { navigationItems } from '../constants/navigation';
import logo from '../assets/the-next-live-concert-logo.png';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <nav className="site-container nav-inner" aria-label="Điều hướng chính">
      <Link className="brand-logo-window" to="/" onClick={() => setOpen(false)} aria-label="The Next Live Concert - Trang chủ"><img className="brand-logo" src={logo} alt="The Next Live Concert" width="432" height="432" /></Link>
      <div className="desktop-nav">{navigationItems.map(item => <NavLink end={item.path === '/'} key={item.path} to={item.path} className="nav-link">{item.label}</NavLink>)}</div>
      <div className="nav-actions"><Link className="login-link" to="/login">Đăng nhập</Link><Link className="button button-pink" to="/tickets" onClick={() => setOpen(false)}>Mua vé <ArrowUpRight size={17} aria-hidden="true" /></Link>
        <button className="menu-toggle" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>{open ? <X /> : <Menu />}</button>
      </div>
    </nav>
    {open && <nav id="mobile-navigation" className="mobile-nav site-container" aria-label="Điều hướng di động" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>{[...navigationItems, { path: '/login', label: 'Đăng nhập' }, { path: '/my-tickets', label: 'Vé của tôi' }].map(item => <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={() => setOpen(false)}>{item.label}</NavLink>)}</nav>}
  </header>;
}
