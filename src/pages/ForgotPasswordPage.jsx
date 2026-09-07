import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { AuthField, AuthMessage, AuthShell } from '../features/auth/AuthForm';
import { useAuthForm } from '../features/auth/useAuthForm';
import { validateEmail } from '../features/auth/validation';
import { authService } from '../services/authService';

export default function ForgotPasswordPage() {
  const form = useAuthForm({ email: '' });
  const [sent, setSent] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const email = validateEmail(form.values.email);
    form.setErrors({ email });
    if (email) return;
    await form.run(async () => {
      await authService.requestPasswordReset(form.values.email, window.location.origin + '/reset-password');
      setSent(true);
    });
  }
  return <AuthShell title="Quên mật khẩu">
    {sent ? <AuthMessage success="Nếu email này đã được đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư và thư rác." /> :
      <form onSubmit={submit} noValidate><fieldset disabled={form.busy} className="space-y-5">
        <AuthField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.values.email} onChange={form.change} error={form.errors.email} />
        <AuthMessage error={form.error} />
        <button className="button button-pink w-full disabled:opacity-60" disabled={form.busy} type="submit"><Mail size={18} aria-hidden="true" />{form.busy ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}</button>
      </fieldset></form>}
    <Link to="/login" className="text-link mt-8"><ArrowLeft size={18} aria-hidden="true" />Về trang đăng nhập</Link>
  </AuthShell>;
}
