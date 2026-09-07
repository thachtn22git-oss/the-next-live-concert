import { Link, Navigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { AuthField, AuthMessage, AuthShell } from '../features/auth/AuthForm';
import { useAuthForm } from '../features/auth/useAuthForm';
import { safeReturnPath, validateEmail } from '../features/auth/validation';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import { authCallbackError } from '../lib/supabase';

export default function LoginPage() {
  const { user, status, recoveryRequired } = useAuth();
  const location = useLocation();
  const form = useAuthForm({ email: '', password: '' });
  if (status === 'ready' && user) return <Navigate replace to={recoveryRequired ? '/reset-password' : safeReturnPath(location.state?.from)} />;
  async function submit(event) {
    event.preventDefault();
    const errors = { email: validateEmail(form.values.email), password: form.values.password ? '' : 'Vui lòng nhập mật khẩu.' };
    form.setErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    await form.run(() => authService.login(form.values));
  }
  return <AuthShell title="Đăng nhập">
    {authCallbackError && <AuthMessage error="Liên kết xác nhận đã hết hạn hoặc không hợp lệ. Bạn có thể thử đăng nhập hoặc yêu cầu đặt lại mật khẩu." />}
    <form onSubmit={submit} noValidate><fieldset disabled={form.busy} className="space-y-5">
      <AuthField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.values.email} onChange={form.change} error={form.errors.email} />
      <AuthField label="Mật khẩu" name="password" type="password" autoComplete="current-password" required value={form.values.password} onChange={form.change} error={form.errors.password} />
      <div className="text-right"><Link className="text-link" to="/forgot-password">Quên mật khẩu?</Link></div>
      <AuthMessage error={form.error} />
      <button className="button button-pink w-full disabled:opacity-60" type="submit" disabled={form.busy}><LogIn size={18} aria-hidden="true" />{form.busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
    </fieldset></form>
    <p className="mt-7 text-sm">Chưa có tài khoản? <Link to="/register" className="text-link ml-2">Đăng ký</Link></p>
  </AuthShell>;
}
