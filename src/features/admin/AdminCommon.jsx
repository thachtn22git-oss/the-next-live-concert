import { useEffect, useState } from 'react';
import { adminService, PAGE_SIZE } from './adminService.js';
import { adminError, fields, formValues, validateAdmin } from './adminModel.js';

export function LoadState({ state, retry }) {
  if (state.loading) return <p role="status">Đang tải dữ liệu...</p>;
  if (state.error) return <div role="alert"><p>{adminError(state.error)}</p><button onClick={retry}>Thử lại</button></div>;
  return null;
}
export function Pagination({ page, count, onChange }) {
  return <div className="admin-pagination"><button type="button" disabled={!page} onClick={() => onChange(page - 1)}>Trang trước</button><span>Trang {page + 1} / {Math.max(1, Math.ceil(count / PAGE_SIZE))} · {count} bản ghi</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => onChange(page + 1)}>Trang sau</button></div>;
}
export function ArtistPicker({ value, onChange, concertId, disabled }) {
  const [search,setSearch] = useState(''); const [page,setPage] = useState(0); const [result,setResult] = useState({ rows: [], count: 0 }); const [error,setError] = useState(false);
  useEffect(() => { let active = true; setError(false); adminService.list(concertId ? 'concert_artists' : 'artists', { concertId, search, page }).then(data => { if (active) setResult(data); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; },[concertId,search,page]);
  return <div className="admin-picker">{!concertId && <input aria-label="Tìm nghệ sĩ" placeholder="Tìm nghệ sĩ" value={search} disabled={disabled} onChange={e => { setSearch(e.target.value); setPage(0); }} />}<select aria-label="Nghệ sĩ" value={value || ''} disabled={disabled} onChange={e => onChange(e.target.value)}><option value="">Không chọn nghệ sĩ</option>{value && !result.rows.some(r => (r.artist_id || r.id) === value) && <option value={value}>Nghệ sĩ đang chọn ({value})</option>}{result.rows.map(r => <option key={r.artist_id || r.id} value={r.artist_id || r.id}>{r.artist?.name || r.name || r.artist_id}</option>)}</select>{error ? <p role="alert">Chưa thể tải nghệ sĩ.</p> : <Pagination page={page} count={result.count} onChange={setPage} />}</div>;
}
export function AdminForm({ table, row, concertId, onSaved, onCancel }) {
  const [values,setValues] = useState(() => formValues(table,row || {})); const [errors,setErrors] = useState({}); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); if (busy) return;
    const result = validateAdmin(table,values,row); setErrors(result.errors); setMessage(''); if (Object.keys(result.errors).length) return;
    setBusy(true);
    try { const data = { ...result.data }; if (!row && concertId) data.concert_id = concertId; await adminService.save(table,data,row); onSaved(); }
    catch (error) { setMessage(adminError(error)); } finally { setBusy(false); }
  }
  return <form noValidate className="admin-form" onSubmit={submit}>
    <p>Thời gian theo múi giờ Việt Nam (UTC+7).</p>
    {table === 'ticket_types' && <p>Đã bán/giữ chỗ: {row.sold_quantity} · Còn lại: {row.total_quantity - row.sold_quantity}</p>}
    <fieldset disabled={busy}><div className="admin-fields">{fields[table].map(([key,label,type = 'text']) => <div key={key} className={type === 'textarea' ? 'admin-wide' : ''}><label htmlFor={'admin-' + key}>{label}</label>{type === 'select' ? <ArtistPicker value={values[key]} concertId={table === 'schedules' ? concertId : undefined} disabled={Boolean(row && table === 'concert_artists')} onChange={value => setValues(v => ({ ...v,[key]:value }))} /> : type === 'textarea' ? <textarea id={'admin-' + key} value={values[key]} onChange={e => setValues(v => ({ ...v,[key]:e.target.value }))} /> : <input id={'admin-' + key} type={type} checked={type === 'checkbox' ? values[key] : undefined} value={type === 'checkbox' ? undefined : values[key]} onChange={e => setValues(v => ({ ...v,[key]:type === 'checkbox' ? e.target.checked : e.target.value }))} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? 'error-' + key : undefined} />}{errors[key] && <p id={'error-' + key} role="alert">{errors[key]}</p>}</div>)}</div></fieldset>
    {message && <p role="alert">{message}</p>}<div className="admin-actions"><button className="button button-pink" disabled={busy}>{busy ? 'Đang xử lý...' : 'Lưu thay đổi'}</button>{onCancel && <button type="button" disabled={busy} onClick={onCancel}>Đóng biểu mẫu</button>}</div>
  </form>;
}
