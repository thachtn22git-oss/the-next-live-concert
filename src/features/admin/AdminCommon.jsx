import { useEffect, useRef, useState } from 'react';
import { adminService, PAGE_SIZE } from './adminService.js';
import { adminError, fields, formValues, validateAdmin } from './adminModel.js';
import ArtistImageUpload from './ArtistImageUpload.jsx';

export function LoadState({ state, retry }) {
  if (state.loading) return <p role="status">Đang tải dữ liệu...</p>;
  if (state.error) return <div role="alert"><p>{adminError(state.error)}</p><button type="button" onClick={retry}>Thử lại</button></div>;
  return null;
}
export function Feedback({ message, error = false }) {
  return message ? <p className={'feedback ' + (error ? 'feedback-error' : 'feedback-success')} role={error ? 'alert' : 'status'}>{message}</p> : null;
}
export function Pagination({ page, count, onChange }) {
  return <div className="admin-pagination"><button type="button" disabled={!page} onClick={() => onChange(page - 1)}>Trang trước</button><span>Trang {page + 1} / {Math.max(1, Math.ceil(count / PAGE_SIZE))} · {count} bản ghi</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => onChange(page + 1)}>Trang sau</button></div>;
}
export function ArtistPicker({ value, onChange, concertId, disabled, errorId }) {
  const [search,setSearch] = useState(''); const [page,setPage] = useState(0);
  const [result,setResult] = useState({ rows: [], count: 0 }); const [error,setError] = useState(false);
  const [loading,setLoading] = useState(true); const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setError(false); setLoading(true);
    adminService.list(concertId ? 'concert_artists' : 'artists', { concertId, search, page })
      .then(data => { if (active) setResult(data); }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[concertId,search,page,attempt]);
  return <div className="admin-picker">
    {!concertId && <input aria-label="Tìm nghệ sĩ" placeholder="Tìm nghệ sĩ" value={search} disabled={disabled} onChange={e => { setSearch(e.target.value); setPage(0); }} />}
    <select id="admin-artist_id" aria-label="Nghệ sĩ" aria-invalid={Boolean(errorId)} aria-describedby={errorId} value={value || ''} disabled={disabled || loading || error} onChange={e => onChange(e.target.value)}>
      <option value="">Không chọn nghệ sĩ</option>
      {value && !result.rows.some(r => (r.artist_id || r.id) === value) && <option value={value}>Nghệ sĩ đang chọn ({value})</option>}
      {result.rows.map(r => <option key={r.artist_id || r.id} value={r.artist_id || r.id}>{r.artist?.name || r.name || r.artist_id}</option>)}
    </select>
    {loading ? <p role="status">Đang tải nghệ sĩ...</p> : error ? <div role="alert"><p>Chưa thể tải nghệ sĩ.</p><button type="button" onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div> : <Pagination page={page} count={result.count} onChange={setPage} />}
  </div>;
}
export function AdminForm({ table, row, concertId, onSaved, onCancel, service = adminService, imageService }) {
  const [values,setValues] = useState(() => formValues(table,row || {}));
  const [errors,setErrors] = useState({}); const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false); const [uploading,setUploading] = useState(false);
  const lock = useRef(false); const uploadLock = useRef(false); const formRef = useRef(null);
  const createId = useRef(null);
  function uploadBusy(value) { uploadLock.current = value; setUploading(value); }
  function imageUploaded(url) {
    setValues(v => ({ ...v, image_url:url }));
    setErrors(v => ({ ...v, image_url:undefined }));
    setMessage('');
  }
  async function submit(e) {
    e.preventDefault(); if (lock.current || uploadLock.current) return;
    const result = validateAdmin(table,values,row || {}); setErrors(result.errors); setMessage('');
    if (Object.keys(result.errors).length) {
      formRef.current?.querySelector('#admin-' + Object.keys(result.errors)[0])?.focus(); return;
    }
    lock.current = true; setBusy(true);
    try {
      const data = { ...result.data }; if (!row && concertId) data.concert_id = concertId;
      // Reuse a generated PK on retries so a lost response cannot create a second record.
      if (!row && ['artists','schedules'].includes(table)) { createId.current ||= globalThis.crypto.randomUUID(); data.id = createId.current; }
      await service.save(table,data,row); onSaved();
    } catch (error) { setMessage(table === 'artists' ? 'Chưa thể lưu thông tin nghệ sĩ. Vui lòng thử lại.' : adminError(error)); } finally { lock.current = false; setBusy(false); }
  }
  return <form ref={formRef} noValidate className="admin-form" onSubmit={submit} aria-busy={busy || uploading}>
    <p>Thời gian theo múi giờ Việt Nam (UTC+7).</p>
    {table === 'ticket_types' && <p>Đã bán/giữ chỗ: {row.sold_quantity} · Còn lại: {row.total_quantity - row.sold_quantity}</p>}
    {table === 'artists' && <div id="admin-image_url" tabIndex={-1} aria-describedby={errors.image_url ? 'error-image_url' : undefined}>
      <ArtistImageUpload value={values.image_url} name={values.name} disabled={busy} onBusy={uploadBusy} onUploaded={imageUploaded} service={imageService} />
      {errors.image_url && <p id="error-image_url" role="alert">{errors.image_url}</p>}
    </div>}
    <fieldset disabled={busy || uploading}><div className="admin-fields">{fields[table].map(([key,label,type = 'text']) => {
      if (type === 'hidden') return null;
      const a11y = { id:'admin-' + key,'aria-invalid':Boolean(errors[key]),'aria-describedby':errors[key] ? 'error-' + key : table === 'artists' && key === 'slug' ? 'artist-slug-help' : undefined };
      return <div key={key} className={type === 'textarea' ? 'admin-wide' : ''}><label htmlFor={a11y.id}>{label}</label>
        {type === 'select' ? <ArtistPicker value={values[key]} errorId={a11y['aria-describedby']} concertId={table === 'schedules' ? concertId : undefined} disabled={Boolean(row && table === 'concert_artists')} onChange={value => setValues(v => ({ ...v,[key]:value }))} />
          : type === 'textarea' ? <textarea {...a11y} value={values[key]} onChange={e => setValues(v => ({ ...v,[key]:e.target.value }))} />
          : <input {...a11y} type={type} checked={type === 'checkbox' ? values[key] : undefined} value={type === 'checkbox' ? undefined : values[key]} onChange={e => setValues(v => ({ ...v,[key]:type === 'checkbox' ? e.target.checked : e.target.value }))} />}
        {errors[key] && <p id={'error-' + key} role="alert">{errors[key]}</p>}
        {table === 'artists' && key === 'slug' && <p id="artist-slug-help" className="mt-2 break-words text-sm">Trang nghệ sĩ: /artists/{values.slug || '<slug>'}. Đây không phải đường dẫn ảnh.</p>}
      </div>;
    })}</div></fieldset>
    <Feedback message={message} error /><div className="admin-actions"><button className="button button-pink" disabled={busy || uploading}>{busy ? 'Đang xử lý...' : 'Lưu thay đổi'}</button>{onCancel && <button type="button" disabled={busy || uploading} onClick={onCancel}>Đóng biểu mẫu</button>}</div>
  </form>;
}
