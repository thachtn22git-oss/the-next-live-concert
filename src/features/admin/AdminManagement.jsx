import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminService } from './adminService.js';
import { useAdminData } from './useAdminData.js';
import { AdminForm, LoadState, Pagination } from './AdminCommon.jsx';
import { adminError, date, money } from './adminModel.js';

export function ConcertManagement() {
  const state = useAdminData(useCallback(() => adminService.concert(),[])); const [saved,setSaved] = useState(false);
  return <><h2>Sự kiện</h2><LoadState state={state} retry={state.retry} />{saved && <p role="status">Thao tác thành công.</p>}{state.data && <><AdminForm key={JSON.stringify(state.data)} table="concerts" row={state.data} onSaved={() => { setSaved(true); state.retry(); }} /><Management table="concert_artists" title="Nghệ sĩ tham gia" concertId={state.data.id} /></>}{!state.loading && !state.error && !state.data && <p>Không tìm thấy sự kiện đã cấu hình.</p>}</>;
}
export function EventManagement({ table, title }) {
  const state = useAdminData(useCallback(() => adminService.concert(),[]));
  return <><LoadState state={state} retry={state.retry} />{state.data && <Management key={table} table={table} title={title} concertId={state.data.id} />}{!state.loading && !state.error && !state.data && <p>Không tìm thấy sự kiện đã cấu hình.</p>}</>;
}
export function Management({ table, title, concertId }) {
  const [page,setPage] = useState(0); const [search,setSearch] = useState(''); const [edit,setEdit] = useState(undefined); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  const state = useAdminData(useCallback(() => adminService.list(table,{ page,search,concertId }),[table,page,search,concertId]));
  async function remove(row) { if (!window.confirm('Xóa bản ghi này? Dữ liệu đang được tham chiếu sẽ được bảo vệ.')) return; setBusy(true); setMessage(''); try { await adminService.remove(table,row); setMessage('Thao tác thành công.'); state.retry(); } catch (error) { setMessage(adminError(error)); } finally { setBusy(false); } }
  return <section className="admin-section"><div className="admin-heading"><h2>{title}</h2>{table === 'artists' ? <Link className="button button-pink" to="/admin/artists/new">Thêm nghệ sĩ</Link> : table !== 'ticket_types' && <button onClick={() => setEdit(null)}>Thêm mới</button>}</div>
    {table === 'artists' && <input aria-label="Tìm nghệ sĩ" placeholder="Tìm theo tên nghệ sĩ" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />}
    {message && <p role="status">{message}</p>}{edit !== undefined && <AdminForm key={edit?.id || edit?.artist_id || 'new'} table={table} row={edit} concertId={concertId} onSaved={() => { setEdit(undefined); setMessage('Thao tác thành công.'); state.retry(); }} onCancel={() => setEdit(undefined)} />}
    <LoadState state={state} retry={state.retry} />{state.data && <><div className="admin-table-wrap"><table><thead><tr><th>Nội dung</th><th>Thông tin</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{state.data.rows.map(row => <tr key={row.id || row.artist_id}><td>{row.name || row.title || row.artist?.name || row.artist_id}</td><td>{table === 'ticket_types' ? <>{money(row.price)}<br />Tổng số vé: {row.total_quantity} · Đã bán/giữ: {row.sold_quantity} · Còn lại: {row.total_quantity-row.sold_quantity}</> : table === 'schedules' ? <>{row.stage}<br />{date(row.starts_at)} – {date(row.ends_at)}</> : table === 'concert_artists' ? `${row.billing} · Thứ tự: ${row.display_order}` : row.genre}</td><td>{table === 'concert_artists' ? row.is_featured ? 'Nổi bật' : 'Tham gia' : (row.is_published ?? row.is_active) ? 'Công khai / Hoạt động' : 'Đang ẩn'}</td><td><div className="admin-actions">{table === 'artists' ? <Link to={`/admin/artists/${row.id}/edit`}>Chỉnh sửa</Link> : <button onClick={() => setEdit(row)}>Chỉnh sửa</button>}{table !== 'ticket_types' && <button disabled={busy} onClick={() => remove(row)}>Xóa</button>}</div></td></tr>)}</tbody></table></div>{!state.data.rows.length && <p>Chưa có dữ liệu.</p>}<Pagination page={page} count={state.data.count} onChange={setPage} /></>}
  </section>;
}
export function ArtistEditor() {
  const { id } = useParams(); const navigate = useNavigate(); const state = useAdminData(useCallback(() => id ? adminService.get('artists',id) : Promise.resolve({}),[id]));
  return <><h2>{id ? 'Chỉnh sửa nghệ sĩ' : 'Thêm nghệ sĩ'}</h2><LoadState state={state} retry={state.retry} />{state.data && <AdminForm key={id || 'new'} table="artists" row={id ? state.data : null} onSaved={() => navigate('/admin/artists')} onCancel={() => navigate('/admin/artists')} />}{!state.loading && !state.error && !state.data && <p>Không tìm thấy nghệ sĩ.</p>}</>;
}
