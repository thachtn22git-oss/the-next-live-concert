import { useRef, useState } from 'react';
import { adminService } from './adminService.js';
import { Feedback } from './AdminCommon.jsx';
import { adminError } from './adminModel.js';
export default function ExpireOrdersAction({ onDone }) {
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState(''); const [error,setError] = useState(false); const lock = useRef(false);
  async function expire() {
    if (lock.current || !window.confirm('Hủy tối đa 100 đơn chờ chưa thanh toán đã quá hạn và hoàn tồn kho?')) return;
    lock.current = true; setBusy(true); setMessage(''); setError(false);
    try { const count = await adminService.rpc('admin_expire_pending_orders'); setMessage(`Đã xử lý ${count} đơn hết hạn.${count === 100 ? ' Có thể còn đơn chờ; bấm xử lý tiếp.' : ''}`); onDone(); }
    catch (e) { setError(true); setMessage(adminError(e)); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="mt-6"><button type="button" disabled={busy} onClick={expire}>{busy ? 'Đang xử lý...' : 'Xử lý đơn hết hạn'}</button><Feedback message={message} error={error} /></div>;
}
