import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { AuthField, AuthMessage, AuthShell } from '../features/auth/AuthForm';
import { useAuthForm } from '../features/auth/useAuthForm';
import { validatePassword } from '../features/auth/validation';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import { authCallbackError } from '../lib/supabase';
import DataState from '../components/DataState';

export default function ResetPasswordPage() {
  const { status, user, retryAuth, completeRecovery } = useAuth();
  const form = useAuthForm({ password: '', confirmPassword: '' });
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    const password = validatePassword(form.values.password, form.values.confirmPassword);
    form.setErrors({ password });
    if (password) return;
    await form.run(async () => {
      await authService.updatePassword(form.values.password);
      completeRecovery();
      navigate('/profile', { replace: true, state: { passwordUpdated: true } });
    });
  }
  return <AuthShell title="Đặt lại mật khẩu">
    {status !== 'ready' ? <DataState status={status === 'loading' ? 'loading' : 'error'} retry={retryAuth} /> :
      !user || authCallbackError ? <><AuthMessage error="Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới." /><Link to="/forgot-password" className="text-link">Gửi lại liên kết</Link></> :
      <form onSubmit={submit} noValidate><fieldset disabled={form.busy} className="space-y-5">
        <AuthField label="Mật khẩu mới" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.values.password} onChange={form.change} error={form.errors.password} />
        <p className="text-sm text-muted">Ít nhất 8 ký tự, bao gồm chữ và số.</p>
        <AuthField label="Xác nhận mật khẩu mới" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={128} value={form.values.confirmPassword} onChange={form.change} />
        <AuthMessage error={form.error} />
        <button className="button button-pink w-full disabled:opacity-60" disabled={form.busy} type="submit"><KeyRound size={18} aria-hidden="true" />{form.busy ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}</button>
      </fieldset></form>}
  </AuthShell>;
}
