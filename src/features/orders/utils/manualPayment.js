export const paymentAccount = { bank: 'Vietcombank', bankBin: '970436', number: '1031185809', holder: 'TRAN NGOC THACH' };

// Retain the full identifier, without separators, for bank transfer memos.
export function transferReference(orderCode) {
  if (!/^TNL-\d{8}-[A-F0-9]{20,32}$/.test(orderCode ?? '')) return null;
  return orderCode.replaceAll('-', '');
}

export function manualPaymentDetails(order, now = Date.now()) {
  const reference = transferReference(order.order_code);
  const amount = Number(order.total_amount);
  const deadline = Date.parse(order.expires_at);
  if (order.status !== 'pending' || !['unpaid', 'failed'].includes(order.payment_status)
    || order.expired_at || order.inventory_released_at || !Number.isFinite(deadline) || deadline <= now
    || !reference || !Number.isSafeInteger(amount) || amount <= 0) return null;
  const url = new URL(`https://img.vietqr.io/image/${paymentAccount.bankBin}-${paymentAccount.number}-compact2.png`);
  url.search = new globalThis.URLSearchParams({ amount: String(amount), addInfo: reference, accountName: paymentAccount.holder }).toString();
  return { reference, amount, qrUrl: url.href };
}
