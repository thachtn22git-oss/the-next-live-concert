import { useCallback } from 'react';
import { adminService } from '../features/admin/adminService.js';
import { useAdminData } from '../features/admin/useAdminData.js';
import { LoadState } from '../features/admin/AdminCommon.jsx';
import { EventManagement } from '../features/admin/AdminManagement.jsx';
import { money } from '../features/admin/adminModel.js';
export default function AdminDashboardPage() {
  const state = useAdminData(useCallback(() => adminService.rpc('admin_dashboard'),[]));
  return <><h2>Tổng quan</h2><LoadState state={state} retry={state.retry} />{state.data && <div className="admin-stats">{[['orders','Tổng đơn hàng'],['quantity','Vé đã đặt (chưa hủy)'],['revenue','Doanh thu đã xác nhận'],['pending','Đơn chờ xử lý'],['issued','Vé đã phát hành'],['used','Vé đã check-in']].map(([key,label]) => <article key={key}><p>{label}</p><strong>{key === 'revenue' ? money(state.data[key]) : state.data[key]}</strong></article>)}</div>}<p className="admin-note">Doanh thu chỉ tính đơn đã xác nhận và đã thanh toán. Tồn kho bao gồm vé giữ chỗ của đơn chờ xử lý.</p><EventManagement table="ticket_types" title="Tồn kho theo hạng vé" /></>;
}
