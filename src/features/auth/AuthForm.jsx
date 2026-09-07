import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function AuthShell({ title, children }) {
  return <section className="site-container section-space min-h-[55vh]"><div className="mx-auto max-w-md">
    <p className="eyebrow">The Next Live Concert / Tài khoản</p><h1 className="page-title">{title}</h1><div className="mt-8">{children}</div>
  </div></section>;
}

export function AuthField({ label, name, error, type = 'text', ...props }) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return <div>
    <label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}</label>
    <div className="relative"><input {...props} id={name} name={name} type={password && visible ? 'text' : type}
      aria-invalid={Boolean(error)} aria-describedby={error ? name + '-error' : undefined}
      className={'min-h-12 w-full rounded-md border border-black/25 bg-white px-4 py-3 text-base disabled:bg-black/5 ' + (password ? 'pr-14' : '')} />
      {password && <button type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} onClick={() => setVisible(value => !value)} className="absolute right-1 top-1 grid h-10 w-10 place-items-center">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
    </div>
    {error && <p id={name + '-error'} className="mt-2 text-sm text-[#ad1740]">{error}</p>}
  </div>;
}

export function AuthMessage({ error, success }) {
  if (error) return <p role="alert" className="my-5 text-sm leading-6 text-[#ad1740]">{error}</p>;
  if (success) return <p role="status" className="my-5 text-sm leading-6">{success}</p>;
  return null;
}
