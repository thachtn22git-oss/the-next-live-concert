export const ticketStatuses = { valid: 'Hợp lệ', used: 'Đã sử dụng', cancelled: 'Đã hủy' };
export const ticketStatusLabel = status => ticketStatuses[status] || 'Chưa xác định';
export const isVerificationToken = token => typeof token === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token);

export function verificationUrl(token, origin = globalThis.location?.origin) {
  if (!isVerificationToken(token)) throw new Error('Invalid verification token');
  const url = new URL(origin);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid site origin');
  return url.origin + '/verify-ticket/' + encodeURIComponent(token);
}

export function hasUsableQr(ticket) {
  return ticket.status === 'valid' && ticket.order?.status === 'confirmed' && ticket.order?.payment_status === 'paid';
}

export function groupTickets(tickets) {
  const groups = new Map();
  for (const ticket of tickets) {
    const key = ticket.concert_id;
    if (!groups.has(key)) groups.set(key, { id: key, name: ticket.concert_name, tickets: [] });
    groups.get(key).tickets.push(ticket);
  }
  return [...groups.values()];
}

export function verificationMessage(ticket) {
  if (!ticket) return 'Không tìm thấy vé.';
  if (ticket.status === 'cancelled') return 'Vé đã bị hủy.';
  if (ticket.status === 'used') return 'Vé đã được sử dụng.';
  return ticket.is_valid === true && ticket.status === 'valid' ? 'Vé hợp lệ' : 'Vé không hợp lệ.';
}
