import { supabase } from '../../../lib/supabase.js';
import { normalizeEmail } from '../../auth/validation.js';

const orderFields = 'id, order_code, customer_name, customer_email, customer_phone, status, payment_status, total_quantity, total_amount, created_at, expires_at, expired_at, order_items(ticket_type_id, ticket_name, quantity, unit_price, subtotal)';

export function createOrderService(client = supabase) {
  function requireClient() {
    if (!client) throw new Error('Orders are not configured');
    return client;
  }
  async function unwrap(request) {
    const { data, error } = await request;
    if (error) throw error;
    return data;
  }
  return {
    createOrder: ({ concertId, customer, items, requestId }, signal) => unwrap(requireClient().rpc('create_order', {
      p_concert_id: concertId,
      p_customer_name: customer.fullName.trim(),
      p_customer_email: normalizeEmail(customer.email),
      p_customer_phone: customer.phone.replace(/[\s().-]/g, ''),
      p_items: items.map(item => ({ ticket_type_id: item.ticket_type_id, quantity: item.quantity })),
      p_request_id: requestId,
    }).abortSignal(signal)),
    getOrder: (orderCode, userId, signal) => unwrap(requireClient().from('orders').select(orderFields)
      .eq('order_code', orderCode).eq('user_id', userId).abortSignal(signal).maybeSingle()),
    findRequest: (requestId, userId, signal) => unwrap(requireClient().from('orders').select('order_code')
      .eq('request_id', requestId).eq('user_id', userId).abortSignal(signal).maybeSingle()),
  };
}

export const orderService = createOrderService();
