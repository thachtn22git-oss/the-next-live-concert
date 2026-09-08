import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { authService } from '../../services/authService.js';

export default function AdminLayout() {
  const { user } = useAuth(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); try { await authService.logout(); } catch { setError('Chưa thể đăng xuất. Vui lòng thử lại.'); } finally { setBusy(false); } }
  return <section className="admin-shell site-container">
    <header className="admin-heading"><div><p className="eyebrow">The Next Live Concert / Quản trị</p><h1>Bảng điều khiển</h1></div><div className="admin-account"><Link to="/">Về trang chủ</Link><Link to="/profile">{user?.email}</Link><button disabled={busy} onClick={logout}>Đăng xuất</button></div></header>
    {error && <p role="alert">{error}</p>}
    <nav className="admin-nav" aria-label="Quản trị">{[['','Tổng quan'],['concert','Sự kiện'],['artists','Nghệ sĩ'],['schedule','Lịch trình'],['ticket-types','Hạng vé'],['orders','Đơn hàng'],['tickets','Tra cứu vé'],['check-in','Check-in']].map(([path,label]) => <NavLink key={path} end to={'/admin' + (path ? '/' + path : '')}>{label}</NavLink>)}</nav>
    <Outlet />
  </section>;
}
