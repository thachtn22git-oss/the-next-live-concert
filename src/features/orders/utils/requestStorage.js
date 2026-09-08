import { ticketStorage } from '../../tickets/utils/storage.js';

const key = userId => 'the-next:pending-order:v1:' + userId;
export function readOrderRequest(userId, storage = ticketStorage()) {
  try {
    const value = storage?.getItem(key(userId));
    return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value || '') ? value : null;
  } catch { return null; }
}
export function saveOrderRequest(userId, requestId, storage = ticketStorage()) {
  try { storage?.setItem(key(userId), requestId); } catch { /* Memory-only retries still use the same request ID. */ }
}
export function clearOrderRequest(userId, storage = ticketStorage()) {
  try { storage?.removeItem(key(userId)); } catch { /* A later replay safely returns the same order. */ }
}
