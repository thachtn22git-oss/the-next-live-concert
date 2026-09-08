import { useRef, useState } from 'react';
import { adminService } from './adminService.js';
import { adminError, date, ticketReference } from './adminModel.js';
export default function AdminCheckIn({ service = adminService }) {
  const [input,setInput] = useState(''); const [ticket,setTicket] = useState(null); const [reference,setReference] = useState(''); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false); const lock = useRef(false);
  async function lookup(e) {
    e.preventDefault(); if (lock.current) return; setTicket(null); setMessage('');
    const value = ticketReference(input); if (!value) { setMessage('KHÔNG TÌM THẤY VÉ — Nhập mã vé, token hoặc đường dẫn xác minh hợp lệ.'); return; }
    lock.current = true; setBusy(true);
    try { const data = await service.rpc('admin_lookup_ticket',{ p_reference:value }); setReference(value); setTicket(data); if (!data) setMessage('KHÔNG TÌM THẤY VÉ'); } catch (error) { setMessage(adminError(error)); } finally { lock.current = false; setBusy(false); }
  }
  async function checkIn() {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage('');
    try { setTicket(await service.rpc('check_in_ticket',{ p_reference:reference })); setMessage('CHECK-IN THÀNH CÔNG'); }
    catch (error) { setMessage(adminError(error)); setTicket(null); } finally { lock.current = false; setBusy(false); }
  }
  return <><h2>Check-in tại sự kiện</h2><p>Tra cứu vé trước, sau đó xác nhận cho khách vào cửa. Đường dẫn xác minh công khai chỉ đọc thông tin.</p><form className="admin-filters" onSubmit={lookup}><label htmlFor="ticket-reference">Mã vé, token hoặc đường dẫn xác minh</label><input id="ticket-reference" value={input} disabled={busy} onChange={e => { setInput(e.target.value); setTicket(null); setMessage(''); }} autoComplete="off" /><button disabled={busy}>Kiểm tra vé</button></form>{busy && <p role="status">Đang xử lý...</p>}{message && <p className="admin-result" role="status">{message}</p>}{ticket && <article className={'admin-card admin-ticket-' + ticket.status}><h3>{ticket.status === 'valid' ? 'VÉ HỢP LỆ' : ticket.status === 'used' ? 'VÉ ĐÃ ĐƯỢC SỬ DỤNG' : 'VÉ ĐÃ BỊ HỦY'}</h3><p>{ticket.ticket_code}</p><p>{ticket.ticket_name} · {ticket.concert_name}</p><p>{date(ticket.concert_starts_at)} · {ticket.venue}</p>{ticket.used_at && <p>Đã sử dụng: {date(ticket.used_at)}</p>}{ticket.status === 'valid' && <button className="button button-pink" disabled={busy} onClick={checkIn}>Xác nhận check-in</button>}</article>}</>;
}
