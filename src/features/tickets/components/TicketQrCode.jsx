import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RefreshCw } from 'lucide-react';
import { verificationUrl } from '../utils/digitalTickets';

export default function TicketQrCode({ token, origin, renderQr = QRCode.toDataURL }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    Promise.resolve().then(() => renderQr(verificationUrl(token, origin), {
      width: 512, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#080808', light: '#FFFFFF' },
    })).then(src => {
      if (active) setResult({ src, token, origin });
    }).catch(() => { if (active) setResult({ error: true, token, origin }); });
    return () => { active = false; };
  }, [token, origin, renderQr, attempt]);
  const current = result?.token === token && result?.origin === origin ? result : null;
  return <div className="grid aspect-square w-64 max-w-full place-items-center self-center bg-white text-center text-black">
    {!current ? <p role="status" className="p-4 text-sm">Đang tạo mã QR...</p> : current.error ? <div role="alert" className="p-4 text-sm">
      <p>Chưa thể tạo mã QR.</p><button type="button" className="text-link mt-4" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Thử lại</button>
    </div> : <img src={current.src} width="256" height="256" className="h-auto max-w-full" alt="Mã QR xác minh vé" />}
  </div>;
}
