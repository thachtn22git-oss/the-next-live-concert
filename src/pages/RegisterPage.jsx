import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { AuthField, AuthMessage, AuthShell } from '../features/auth/AuthForm';
import { useAuthForm } from '../features/auth/useAuthForm';
import { validateRegistration } from '../features/auth/validation';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';

export default function RegisterPage() {
  const { user, status, recoveryRequired } = useAuth();
  const [registered, setRegistered] = useState(false);
  const form = useAuthForm({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  if (status === 'ready' && user) return <Navigate replace to={recoveryRequired ? '/reset-password' : '/profile'} />;
  async function submit(event) {
    event.preventDefault();
    const errors = validateRegistration(form.values);
    form.setErrors(errors);
    if (Object.keys(errors).length) return;
    await form.run(async () => {
      await authService.register(form.values, window.location.origin + '/login');
      setRegistered(true);
    });
  }
  return <AuthShell title="Đăng ký">
    {registered ? <AuthMessage success="Yêu cầu đăng ký đã được tiếp nhận. Nếu cần xác nhận email, vui lòng kiểm tra hộp thư và thư rác trước khi đăng nhập." /> :
      <form onSubmit={submit} noValidate><fieldset disabled={form.busy} className="space-y-5">
        <AuthField label="Họ và tên" name="fullName" autoComplete="name" required maxLength={120} value={form.values.fullName} onChange={form.change} error={form.errors.fullName} />
        <AuthField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.values.email} onChange={form.change} error={form.errors.email} />
        <AuthField label="Số điện thoại" name="phone" type="tel" autoComplete="tel" required maxLength={32} value={form.values.phone} onChange={form.change} error={form.errors.phone} />
        <AuthField label="Mật khẩu" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.values.password} onChange={form.change} error={form.errors.password} />
        <p className="text-sm text-muted">Ít nhất 8 ký tự, bao gồm chữ và số.</p>
        <AuthField label="Xác nhận mật khẩu" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={128} value={form.values.confirmPassword} onChange={form.change} error={form.errors.confirmPassword} />
        <AuthMessage error={form.error} />
        <button className="button button-pink w-full disabled:opacity-60" type="submit" disabled={form.busy}><UserPlus size={18} aria-hidden="true" />{form.busy ? 'Đang đăng ký...' : 'Đăng ký'}</button>
      </fieldset></form>}
    <p className="mt-7 text-sm">Đã có tài khoản? <Link to="/login" className="text-link ml-2">Đăng nhập</Link></p>
  </AuthShell>;
}
