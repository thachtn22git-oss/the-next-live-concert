import { formatVnd } from '../tickets/utils/tickets.js';
import { formatDateTime } from '../../utils/concert.js';
import { isVerificationToken } from '../tickets/utils/digitalTickets.js';

export const orderLabels = { pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' };
export const paymentLabels = { unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', failed: 'Thất bại', refunded: 'Đã hoàn tiền' };
export const money = value => formatVnd(value || 0);
export const date = formatDateTime;
export function ticketReference(input) {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try { const url = new URL(value); value = decodeURIComponent(url.pathname.match(/^\/verify-ticket\/([^/]+)\/?$/)?.[1] || ''); } catch { return ''; }
  }
  return isVerificationToken(value) || /^TNL-TKT-[0-9A-F]{32}$/i.test(value) ? value : '';
}
export function searchTerm(value) { return value.trim().replace(/[^\p{L}\p{N}@.+\s-]/gu, '').slice(0, 120); }
export function adminError(error) {
  return ({ TA001: 'Bạn không có quyền thực hiện thao tác này.', TA002: 'Không tìm thấy đơn hàng.', TA003: 'Trạng thái đơn hàng không cho phép thao tác này.', TA004: 'Không thể hủy đơn đã có vé được sử dụng.', TA005: 'Tồn kho không khớp. Vui lòng liên hệ người quản lý dữ liệu.', TA006: 'KHÔNG TÌM THẤY VÉ', TA007: 'Vé đã được sử dụng.', TA008: 'VÉ ĐÃ BỊ HỦY', '23503': 'Dữ liệu đang được sử dụng. Hãy gỡ lịch trình liên quan trước.', '23505': 'Đường dẫn hoặc bản ghi này đã tồn tại.', '23514': 'Dữ liệu không hợp lệ. Kiểm tra thời gian và tổng số vé.' })[error?.code] || 'Chưa thể thực hiện thao tác. Vui lòng thử lại.';
}

export const fields = {
  concerts: [['name','Tên sự kiện'],['venue','Địa điểm'],['description','Mô tả','textarea'],['starts_at','Bắt đầu','datetime-local'],['ends_at','Kết thúc','datetime-local'],['is_published','Công khai','checkbox']],
  artists: [['name','Tên nghệ sĩ'],['slug','Đường dẫn nghệ sĩ'],['genre','Thể loại'],['biography','Tiểu sử','textarea'],['image_url','Ảnh nghệ sĩ','hidden'],['image_alt','Mô tả ảnh'],['social_links','Liên kết mạng xã hội (JSON)','textarea'],['is_published','Công khai','checkbox']],
  schedules: [['title','Tiêu đề'],['artist_id','Nghệ sĩ','select'],['stage','Sân khấu'],['description','Mô tả','textarea'],['starts_at','Bắt đầu','datetime-local'],['ends_at','Kết thúc','datetime-local'],['is_published','Công khai','checkbox']],
  ticket_types: [['name','Tên hạng vé'],['description','Mô tả','textarea'],['price','Giá vé','number'],['total_quantity','Tổng số vé','number'],['max_per_order','Tối đa mỗi đơn','number'],['sale_start','Mở bán','datetime-local'],['sale_end','Đóng bán','datetime-local'],['is_active','Đang mở bán','checkbox'],['display_order','Thứ tự','number']],
  concert_artists: [['artist_id','Nghệ sĩ','select'],['display_order','Thứ tự','number'],['billing','Vai trò biểu diễn'],['is_featured','Nghệ sĩ nổi bật','checkbox']],
};
export function formValues(table, row = {}) {
  return Object.fromEntries(fields[table].map(([key,,type]) => {
    let value = row[key] ?? (type === 'checkbox' ? false : type === 'number' ? (key === 'max_per_order' ? 4 : 0) : '');
    if (type === 'datetime-local' && value) value = new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0,16);
    if (key === 'social_links') value = JSON.stringify(row[key] || {}, null, 2);
    return [key, value];
  }));
}
export function validateAdmin(table, values, row = {}) {
  const errors = {}; const data = {};
  for (const [key,,type] of fields[table]) {
    let value = values[key];
    if (type === 'checkbox') value = Boolean(value);
    else if (type === 'number') {
      value = value === '' ? NaN : Number(value);
      if (!Number.isSafeInteger(value) || value < (key === 'max_per_order' ? 1 : 0) || value > 2147483647) errors[key] = 'Nhập số nguyên hợp lệ trong giới hạn cho phép.';
    } else if (type === 'datetime-local') {
      value = value ? new Date(value + ':00+07:00') : null;
      if (value && Number.isNaN(value.getTime())) errors[key] = 'Thời gian không hợp lệ.';
      value = value && !errors[key] ? value.toISOString() : null;
    } else value = String(value ?? '').trim();
    if (['name','title','slug','starts_at','ends_at'].includes(key) && !value) errors[key] = 'Vui lòng điền thông tin này.';
    if (key === 'slug' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) errors[key] = 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.';
    if (key === 'image_url') { if (value && !safeUrl(value)) errors[key] = 'Ảnh chưa có địa chỉ lưu trữ hợp lệ. Vui lòng tải ảnh lên lại.'; value ||= null; }
    if (key === 'artist_id') { if (!value && table === 'concert_artists') errors[key] = 'Vui lòng chọn nghệ sĩ.'; value ||= null; }
    if (key === 'social_links') {
      try { value = JSON.parse(value); if (!value || Array.isArray(value) || typeof value !== 'object' || Object.values(value).some(url => !safeUrl(url))) throw new Error(); }
      catch { errors[key] = 'Nhập đối tượng JSON gồm tên mạng xã hội và đường dẫn http/https.'; }
    }
    data[key] = value;
  }
  for (const [start,end] of [['starts_at','ends_at'],['sale_start','sale_end']]) if (data[start] && data[end] && data[end] <= data[start]) errors[end] = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  if (table === 'ticket_types' && data.total_quantity < row.sold_quantity) errors.total_quantity = 'Tổng số vé không được nhỏ hơn số vé đã bán/giữ chỗ.';
  return { data, errors };
}
function safeUrl(value) { try { return ['http:','https:'].includes(new URL(value).protocol); } catch { return false; } }
