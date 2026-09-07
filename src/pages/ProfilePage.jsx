import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, UserRound, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import { useAuthForm } from '../features/auth/useAuthForm';
import { AuthMessage } from '../features/auth/AuthForm';
import DataState from '../components/DataState';

export default function ProfilePage() {
  const { user, profile, profileStatus, retryProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useAuthForm({});
  async function logout() {
    await form.run(async () => { await authService.logout(); navigate('/login', { replace: true }); });
  }
  return <section className="site-container section-space min-h-[55vh]"><div className="max-w-2xl">
    <p className="eyebrow">Tài khoản</p><h1 className="page-title">Hồ sơ của tôi</h1>
    <AuthMessage success={location.state?.passwordUpdated ? 'Mật khẩu đã được cập nhật.' : ''} />
    <div className="mt-10 flex items-center gap-5"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-concert-lightBlue" aria-label="Ảnh đại diện mặc định"><UserRound size={32} aria-hidden="true" /></div>
      <div className="min-w-0"><p className="font-semibold break-words">{profile?.full_name || 'Tài khoản của bạn'}</p><p className="mt-2 break-all text-sm text-muted">{user?.email}</p></div>
    </div>
    {profileStatus === 'ready' ? <dl className="mt-10 divide-y divide-black/15 border-y border-black/15">
      {[['Email', user.email], ['Họ và tên', profile.full_name], ['Số điện thoại', profile.phone]].map(([label, value]) => <div key={label} className="grid gap-2 py-5 sm:grid-cols-[160px_1fr]"><dt className="text-sm text-muted">{label}</dt><dd className="min-w-0 break-words">{value || 'Chưa cập nhật'}</dd></div>)}
    </dl> : <DataState status={profileStatus === 'loading' ? 'loading' : 'error'} retry={retryProfile} />}
    <div className="mt-8 flex flex-wrap gap-6"><Link to="/my-tickets" className="text-link">Vé của tôi <ArrowUpRight size={18} /></Link>
      {profile?.role === 'admin' && <Link to="/admin" className="text-link">Quản trị <ArrowUpRight size={18} /></Link>}
    </div>
    <AuthMessage error={form.error} />
    <button type="button" disabled={form.busy} onClick={logout} className="button button-pink mt-8 disabled:opacity-60"><LogOut size={18} aria-hidden="true" />{form.busy ? 'Đang đăng xuất...' : 'Đăng xuất'}</button>
  </div></section>;
}
