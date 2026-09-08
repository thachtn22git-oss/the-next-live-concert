import { validateEmail } from '../../auth/validation.js';

export function validateCustomer(values) {
  const errors = {};
  if (!values.fullName.trim() || values.fullName.trim().length > 120) errors.fullName = 'Vui lòng nhập họ và tên (tối đa 120 ký tự).';
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!/^\+?[0-9]{9,15}$/.test(values.phone.replace(/[\s().-]/g, ''))) errors.phone = 'Vui lòng nhập số điện thoại hợp lệ (9 đến 15 chữ số).';
  return errors;
}

const messages = {
  TN001: 'Vui lòng đăng nhập để tiếp tục.',
  TN002: 'Lựa chọn vé không hợp lệ.',
  TN003: 'Sự kiện hiện không nhận đặt vé.',
  TN004: 'Hạng vé bạn chọn hiện không khả dụng.',
  TN005: 'Hạng vé này chưa mở bán.',
  TN006: 'Thời gian bán vé đã kết thúc.',
  TN007: 'Số lượng vé vượt quá giới hạn cho mỗi đơn.',
  TN008: 'Hạng vé bạn chọn vừa hết. Vui lòng chọn hạng vé khác.',
  TN009: 'Số lượng vé còn lại đã thay đổi. Vui lòng kiểm tra và thử lại.',
  TN010: 'Vui lòng kiểm tra lại thông tin người đặt vé.',
  '42501': 'Vui lòng đăng nhập để tiếp tục.',
  PGRST301: 'Vui lòng đăng nhập để tiếp tục.',
};

export function orderErrorMessage(error) {
  return messages[error?.code] || 'Chưa thể tạo đơn đặt vé. Vui lòng thử lại.';
}

export const orderStatuses = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' };
export const paymentStatuses = { unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', failed: 'Thanh toán không thành công', refunded: 'Đã hoàn tiền' };

export function orderSummary(order) {
  return {
    items: (order.order_items ?? []).map(item => ({
      ticket: { id: item.ticket_type_id, name: item.ticket_name, slug: item.ticket_name.toLowerCase(), price: Number(item.unit_price) },
      quantity: item.quantity, subtotal: Number(item.subtotal),
    })),
    totalQuantity: order.total_quantity,
    totalAmount: Number(order.total_amount),
  };
}
