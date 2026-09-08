const currency = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function formatVnd(amount) {
  return currency.format(amount) + 'đ';
}

export function ticketName(ticket) {
  return { standard: 'Tiêu chuẩn', vip: 'VIP', premium: 'Cao cấp' }[ticket.slug] || ticket.name;
}

export function remainingQuantity(ticket) {
  if (!Number.isSafeInteger(ticket.total_quantity) || !Number.isSafeInteger(ticket.sold_quantity)) return 0;
  return Math.max(0, ticket.total_quantity - ticket.sold_quantity);
}

export function saleStatus(ticket, now = Date.now()) {
  if (!ticket.is_active) return 'inactive';
  const start = ticket.sale_start === null ? null : Date.parse(ticket.sale_start);
  const end = ticket.sale_end === null ? null : Date.parse(ticket.sale_end);
  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) return 'inactive';
  if (start !== null && now < start) return 'upcoming';
  if (end !== null && now >= end) return 'ended';
  if (remainingQuantity(ticket) === 0) return 'sold_out';
  return 'available';
}

export function selectionLimit(ticket, now = Date.now()) {
  if (saleStatus(ticket, now) !== 'available' || !Number.isSafeInteger(ticket.max_per_order) || ticket.max_per_order < 1) return 0;
  return Math.min(ticket.max_per_order, remainingQuantity(ticket));
}

// A display estimate only. Phase 5 must validate and reserve inventory on the server.
export function reconcileSelection(quantities, ticketTypes, now = Date.now()) {
  const valid = {};
  for (const ticket of ticketTypes) {
    const requested = quantities?.[ticket.id];
    if (!Number.isSafeInteger(requested) || requested < 1) continue;
    const count = Math.min(requested, selectionLimit(ticket, now));
    if (count > 0) valid[ticket.id] = count;
  }
  return valid;
}

export function sameSelection(first, second) {
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every(key => first[key] === second[key]);
}

export function selectionSummary(quantities, ticketTypes, now = Date.now()) {
  const valid = reconcileSelection(quantities, ticketTypes, now);
  const items = ticketTypes.filter(ticket => valid[ticket.id]).map(ticket => ({
    ticket, quantity: valid[ticket.id], subtotal: ticket.price * valid[ticket.id],
  }));
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
  };
}

export const saleLabels = {
  available: 'Đang mở bán', inactive: 'Chưa mở bán',
  upcoming: 'Chưa mở bán', ended: 'Đã kết thúc bán vé', sold_out: 'Hết vé',
};
