import { useEffect, useState } from 'react';
import { useConcert } from '../../../hooks/useConcert.js';

export default function Countdown() {
  const { concert } = useConcert();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const remaining = Math.max(0, Math.floor(((Date.parse(concert?.starts_at) || now) - now) / 1000));
  const units = [[Math.floor(remaining / 86400), 'Ngày'], [Math.floor(remaining / 3600) % 24, 'Giờ'], [Math.floor(remaining / 60) % 60, 'Phút'], [remaining % 60, 'Giây']];
  if (!concert?.starts_at) return null;
  return <section className="countdown-band"><div className="site-container countdown-inner"><p className="eyebrow">{remaining ? 'Đếm ngược đến đêm nhạc' : 'Đã đến ngày hẹn'}<span className="block mt-2 font-normal normal-case">Một cuộc hẹn. Ngàn cảm xúc.</span></p><div className="countdown" role="timer" aria-label="Thời gian còn lại đến sự kiện dự kiến">{units.map(([value, label]) => <div key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}</div></div></section>;
}
